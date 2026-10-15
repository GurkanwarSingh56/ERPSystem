-- Migration 20261015000015_create_rooms_and_labs.sql
-- Supports Phase 13: College Timetable Engine, Faculty-Subject Mapping, Rooms & Labs

-- 1. Create Room Type Enum
DO $$ BEGIN
  CREATE TYPE public.room_type AS ENUM ('classroom', 'lab', 'seminar_hall', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Rooms Table
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  room_number text NOT NULL,
  name text,
  type room_type NOT NULL DEFAULT 'classroom',
  capacity integer NOT NULL DEFAULT 60 CHECK (capacity > 0),
  is_available boolean NOT NULL DEFAULT true,
  requires_consecutive_slots boolean NOT NULL DEFAULT false, -- Useful for Labs requiring double periods
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_rooms_inst_number UNIQUE (institution_id, room_number),
  CONSTRAINT uq_rooms_institution_id UNIQUE (institution_id, id)
);

-- 3. Enhance Timetable Entries for Room/Lab & Batch/Group Tracking
ALTER TABLE public.timetable_entries
ADD COLUMN IF NOT EXISTS room_id uuid,
ADD COLUMN IF NOT EXISTS batch_group text DEFAULT NULL; -- e.g. 'G1', 'G2' for lab batches matching TT reference

DO $$ BEGIN
  ALTER TABLE public.timetable_entries
  ADD CONSTRAINT fk_timetable_entries_room FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_inst_type ON public.rooms (institution_id, type);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_room_id ON public.timetable_entries (institution_id, room_id);

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_admin_all" ON public.rooms
  FOR ALL
  TO authenticated
  USING (is_admin_of_institution(institution_id))
  WITH CHECK (is_admin_of_institution(institution_id));

CREATE POLICY "rooms_read" ON public.rooms
  FOR SELECT
  TO authenticated
  USING (institution_id IN (
    SELECT inst_id FROM get_auth_context()
  ));
