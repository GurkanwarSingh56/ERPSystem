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
