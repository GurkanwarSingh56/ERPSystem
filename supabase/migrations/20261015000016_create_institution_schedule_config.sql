-- Migration 20261015000016_create_institution_schedule_config.sql
-- Supports Phase 14 College Timetable Configuration

CREATE TABLE IF NOT EXISTS public.institution_schedule_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  college_opens_at time NOT NULL DEFAULT '09:00:00',
  college_closes_at time NOT NULL DEFAULT '16:30:00',
  period_duration_minutes integer NOT NULL DEFAULT 50 CHECK (period_duration_minutes > 0),
  recess_starts_at time NOT NULL DEFAULT '12:20:00',
  recess_duration_minutes integer NOT NULL DEFAULT 50 CHECK (recess_duration_minutes >= 0),
  working_days text[] NOT NULL DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_inst_sched_config UNIQUE (institution_id, academic_year)
);

ALTER TABLE public.institution_schedule_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inst_sched_config_admin_all" ON public.institution_schedule_configs
  FOR ALL
  TO authenticated
  USING (is_admin_of_institution(institution_id))
  WITH CHECK (is_admin_of_institution(institution_id));

CREATE POLICY "inst_sched_config_read" ON public.institution_schedule_configs
  FOR SELECT
  TO authenticated
  USING (institution_id IN (SELECT inst_id FROM get_auth_context()));
