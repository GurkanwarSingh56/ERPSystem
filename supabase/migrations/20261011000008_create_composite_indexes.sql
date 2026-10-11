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
