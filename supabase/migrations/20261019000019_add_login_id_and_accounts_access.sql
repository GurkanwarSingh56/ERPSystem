-- Migration: 20261019000019_add_login_id_and_accounts_access.sql
-- Description: Add unique login_id, must_change_password, and can_access_accounts to profiles,
-- and update cashier security helpers to respect explicit accounts permissions.

BEGIN;

-- 1. Add columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_access_accounts BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Case-insensitive unique constraint per institution for login_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_inst_login_id
  ON public.profiles (institution_id, lower(login_id))
  WHERE login_id IS NOT NULL;

-- 3. Update Cashier Verification to recognize staff with explicit accounts access
CREATE OR REPLACE FUNCTION public.is_cashier_of_institution(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role = 'cashier' OR can_access_accounts = true)
      AND status = 'active'
      AND institution_id = p_institution_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_cashier_or_admin_of_institution(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role IN ('admin', 'cashier') OR can_access_accounts = true)
      AND status = 'active'
      AND institution_id = p_institution_id
  );
$$;

COMMIT;
