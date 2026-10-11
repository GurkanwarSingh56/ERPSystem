-- Down Migration: 20261011000010_enable_rls_and_policies.down.sql
-- Description: Revert RLS policies and disable RLS across all tables.

BEGIN;

-- 1. Drop Marks Policies
DROP POLICY IF EXISTS "marks_insert_update_policy" ON marks;
DROP POLICY IF EXISTS "marks_select_policy" ON marks;

-- 2. Drop Fee Payments Policies
DROP POLICY IF EXISTS "fee_payments_no_delete" ON fee_payments;
DROP POLICY IF EXISTS "fee_payments_no_update" ON fee_payments;
DROP POLICY IF EXISTS "fee_payments_insert_admin" ON fee_payments;
DROP POLICY IF EXISTS "fee_payments_select_policy" ON fee_payments;

-- 3. Drop Fees Policies
DROP POLICY IF EXISTS "fees_admin_all" ON fees;
DROP POLICY IF EXISTS "fees_select_policy" ON fees;

-- 4. Drop Attendance Audit Policies
DROP POLICY IF EXISTS "attendance_audit_no_delete" ON attendance_audit;
DROP POLICY IF EXISTS "attendance_audit_no_update" ON attendance_audit;
DROP POLICY IF EXISTS "attendance_audit_select_policy" ON attendance_audit;

-- 5. Drop Attendance Policies
DROP POLICY IF EXISTS "attendance_no_delete" ON attendance;
DROP POLICY IF EXISTS "attendance_update_policy" ON attendance;
DROP POLICY IF EXISTS "attendance_insert_policy" ON attendance;
DROP POLICY IF EXISTS "attendance_select_policy" ON attendance;

-- 6. Drop Teacher Subjects Policies
DROP POLICY IF EXISTS "teacher_subjects_admin_all" ON teacher_subjects;
DROP POLICY IF EXISTS "teacher_subjects_read" ON teacher_subjects;

-- 7. Drop Students Policies
DROP POLICY IF EXISTS "students_admin_all" ON students;
DROP POLICY IF EXISTS "students_advisor_update" ON students;
DROP POLICY IF EXISTS "students_select_policy" ON students;

-- 8. Drop Teachers Policies
DROP POLICY IF EXISTS "teachers_admin_all" ON teachers;
DROP POLICY IF EXISTS "teachers_read" ON teachers;

-- 9. Drop Academic Structure Policies
DROP POLICY IF EXISTS "subjects_admin_all" ON subjects;
DROP POLICY IF EXISTS "subjects_read" ON subjects;
DROP POLICY IF EXISTS "sections_admin_all" ON sections;
DROP POLICY IF EXISTS "sections_read" ON sections;
DROP POLICY IF EXISTS "semesters_admin_all" ON semesters;
DROP POLICY IF EXISTS "semesters_read" ON semesters;
DROP POLICY IF EXISTS "courses_admin_all" ON courses;
DROP POLICY IF EXISTS "courses_read" ON courses;
DROP POLICY IF EXISTS "departments_admin_all" ON departments;
DROP POLICY IF EXISTS "departments_read" ON departments;

-- 10. Drop Profiles Policies
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;

-- 11. Drop Institutions Policies
DROP POLICY IF EXISTS "institutions_read_enrolled" ON institutions;

-- 12. Disable RLS
ALTER TABLE marks DISABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_audit DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE semesters DISABLE ROW LEVEL SECURITY;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE institutions DISABLE ROW LEVEL SECURITY;

COMMIT;
