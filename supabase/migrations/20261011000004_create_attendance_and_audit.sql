-- Migration: 20261011000004_create_attendance_and_audit.sql
-- Description: Attendance management supporting 12 daily academic periods and non-destructible audit log.

BEGIN;

-- 1. Attendance Table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  section_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  date DATE NOT NULL,
  period_number INT NOT NULL CHECK (period_number BETWEEN 1 AND 12),
  status attendance_status NOT NULL,
  marked_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  remarks TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_attendance_student_section FOREIGN KEY (institution_id, section_id, student_id)
    REFERENCES students(institution_id, section_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_subject FOREIGN KEY (institution_id, subject_id)
    REFERENCES subjects(institution_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_attendance_session UNIQUE (institution_id, student_id, subject_id, section_id, date, period_number)
);

-- 2. Attendance Audit Table (Tamper-Resistant Historical Record)
CREATE TABLE attendance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  previous_status attendance_status NOT NULL,
  new_status attendance_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMIT;
