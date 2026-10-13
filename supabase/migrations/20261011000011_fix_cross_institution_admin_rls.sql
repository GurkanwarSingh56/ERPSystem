-- Migration Proposal: 20261011000011_fix_cross_institution_admin_rls.sql
-- Description: Enforce strict institution isolation across all administrator policies, protect student advisor section bounds, and prevent unauthorized role/institution modification.
-- Status: PREPARED & REVIEWED — REQUIRES USER APPROVAL BEFORE REMOTE EXECUTION.
-- Target Database: ocqawmwlpexuvnsypobb.supabase.co

BEGIN;

-- ============================================================================
-- 1. Helper Function: Check if Authenticated User is Active Admin of Target Institution
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_of_institution(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status = 'active'
      AND institution_id = p_institution_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_of_institution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_of_institution(UUID) TO authenticated;

-- ============================================================================
-- 2. Hardening PROFILES Policies & Preventing Cross-Institution Transfers
-- ============================================================================
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;

CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (
    public.is_admin_of_institution(institution_id)
  )
  WITH CHECK (
    public.is_admin_of_institution(institution_id)
  );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;

CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (id = auth.uid()) OR public.is_admin_of_institution(institution_id)
  )
  WITH CHECK (
    institution_id IN (SELECT inst_id FROM public.get_auth_context())
  );

-- ============================================================================
-- 3. Hardening Trigger: Defensible Service-Role & Inactive Caller Verification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_user text;
  v_jwt_role text;
  caller_role user_role;
  caller_status user_status;
  caller_inst_id UUID;
BEGIN
  -- NOTE ON EXECUTION CONTEXT:
  -- In a PostgreSQL SECURITY DEFINER function, current_user evaluates to the function owner (postgres).
  -- Therefore, current_user MUST NEVER be used to authorize trusted execution.
  -- Instead, session_user identifies the genuine invoking database role.
  v_session_user := session_user;
  
  -- When invoked via PostgREST / Supabase API, session_user is 'authenticator'.
  -- The verified JWT payload parsed from the cryptographically verified bearer token is returned by auth.jwt().
  -- We strictly inspect (auth.jwt() ->> 'role') without relying on raw or caller-manipulable settings.
  v_jwt_role := (auth.jwt() ->> 'role');

  -- Trusted server-side execution:
  -- Direct database superuser/maintenance sessions (session_user in postgres, supabase_admin)
  -- OR genuine PostgREST calls using the secret service_role key verified by Supabase Auth.
  IF v_session_user IN ('postgres', 'supabase_admin') OR v_jwt_role = 'service_role' THEN
    NEW.updated_at := timezone('utc', now());
    RETURN NEW;
  END IF;

  -- Untrusted / Anonymous context:
  -- If auth.uid() is null and this is not a verified service_role or database owner, reject.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access Denied: Unauthenticated modification of profiles is prohibited.';
  END IF;

  -- Determine role, status, and institution of the authenticated caller
  SELECT role, status, institution_id 
  INTO caller_role, caller_status, caller_inst_id 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- If caller profile is missing, inactive, or not an admin, block protected field changes
  IF (caller_role IS DISTINCT FROM 'admin' OR caller_status IS DISTINCT FROM 'active') THEN
    IF (NEW.role IS DISTINCT FROM OLD.role) OR 
       (NEW.status IS DISTINCT FROM OLD.status) OR 
       (NEW.institution_id IS DISTINCT FROM OLD.institution_id) THEN
      RAISE EXCEPTION 'Access Denied: Only active administrators can modify roles or account status.';
    END IF;
  END IF;

  -- Crucial tenant immutability:
  -- No authenticated user (including campus administrators) can change an existing profile's institution_id
  IF (NEW.institution_id IS DISTINCT FROM OLD.institution_id) THEN
    RAISE EXCEPTION 'Access Denied: Institution affiliation is immutable once provisioned.';
  END IF;
  
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. Hardening Remaining Tenanted Tables
-- ============================================================================

-- Departments
DROP POLICY IF EXISTS "departments_admin_all" ON public.departments;
CREATE POLICY "departments_admin_all" ON public.departments
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Courses
DROP POLICY IF EXISTS "courses_admin_all" ON public.courses;
CREATE POLICY "courses_admin_all" ON public.courses
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Semesters
DROP POLICY IF EXISTS "semesters_admin_all" ON public.semesters;
CREATE POLICY "semesters_admin_all" ON public.semesters
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Sections
DROP POLICY IF EXISTS "sections_admin_all" ON public.sections;
CREATE POLICY "sections_admin_all" ON public.sections
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Subjects
DROP POLICY IF EXISTS "subjects_admin_all" ON public.subjects;
CREATE POLICY "subjects_admin_all" ON public.subjects
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Teachers
DROP POLICY IF EXISTS "teachers_admin_all" ON public.teachers;
CREATE POLICY "teachers_admin_all" ON public.teachers
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Students
DROP POLICY IF EXISTS "students_admin_all" ON public.students;
CREATE POLICY "students_admin_all" ON public.students
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Student Advisor Update (Enforces section retention and institution check)
DROP POLICY IF EXISTS "students_advisor_update" ON public.students;
CREATE POLICY "students_advisor_update" ON public.students
  FOR UPDATE TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context())
    AND public.is_advisor_of_section(section_id)
  )
  WITH CHECK (
    institution_id IN (SELECT inst_id FROM public.get_auth_context())
    AND public.is_advisor_of_section(section_id)
  );

-- Teacher Subjects
DROP POLICY IF EXISTS "teacher_subjects_admin_all" ON public.teacher_subjects;
CREATE POLICY "teacher_subjects_admin_all" ON public.teacher_subjects
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Fees
DROP POLICY IF EXISTS "fees_admin_all" ON public.fees;
CREATE POLICY "fees_admin_all" ON public.fees
  FOR ALL TO authenticated
  USING (public.is_admin_of_institution(institution_id))
  WITH CHECK (public.is_admin_of_institution(institution_id));

-- Fee Payments (Append-Only ledger: admin insert scoped to institution)
DROP POLICY IF EXISTS "fee_payments_insert_admin" ON public.fee_payments;
CREATE POLICY "fee_payments_insert_admin" ON public.fee_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_of_institution(institution_id)
  );

-- Marks (Insert/Update scoped to institution admin)
DROP POLICY IF EXISTS "marks_insert_update_policy" ON public.marks;
CREATE POLICY "marks_insert_update_policy" ON public.marks
  FOR ALL TO authenticated
  USING (
    (public.is_admin_of_institution(institution_id)) OR
    (
      institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND
      EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = marks.student_id AND public.is_assigned_teacher(marks.subject_id, s.section_id)
      )
    )
  )
  WITH CHECK (
    (public.is_admin_of_institution(institution_id)) OR
    (
      institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND
      EXISTS (
        SELECT 1 FROM students s
        WHERE s.id = marks.student_id AND public.is_assigned_teacher(marks.subject_id, s.section_id)
      )
    )
  );

-- Attendance Insert (Scoped to institution admin, assigned teacher, or section advisor)
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
CREATE POLICY "attendance_insert_policy" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin_of_institution(institution_id)) OR
    (
      institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
        public.is_assigned_teacher(subject_id, section_id) OR
        public.is_advisor_of_section(section_id)
      )
    )
  );

-- Attendance Update (Scoped to institution admin, assigned teacher, or section advisor)
DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
CREATE POLICY "attendance_update_policy" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    (public.is_admin_of_institution(institution_id)) OR
    (
      institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
        public.is_assigned_teacher(subject_id, section_id) OR
        public.is_advisor_of_section(section_id)
      )
    )
  )
  WITH CHECK (
    (public.is_admin_of_institution(institution_id)) OR
    (
      institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
        public.is_assigned_teacher(subject_id, section_id) OR
        public.is_advisor_of_section(section_id)
      )
    )
  );

COMMIT;
