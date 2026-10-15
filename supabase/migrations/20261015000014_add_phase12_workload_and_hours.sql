-- Migration 20261015000014_add_phase12_workload_and_hours.sql
-- Supports Phase 12 Four-Step College Academic Data Import Wizard:
-- 1. min_load and max_load in weekly hours for teachers
-- 2. weekly_hours in subjects for curriculum scheduling

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS min_load integer NOT NULL DEFAULT 12 CHECK (min_load >= 0),
ADD COLUMN IF NOT EXISTS max_load integer NOT NULL DEFAULT 18 CHECK (max_load > 0),
ADD CONSTRAINT teachers_load_check CHECK (min_load <= max_load);

ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS weekly_hours integer NOT NULL DEFAULT 4 CHECK (weekly_hours > 0);

COMMENT ON COLUMN public.teachers.min_load IS 'Minimum weekly teaching hours/load';
COMMENT ON COLUMN public.teachers.max_load IS 'Maximum weekly teaching hours/load';
COMMENT ON COLUMN public.subjects.weekly_hours IS 'Weekly contact / teaching hours';
