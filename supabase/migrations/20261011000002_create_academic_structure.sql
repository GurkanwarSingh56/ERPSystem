-- Migration: 20261011000002_create_academic_structure.sql
-- Description: Departments, courses, semesters, sections, and subjects with composite hierarchy constraints.

BEGIN;

-- 1. Departments Table
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  hod_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_departments_institution_code UNIQUE (institution_id, code),
  CONSTRAINT uq_departments_institution_id UNIQUE (institution_id, id)
);

-- 2. Courses Table
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  department_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  duration_years INT NOT NULL DEFAULT 4 CHECK (duration_years > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_courses_department FOREIGN KEY (institution_id, department_id)
    REFERENCES departments(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_courses_institution_code UNIQUE (institution_id, code),
  CONSTRAINT uq_courses_institution_dept_id UNIQUE (institution_id, department_id, id),
  CONSTRAINT uq_courses_institution_id UNIQUE (institution_id, id)
);

-- 3. Semesters Table
CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL,
  semester_number INT NOT NULL CHECK (semester_number BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_semesters_course FOREIGN KEY (institution_id, course_id)
    REFERENCES courses(institution_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_semesters_inst_course_sem UNIQUE (institution_id, course_id, semester_number),
  CONSTRAINT uq_semesters_inst_course_id UNIQUE (institution_id, course_id, id),
  CONSTRAINT uq_semesters_institution_id UNIQUE (institution_id, id)
);

-- 4. Sections Table
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL,
  semester_id UUID NOT NULL,
  name TEXT NOT NULL,
  advisor_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_sections_semester FOREIGN KEY (institution_id, course_id, semester_id)
    REFERENCES semesters(institution_id, course_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_sections_inst_sem_name UNIQUE (institution_id, semester_id, name),
  CONSTRAINT uq_sections_inst_course_sem_id UNIQUE (institution_id, course_id, semester_id, id),
  CONSTRAINT uq_sections_institution_id UNIQUE (institution_id, id)
);

-- 5. Subjects Table
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  course_id UUID NOT NULL,
  semester_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type subject_type NOT NULL DEFAULT 'theory',
  max_internal_marks NUMERIC(5,2) NOT NULL DEFAULT 30.00 CHECK (max_internal_marks >= 0),
  max_midterm_marks NUMERIC(5,2) NOT NULL DEFAULT 20.00 CHECK (max_midterm_marks >= 0),
  max_final_marks NUMERIC(5,2) NOT NULL DEFAULT 50.00 CHECK (max_final_marks >= 0),
  max_practical_marks NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (max_practical_marks >= 0),
  total_max_marks NUMERIC(5,2) GENERATED ALWAYS AS (max_internal_marks + max_midterm_marks + max_final_marks + max_practical_marks) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_subjects_semester FOREIGN KEY (institution_id, course_id, semester_id)
    REFERENCES semesters(institution_id, course_id, id) ON DELETE CASCADE,
  CONSTRAINT uq_subjects_institution_code UNIQUE (institution_id, code),
  CONSTRAINT uq_subjects_inst_course_sem_id UNIQUE (institution_id, course_id, semester_id, id),
  CONSTRAINT uq_subjects_institution_id UNIQUE (institution_id, id)
);

COMMIT;
