-- Migration: 20261019000018_enhance_attendance_audit_trigger.sql
-- Description: Ensure attendance audit trigger safely handles both authenticated sessions and server-side updates with COALESCE(auth.uid(), NEW.marked_by).

BEGIN;

CREATE OR REPLACE FUNCTION public.log_attendance_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO attendance_audit (
      institution_id,
      attendance_id,
      student_id,
      subject_id,
      previous_status,
      new_status,
      changed_by,
      reason,
      created_at
    ) VALUES (
      OLD.institution_id,
      OLD.id,
      OLD.student_id,
      OLD.subject_id,
      OLD.status,
      NEW.status,
      COALESCE(auth.uid(), NEW.marked_by),
      COALESCE(NULLIF(trim(NEW.remarks), ''), 'Status update recorded'),
      timezone('utc', now())
    );
  END IF;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

COMMIT;
