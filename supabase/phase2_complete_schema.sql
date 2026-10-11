-- ============================================================================
-- COLLEGE ERP MVP - PHASE 2 MIGRATION BUNDLE (MIGRATIONS 01 TO 10)
-- Project Reference: ocqawmwlpexuvnsypobb
-- ============================================================================

-- >>> START: 20261011000001_create_tenancy_and_profiles.sql <<<
-- Migration: 20261011000001_create_tenancy_and_profiles.sql
-- Description: Core tenancy (institutions), custom ENUMs, and profiles linked to auth.users.

BEGIN;

-- 1. Create Enums
CREATE TYPE user_role AS ENUM ('admin', 'principal', 'hod', 'teacher', 'student');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE subject_type AS ENUM ('theory', 'practical', 'both');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'leave');
CREATE TYPE payment_status AS ENUM ('completed', 'reversed', 'failed');
CREATE TYPE payment_method AS ENUM ('cash', 'cheque', 'bank_transfer', 'upi', 'demand_draft');

-- 2. Create Institutions Table (Tenant Root)
CREATE TABLE institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Seed default institution for immediate single-campus operation
INSERT INTO institutions (id, name, code)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main College Campus', 'MAIN-CAMPUS')
ON CONFLICT (code) DO NOTHING;

-- 3. Create Profiles Table (1:1 with auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  phone TEXT NULL,
  status user_status NOT NULL DEFAULT 'active',
  avatar_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT uq_profiles_institution_email UNIQUE (institution_id, email),
  CONSTRAINT uq_profiles_institution_id UNIQUE (institution_id, id)
);

-- 4. Role Escalation Protection Trigger
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- Determine role of the authenticated caller
  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  
  -- If non-admin attempts to escalate role, account status, or switch institution
  IF (caller_role IS DISTINCT FROM 'admin') THEN
    IF (NEW.role IS DISTINCT FROM OLD.role) OR 
       (NEW.status IS DISTINCT FROM OLD.status) OR 
       (NEW.institution_id IS DISTINCT FROM OLD.institution_id) THEN
      RAISE EXCEPTION 'Access Denied: Only administrators can modify roles, account status, or institution affiliation.';
    END IF;
  END IF;
  
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_escalation
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_escalation();

COMMIT;

-- >>> END: 20261011000001_create_tenancy_and_profiles.sql <<<

-- >>> START: 20261011000002_create_academic_structure.sql <<<
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

-- >>> END: 20261011000002_create_academic_structure.sql <<<

-- >>> START: 20261011000003_create_teachers_and_students.sql <<<
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

-- >>> END: 20261011000003_create_teachers_and_students.sql <<<

-- >>> START: 20261011000004_create_attendance_and_audit.sql <<<
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

-- >>> END: 20261011000004_create_attendance_and_audit.sql <<<

-- >>> START: 20261011000005_create_fees_and_payments.sql <<<
-- Migration: 20261011000005_create_fees_and_payments.sql
-- Description: Fees and fee_payments ledger with composite student foreign key and idempotency tracking.

BEGIN;

-- 1. Fees Table (Student Fee Master)
CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  academic_year TEXT NOT NULL,
  total_fee NUMERIC(12,2) NOT NULL CHECK (total_fee >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  pending_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_fee - paid_amount) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_fees_student FOREIGN KEY (institution_id, student_id)
    REFERENCES students(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_fees_student_year UNIQUE (institution_id, student_id, academic_year),
  CONSTRAINT uq_fees_inst_student_id UNIQUE (institution_id, student_id, id)
);

-- 2. Fee Payments Table (Immutable Financial Transaction Ledger)
CREATE TABLE fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  fee_id UUID NOT NULL,
  student_id UUID NOT NULL,
  receipt_number TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'completed',
  reference_number TEXT NULL,
  remarks TEXT NULL,
  recorded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reversed_payment_id UUID NULL REFERENCES fee_payments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_fee_payments_fee_student FOREIGN KEY (institution_id, student_id, fee_id)
    REFERENCES fees(institution_id, student_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_fee_payments_inst_receipt UNIQUE (institution_id, receipt_number),
  CONSTRAINT uq_fee_payments_inst_idempotency UNIQUE (institution_id, idempotency_key)
);

COMMIT;

-- >>> END: 20261011000005_create_fees_and_payments.sql <<<

-- >>> START: 20261011000006_create_marks.sql <<<
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

-- >>> END: 20261011000006_create_marks.sql <<<

-- >>> START: 20261011000007_create_business_triggers.sql <<<
-- Migration: 20261011000007_create_business_triggers.sql
-- Description: Business logic triggers for attendance auditing, fee reconciliation, and marks grading.

BEGIN;

-- 1. Attendance Audit Log Trigger Function
CREATE OR REPLACE FUNCTION public.log_attendance_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only log if the attendance status was modified
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO attendance_audit (
      institution_id,
      attendance_id,
      student_id,
      subject_id,
      previous_status,
      new_status,
      changed_by,
      reason,
      created_at
    ) VALUES (
      OLD.institution_id,
      OLD.id,
      OLD.student_id,
      OLD.subject_id,
      OLD.status,
      NEW.status,
      auth.uid(),
      COALESCE(NULLIF(trim(NEW.remarks), ''), 'Status update recorded'),
      timezone('utc', now())
    );
  END IF;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_attendance_audit
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION public.log_attendance_audit();

-- 2. Fee Reconciliation Ledger Trigger Function
CREATE OR REPLACE FUNCTION public.reconcile_fee_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fee_id UUID;
  v_total_paid NUMERIC(12,2);
  v_fee_total NUMERIC(12,2);
BEGIN
  v_fee_id := COALESCE(NEW.fee_id, OLD.fee_id);

  -- Reconcile net payments: completed minus reversed
  SELECT 
    COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0.00) -
    COALESCE(SUM(CASE WHEN payment_status = 'reversed' THEN amount ELSE 0 END), 0.00)
  INTO v_total_paid
  FROM fee_payments
  WHERE fee_id = v_fee_id;

  SELECT total_fee INTO v_fee_total FROM fees WHERE id = v_fee_id;

  -- Disallow exceeding total fee
  IF v_total_paid > v_fee_total THEN
    RAISE EXCEPTION 'Transaction Rejected: Total payments (₹%) exceed the total required fee balance (₹%).', v_total_paid, v_fee_total;
  END IF;

  -- Synchronize fee master record
  UPDATE fees
  SET paid_amount = v_total_paid,
      updated_at = timezone('utc', now())
  WHERE id = v_fee_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reconcile_fee_balance_insert
AFTER INSERT ON fee_payments
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_fee_balance();

CREATE TRIGGER trg_reconcile_fee_balance_update
AFTER UPDATE ON fee_payments
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_fee_balance();

-- 3. Marks Validation and Deterministic Calculation Trigger
CREATE OR REPLACE FUNCTION public.validate_and_calculate_marks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub RECORD;
  v_total NUMERIC(5,2);
  v_percentage NUMERIC(5,2);
BEGIN
  -- Fetch subject configured maximum marks
  SELECT max_internal_marks, max_midterm_marks, max_final_marks, max_practical_marks, total_max_marks
  INTO v_sub
  FROM subjects
  WHERE id = NEW.subject_id;

  -- Validate individual component bounds
  IF (NEW.internal_marks IS NOT NULL AND NEW.internal_marks > v_sub.max_internal_marks) THEN
    RAISE EXCEPTION 'Internal marks (%) exceed maximum configured limit (%).', NEW.internal_marks, v_sub.max_internal_marks;
  END IF;
  IF (NEW.midterm_marks IS NOT NULL AND NEW.midterm_marks > v_sub.max_midterm_marks) THEN
    RAISE EXCEPTION 'Midterm marks (%) exceed maximum configured limit (%).', NEW.midterm_marks, v_sub.max_midterm_marks;
  END IF;
  IF (NEW.final_marks IS NOT NULL AND NEW.final_marks > v_sub.max_final_marks) THEN
    RAISE EXCEPTION 'Final marks (%) exceed maximum configured limit (%).', NEW.final_marks, v_sub.max_final_marks;
  END IF;
  IF (NEW.practical_marks IS NOT NULL AND NEW.practical_marks > v_sub.max_practical_marks) THEN
    RAISE EXCEPTION 'Practical marks (%) exceed maximum configured limit (%).', NEW.practical_marks, v_sub.max_practical_marks;
  END IF;

  -- Calculate total and percentage
  v_total := COALESCE(NEW.internal_marks, 0) + 
             COALESCE(NEW.midterm_marks, 0) + 
             COALESCE(NEW.final_marks, 0) + 
             COALESCE(NEW.practical_marks, 0);

  IF v_sub.total_max_marks > 0 THEN
    v_percentage := ROUND((v_total / v_sub.total_max_marks) * 100, 2);
  ELSE
    v_percentage := 0.00;
  END IF;

  NEW.total_marks := v_total;
  NEW.percentage := v_percentage;

  -- Deterministic Grade Assignment
  NEW.grade := CASE
    WHEN v_percentage >= 90.0 THEN 'A+'
    WHEN v_percentage >= 80.0 THEN 'A'
    WHEN v_percentage >= 70.0 THEN 'B'
    WHEN v_percentage >= 60.0 THEN 'C'
    WHEN v_percentage >= 50.0 THEN 'D'
    ELSE 'F'
  END;

  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_and_calculate_marks
BEFORE INSERT OR UPDATE ON marks
FOR EACH ROW
EXECUTE FUNCTION public.validate_and_calculate_marks();

COMMIT;

-- >>> END: 20261011000007_create_business_triggers.sql <<<

-- >>> START: 20261011000008_create_composite_indexes.sql <<<
-- Migration: 20261011000008_create_composite_indexes.sql
-- Description: Composite and tenant-scoped B-tree indexes for fast queries and reports.

BEGIN;

-- 1. Profiles & Roles Indexes
CREATE INDEX idx_profiles_inst_role ON profiles(institution_id, role);
CREATE INDEX idx_profiles_inst_status ON profiles(institution_id, status);

-- 2. Academic Hierarchy Indexes
CREATE INDEX idx_departments_inst ON departments(institution_id);
CREATE INDEX idx_courses_inst_dept ON courses(institution_id, department_id);
CREATE INDEX idx_semesters_inst_course ON semesters(institution_id, course_id);
CREATE INDEX idx_sections_inst_sem ON sections(institution_id, semester_id);
CREATE INDEX idx_subjects_inst_course_sem ON subjects(institution_id, course_id, semester_id);

-- 3. Teachers & Students Indexes
CREATE INDEX idx_teachers_inst_dept ON teachers(institution_id, department_id);
CREATE INDEX idx_students_inst_filter ON students(institution_id, department_id, course_id, semester_id, section_id);
CREATE INDEX idx_students_inst_roll ON students(institution_id, roll_number);
CREATE INDEX idx_students_inst_admission ON students(institution_id, admission_number);
CREATE INDEX idx_teacher_subjects_lookup ON teacher_subjects(institution_id, teacher_id, section_id, subject_id);

-- 4. Attendance High-Volume Indexes
CREATE INDEX idx_attendance_inst_sec_sub_date ON attendance(institution_id, section_id, subject_id, date, period_number);
CREATE INDEX idx_attendance_inst_student_date ON attendance(institution_id, student_id, date);
CREATE INDEX idx_attendance_audit_lookup ON attendance_audit(institution_id, attendance_id);
CREATE INDEX idx_attendance_audit_student ON attendance_audit(institution_id, student_id);

-- 5. Fees & Payments Ledger Indexes
CREATE INDEX idx_fees_inst_student ON fees(institution_id, student_id);
CREATE INDEX idx_fee_payments_inst_fee ON fee_payments(institution_id, fee_id);
CREATE INDEX idx_fee_payments_inst_student ON fee_payments(institution_id, student_id);
CREATE INDEX idx_fee_payments_inst_date ON fee_payments(institution_id, payment_date);

-- 6. Marks Indexes
CREATE INDEX idx_marks_inst_student ON marks(institution_id, student_id);
CREATE INDEX idx_marks_inst_subject ON marks(institution_id, subject_id);

COMMIT;

-- >>> END: 20261011000008_create_composite_indexes.sql <<<

-- >>> START: 20261011000009_create_security_helpers.sql <<<
-- Migration: 20261011000009_create_security_helpers.sql
-- Description: Hardened SECURITY DEFINER authentication and role context helper functions.

BEGIN;

-- 1. Get Current User Context (id, institution_id, role, active)
CREATE OR REPLACE FUNCTION public.get_auth_context()
RETURNS TABLE (
  user_id UUID,
  inst_id UUID,
  user_role user_role,
  is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, institution_id, role, (status = 'active')
  FROM profiles
  WHERE id = auth.uid();
$$;

-- 2. Check if Current User is Active Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  );
$$;

-- 3. Check if Current User is Principal or Dean
CREATE OR REPLACE FUNCTION public.is_principal_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'principal') AND status = 'active'
  );
$$;

-- 4. Check if User is HOD of Given Department
CREATE OR REPLACE FUNCTION public.is_hod_of_department(p_department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM departments d
    JOIN profiles p ON p.id = auth.uid()
    WHERE d.id = p_department_id AND d.hod_id = p.id AND p.role = 'hod' AND p.status = 'active'
  );
$$;

-- 5. Check if User is Class Advisor of Given Section
CREATE OR REPLACE FUNCTION public.is_advisor_of_section(p_section_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM sections s
    JOIN profiles p ON p.id = auth.uid()
    WHERE s.id = p_section_id AND s.advisor_id = p.id AND p.status = 'active'
  );
$$;

-- 6. Check if Teacher is Assigned to Subject and Section
CREATE OR REPLACE FUNCTION public.is_assigned_teacher(p_subject_id UUID, p_section_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teacher_subjects ts
    JOIN profiles p ON p.id = auth.uid()
    WHERE ts.teacher_id = p.id
      AND ts.subject_id = p_subject_id
      AND ts.section_id = p_section_id
      AND p.status = 'active'
  );
$$;

-- 7. Revoke execution from PUBLIC and grant strictly to authenticated users
REVOKE EXECUTE ON FUNCTION public.get_auth_context() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_principal_or_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_hod_of_department(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_advisor_of_section(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_assigned_teacher(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_auth_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_principal_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hod_of_department(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_advisor_of_section(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_teacher(UUID, UUID) TO authenticated;

COMMIT;

-- >>> END: 20261011000009_create_security_helpers.sql <<<

-- >>> START: 20261011000010_enable_rls_and_policies.sql <<<
-- Migration: 20261011000010_enable_rls_and_policies.sql
-- Description: Enable Row Level Security (RLS) on all tables and apply granular role policies.

BEGIN;

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. INSTITUTIONS POLICIES
-- ============================================================================
CREATE POLICY "institutions_read_enrolled" ON institutions
  FOR SELECT TO authenticated
  USING (id IN (SELECT inst_id FROM public.get_auth_context()));

-- ============================================================================
-- 3. PROFILES POLICIES
-- ============================================================================
CREATE POLICY "profiles_select_policy" ON profiles
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      id = auth.uid() OR
      public.is_principal_or_admin() OR
      EXISTS (
        SELECT 1 FROM public.get_auth_context() ctx
        WHERE ctx.user_role IN ('teacher', 'hod')
      )
    )
  );

CREATE POLICY "profiles_update_policy" ON profiles
  FOR UPDATE TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      id = auth.uid() OR public.is_admin()
    )
  );

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 4. ACADEMIC STRUCTURE POLICIES (departments, courses, semesters, sections, subjects)
-- ============================================================================
CREATE POLICY "departments_read" ON departments
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT inst_id FROM public.get_auth_context()));

CREATE POLICY "departments_admin_all" ON departments
  FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "courses_read" ON courses
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT inst_id FROM public.get_auth_context()));

CREATE POLICY "courses_admin_all" ON courses
  FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "semesters_read" ON semesters
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT inst_id FROM public.get_auth_context()));

CREATE POLICY "semesters_admin_all" ON semesters
  FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "sections_read" ON sections
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT inst_id FROM public.get_auth_context()));

CREATE POLICY "sections_admin_all" ON sections
  FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "subjects_read" ON subjects
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT inst_id FROM public.get_auth_context()));

CREATE POLICY "subjects_admin_all" ON subjects
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 5. TEACHERS AND STUDENTS POLICIES
-- ============================================================================
CREATE POLICY "teachers_read" ON teachers
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT inst_id FROM public.get_auth_context()));

CREATE POLICY "teachers_admin_all" ON teachers
  FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "students_select_policy" ON students
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      id = auth.uid() OR
      public.is_principal_or_admin() OR
      public.is_hod_of_department(department_id) OR
      public.is_advisor_of_section(section_id) OR
      EXISTS (
        SELECT 1 FROM teacher_subjects ts
        WHERE ts.section_id = students.section_id AND ts.teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY "students_advisor_update" ON students
  FOR UPDATE TO authenticated
  USING (public.is_advisor_of_section(section_id));

CREATE POLICY "students_admin_all" ON students
  FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "teacher_subjects_read" ON teacher_subjects
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT inst_id FROM public.get_auth_context()));

CREATE POLICY "teacher_subjects_admin_all" ON teacher_subjects
  FOR ALL TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- 6. ATTENDANCE & AUDIT POLICIES
-- ============================================================================
CREATE POLICY "attendance_select_policy" ON attendance
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      student_id = auth.uid() OR
      public.is_principal_or_admin() OR
      public.is_advisor_of_section(section_id) OR
      public.is_assigned_teacher(subject_id, section_id) OR
      EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = attendance.student_id AND public.is_hod_of_department(s.department_id)
      )
    )
  );

CREATE POLICY "attendance_insert_policy" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      public.is_admin() OR
      public.is_assigned_teacher(subject_id, section_id) OR
      public.is_advisor_of_section(section_id)
    )
  );

CREATE POLICY "attendance_update_policy" ON attendance
  FOR UPDATE TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      public.is_admin() OR
      public.is_assigned_teacher(subject_id, section_id) OR
      public.is_advisor_of_section(section_id)
    )
  );

-- No DELETE policy on attendance
CREATE POLICY "attendance_no_delete" ON attendance
  FOR DELETE TO authenticated
  USING (false);

-- Attendance audit is view-only for authorized staff; modifications are rejected
CREATE POLICY "attendance_audit_select_policy" ON attendance_audit
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      public.is_principal_or_admin() OR
      public.is_assigned_teacher(subject_id, (SELECT section_id FROM students WHERE id = attendance_audit.student_id)) OR
      public.is_advisor_of_section((SELECT section_id FROM students WHERE id = attendance_audit.student_id)) OR
      EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = attendance_audit.student_id AND public.is_hod_of_department(s.department_id)
      )
    )
  );

CREATE POLICY "attendance_audit_no_update" ON attendance_audit
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "attendance_audit_no_delete" ON attendance_audit
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================================
-- 7. FEES & PAYMENT POLICIES (Append-Only Ledger)
-- ============================================================================
CREATE POLICY "fees_select_policy" ON fees
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      student_id = auth.uid() OR
      public.is_principal_or_admin()
    )
  );

CREATE POLICY "fees_admin_all" ON fees
  FOR ALL TO authenticated
  USING (public.is_admin());

CREATE POLICY "fee_payments_select_policy" ON fee_payments
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      student_id = auth.uid() OR
      public.is_principal_or_admin()
    )
  );

CREATE POLICY "fee_payments_insert_admin" ON fee_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND
    public.is_admin()
  );

CREATE POLICY "fee_payments_no_update" ON fee_payments
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "fee_payments_no_delete" ON fee_payments
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================================
-- 8. MARKS POLICIES
-- ============================================================================
CREATE POLICY "marks_select_policy" ON marks
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      student_id = auth.uid() OR
      public.is_principal_or_admin() OR
      EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = marks.student_id AND (
          public.is_hod_of_department(s.department_id) OR
          public.is_advisor_of_section(s.section_id) OR
          public.is_assigned_teacher(marks.subject_id, s.section_id)
        )
      )
    )
  );

CREATE POLICY "marks_insert_update_policy" ON marks
  FOR ALL TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      public.is_admin() OR
      EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = marks.student_id AND public.is_assigned_teacher(marks.subject_id, s.section_id)
      )
    )
  );

COMMIT;

-- >>> END: 20261011000010_enable_rls_and_policies.sql <<<

