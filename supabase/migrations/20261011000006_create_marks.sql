-- Migration: 20261011000006_create_marks.sql
-- Description: Academic evaluation and grading marks per student and subject.

BEGIN;

CREATE TABLE marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  internal_marks NUMERIC(5,2) NULL CHECK (internal_marks >= 0),
  midterm_marks NUMERIC(5,2) NULL CHECK (midterm_marks >= 0),
  final_marks NUMERIC(5,2) NULL CHECK (final_marks >= 0),
  practical_marks NUMERIC(5,2) NULL CHECK (practical_marks >= 0),
  total_marks NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (total_marks >= 0),
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (percentage BETWEEN 0 AND 100),
  grade TEXT NOT NULL DEFAULT 'F',
  entered_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_marks_student FOREIGN KEY (institution_id, student_id)
    REFERENCES students(institution_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_marks_subject FOREIGN KEY (institution_id, subject_id)
    REFERENCES subjects(institution_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_marks_student_subject UNIQUE (institution_id, student_id, subject_id)
);

COMMIT;
