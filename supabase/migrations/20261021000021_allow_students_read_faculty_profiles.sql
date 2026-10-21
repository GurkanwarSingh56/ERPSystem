-- Migration: 20261021000021_allow_students_read_faculty_profiles.sql
-- Description: Allow authenticated users (including students) within an institution to read teacher, HOD, and principal profiles for timetables and course listings.

BEGIN;

ALTER POLICY "profiles_select_policy" ON profiles
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      id = auth.uid() OR
      public.is_principal_or_admin() OR
      role IN ('teacher', 'hod', 'principal') OR
      EXISTS (
        SELECT 1 FROM public.get_auth_context() ctx
        WHERE ctx.user_role IN ('teacher', 'hod')
      )
    )
  );

COMMIT;
