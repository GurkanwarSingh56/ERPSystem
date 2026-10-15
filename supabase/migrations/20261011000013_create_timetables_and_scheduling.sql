-- Migration: 20261011000013_create_timetables_and_scheduling.sql
-- Description: Timetable generation, schedules, and period allocations with conflict prevention and RLS.

BEGIN;

-- 1. Create Timetable Status and Day of Week Enums
DO $$ BEGIN
  CREATE TYPE timetable_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE timetable_day AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Timetables Master Table
CREATE TABLE public.timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  academic_year TEXT NOT NULL,
  course_id UUID NOT NULL,
  semester_id UUID NOT NULL,
  section_id UUID NOT NULL,
  title TEXT NOT NULL,
  status timetable_status NOT NULL DEFAULT 'draft',
  version INT NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_timetables_section FOREIGN KEY (institution_id, course_id, semester_id, section_id)
    REFERENCES public.sections(institution_id, course_id, semester_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_timetables_section_year_version UNIQUE (institution_id, section_id, academic_year, version)
);

-- 3. Timetable Slots / Periods Configuration Table (Periods 1-12, breaks, lunch)
CREATE TABLE public.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  slot_number INT NOT NULL CHECK (slot_number BETWEEN 1 AND 12),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT FALSE,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_timetable_slots_inst_slot UNIQUE (institution_id, slot_number),
  CONSTRAINT chk_timetable_slots_time CHECK (start_time < end_time)
);

-- 4. Timetable Entries Table (Allocated periods per day)
CREATE TABLE public.timetable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  timetable_id UUID NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
  day_of_week timetable_day NOT NULL,
  slot_number INT NOT NULL CHECK (slot_number BETWEEN 1 AND 12),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE RESTRICT,
  room_number TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  -- Section conflict: No two classes for the same timetable (section) at the same day & slot
  CONSTRAINT uq_timetable_entry_slot UNIQUE (timetable_id, day_of_week, slot_number)
);

-- 5. Indexes for fast query resolution and conflict detection
CREATE INDEX idx_timetables_inst_section_status ON public.timetables (institution_id, section_id, status);
CREATE INDEX idx_timetable_entries_teacher_slot ON public.timetable_entries (institution_id, teacher_id, day_of_week, slot_number);
CREATE INDEX idx_timetable_entries_room_slot ON public.timetable_entries (institution_id, room_number, day_of_week, slot_number) WHERE room_number IS NOT NULL;

-- 6. Helper Function: Validate Teacher Conflict Across Published Schedules
CREATE OR REPLACE FUNCTION public.check_timetable_teacher_conflict()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_timetable_status timetable_status;
  v_conflict_count INT;
BEGIN
  -- Get current timetable status
  SELECT status INTO v_timetable_status FROM public.timetables WHERE id = NEW.timetable_id;
  
  -- If timetable is published, ensure the teacher has no overlapping published entries at the same day & period
  IF (v_timetable_status = 'published') THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM public.timetable_entries te
    JOIN public.timetables t ON t.id = te.timetable_id
    WHERE te.institution_id = NEW.institution_id
      AND te.teacher_id = NEW.teacher_id
      AND te.day_of_week = NEW.day_of_week
      AND te.slot_number = NEW.slot_number
      AND t.status = 'published'
      AND te.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF (v_conflict_count > 0) THEN
      RAISE EXCEPTION 'Scheduling Conflict: Teacher is already assigned to another published class on % during period %.',
        NEW.day_of_week, NEW.slot_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_timetable_teacher_conflict ON public.timetable_entries;
CREATE TRIGGER trg_check_timetable_teacher_conflict
  BEFORE INSERT OR UPDATE ON public.timetable_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_timetable_teacher_conflict();

-- 7. Enable RLS
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;

-- 8. Timetable Slots Policies
-- All authenticated users in the institution can read configured slots
CREATE POLICY "timetable_slots_read" ON public.timetable_slots
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT inst_id FROM public.get_auth_context()));

-- Admins can manage slots
CREATE POLICY "timetable_slots_admin_all" ON public.timetable_slots
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- 9. Timetables Policies
-- Admins have full access to their institution's timetables
CREATE POLICY "timetables_admin_all" ON public.timetables
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Teachers can view published timetables in their institution
CREATE POLICY "timetables_teacher_read_published" ON public.timetables
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context())
    AND status = 'published'
    AND (SELECT user_role FROM public.get_auth_context()) IN ('teacher', 'hod', 'principal')
  );

-- Students can view only published timetables for their own enrolled section
CREATE POLICY "timetables_student_read_published" ON public.timetables
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context())
    AND status = 'published'
    AND section_id IN (
      SELECT s.section_id FROM public.students s
      WHERE s.id = auth.uid() AND s.institution_id = timetables.institution_id
    )
  );

-- 10. Timetable Entries Policies
-- Admins can manage entries
CREATE POLICY "timetable_entries_admin_all" ON public.timetable_entries
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Teachers can view published entries where they are assigned or for published section timetables
CREATE POLICY "timetable_entries_teacher_read" ON public.timetable_entries
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context())
    AND EXISTS (
      SELECT 1 FROM public.timetables t
      WHERE t.id = timetable_entries.timetable_id
        AND t.status = 'published'
    )
    AND (
      teacher_id = auth.uid()
      OR (SELECT user_role FROM public.get_auth_context()) IN ('teacher', 'hod', 'principal')
    )
  );

-- Students can view entries for published timetables belonging to their section
CREATE POLICY "timetable_entries_student_read" ON public.timetable_entries
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context())
    AND EXISTS (
      SELECT 1 FROM public.timetables t
      JOIN public.students s ON s.section_id = t.section_id AND s.institution_id = t.institution_id
      WHERE t.id = timetable_entries.timetable_id
        AND t.status = 'published'
        AND s.id = auth.uid()
    )
  );

COMMIT;
