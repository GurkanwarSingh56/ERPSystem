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
