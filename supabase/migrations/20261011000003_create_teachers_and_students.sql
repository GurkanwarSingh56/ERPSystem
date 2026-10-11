-- Migration: 20261011000003_create_teachers_and_students.sql
-- Description: Teachers, students, and curricular allocations (teacher_subjects) with composite integrity.

BEGIN;

-- 1. Teachers Table
CREATE TABLE teachers (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE RESTRICT,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL,
  department_id UUID NOT NULL,
  designation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_teachers_department FOREIGN KEY (institution_id, department_id)
    REFERENCES departments(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_teachers_institution_emp_id UNIQUE (institution_id, employee_id),
  CONSTRAINT uq_teachers_institution_id UNIQUE (institution_id, id)
);

-- 2. Students Table
CREATE TABLE students (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE RESTRICT,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  roll_number TEXT NOT NULL,
  admission_number TEXT NOT NULL,
  department_id UUID NOT NULL,
  course_id UUID NOT NULL,
  semester_id UUID NOT NULL,
  section_id UUID NOT NULL,
  is_dropped BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_students_section FOREIGN KEY (institution_id, course_id, semester_id, section_id)
    REFERENCES sections(institution_id, course_id, semester_id, id) ON DELETE RESTRICT,
  CONSTRAINT fk_students_course FOREIGN KEY (institution_id, department_id, course_id)
    REFERENCES courses(institution_id, department_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_students_institution_roll UNIQUE (institution_id, roll_number),
  CONSTRAINT uq_students_institution_admission UNIQUE (institution_id, admission_number),
  CONSTRAINT uq_students_institution_id UNIQUE (institution_id, id),
  CONSTRAINT uq_students_inst_sec_id UNIQUE (institution_id, section_id, id)
);

-- 3. Teacher Subjects Allocations Table
CREATE TABLE teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL,
  course_id UUID NOT NULL,
  semester_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  section_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_teacher_sub_teacher FOREIGN KEY (institution_id, teacher_id)
    REFERENCES teachers(institution_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_sub_subject FOREIGN KEY (institution_id, course_id, semester_id, subject_id)
    REFERENCES subjects(institution_id, course_id, semester_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_sub_section FOREIGN KEY (institution_id, course_id, semester_id, section_id)
    REFERENCES sections(institution_id, course_id, semester_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_teacher_sub_alloc UNIQUE (institution_id, teacher_id, subject_id, section_id),
  CONSTRAINT uq_teacher_sub_inst_sub_sec_id UNIQUE (institution_id, subject_id, section_id, id)
);

COMMIT;
