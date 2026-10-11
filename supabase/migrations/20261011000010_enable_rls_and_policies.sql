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
