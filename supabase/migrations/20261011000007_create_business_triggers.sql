-- Migration: 20261011000007_create_business_triggers.sql
-- Description: Business logic triggers for attendance auditing, fee reconciliation, and marks grading.

BEGIN;

-- 1. Attendance Audit Log Trigger Function
CREATE OR REPLACE FUNCTION public.log_attendance_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only log if the attendance status was modified
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
      auth.uid(),
      COALESCE(NULLIF(trim(NEW.remarks), ''), 'Status update recorded'),
      timezone('utc', now())
    );
  END IF;
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_attendance_audit
BEFORE UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION public.log_attendance_audit();

-- 2. Fee Reconciliation Ledger Trigger Function
CREATE OR REPLACE FUNCTION public.reconcile_fee_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fee_id UUID;
  v_total_paid NUMERIC(12,2);
  v_fee_total NUMERIC(12,2);
BEGIN
  v_fee_id := COALESCE(NEW.fee_id, OLD.fee_id);

  -- Reconcile net payments: completed minus reversed
  SELECT 
    COALESCE(SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END), 0.00) -
    COALESCE(SUM(CASE WHEN payment_status = 'reversed' THEN amount ELSE 0 END), 0.00)
  INTO v_total_paid
  FROM fee_payments
  WHERE fee_id = v_fee_id;

  SELECT total_fee INTO v_fee_total FROM fees WHERE id = v_fee_id;

  -- Disallow exceeding total fee
  IF v_total_paid > v_fee_total THEN
    RAISE EXCEPTION 'Transaction Rejected: Total payments (₹%) exceed the total required fee balance (₹%).', v_total_paid, v_fee_total;
  END IF;

  -- Synchronize fee master record
  UPDATE fees
  SET paid_amount = v_total_paid,
      updated_at = timezone('utc', now())
  WHERE id = v_fee_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reconcile_fee_balance_insert
AFTER INSERT ON fee_payments
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_fee_balance();

CREATE TRIGGER trg_reconcile_fee_balance_update
AFTER UPDATE ON fee_payments
FOR EACH ROW
EXECUTE FUNCTION public.reconcile_fee_balance();

-- 3. Marks Validation and Deterministic Calculation Trigger
CREATE OR REPLACE FUNCTION public.validate_and_calculate_marks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sub RECORD;
  v_total NUMERIC(5,2);
  v_percentage NUMERIC(5,2);
BEGIN
  -- Fetch subject configured maximum marks
  SELECT max_internal_marks, max_midterm_marks, max_final_marks, max_practical_marks, total_max_marks
  INTO v_sub
  FROM subjects
  WHERE id = NEW.subject_id;

  -- Validate individual component bounds
  IF (NEW.internal_marks IS NOT NULL AND NEW.internal_marks > v_sub.max_internal_marks) THEN
    RAISE EXCEPTION 'Internal marks (%) exceed maximum configured limit (%).', NEW.internal_marks, v_sub.max_internal_marks;
  END IF;
  IF (NEW.midterm_marks IS NOT NULL AND NEW.midterm_marks > v_sub.max_midterm_marks) THEN
    RAISE EXCEPTION 'Midterm marks (%) exceed maximum configured limit (%).', NEW.midterm_marks, v_sub.max_midterm_marks;
  END IF;
  IF (NEW.final_marks IS NOT NULL AND NEW.final_marks > v_sub.max_final_marks) THEN
    RAISE EXCEPTION 'Final marks (%) exceed maximum configured limit (%).', NEW.final_marks, v_sub.max_final_marks;
  END IF;
  IF (NEW.practical_marks IS NOT NULL AND NEW.practical_marks > v_sub.max_practical_marks) THEN
    RAISE EXCEPTION 'Practical marks (%) exceed maximum configured limit (%).', NEW.practical_marks, v_sub.max_practical_marks;
  END IF;

  -- Calculate total and percentage
  v_total := COALESCE(NEW.internal_marks, 0) + 
             COALESCE(NEW.midterm_marks, 0) + 
             COALESCE(NEW.final_marks, 0) + 
             COALESCE(NEW.practical_marks, 0);

  IF v_sub.total_max_marks > 0 THEN
    v_percentage := ROUND((v_total / v_sub.total_max_marks) * 100, 2);
  ELSE
    v_percentage := 0.00;
  END IF;

  NEW.total_marks := v_total;
  NEW.percentage := v_percentage;

  -- Deterministic Grade Assignment
  NEW.grade := CASE
    WHEN v_percentage >= 90.0 THEN 'A+'
    WHEN v_percentage >= 80.0 THEN 'A'
    WHEN v_percentage >= 70.0 THEN 'B'
    WHEN v_percentage >= 60.0 THEN 'C'
    WHEN v_percentage >= 50.0 THEN 'D'
    ELSE 'F'
  END;

  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_and_calculate_marks
BEFORE INSERT OR UPDATE ON marks
FOR EACH ROW
EXECUTE FUNCTION public.validate_and_calculate_marks();

COMMIT;
