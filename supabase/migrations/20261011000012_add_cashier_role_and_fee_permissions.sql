-- Migration: 20261011000012_add_cashier_role_and_fee_permissions.sql
-- Description: Add dedicated cashier role, institution-scoped cashier fee policies, and transaction validation trigger.

-- 1. Add cashier to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cashier';
COMMIT;

BEGIN;

-- ============================================================================
-- 2. Security Helpers: Cashier Verification
-- ============================================================================
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
      AND role = 'cashier'
      AND status = 'active'
      AND institution_id = p_institution_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_cashier_of_institution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cashier_of_institution(UUID) TO authenticated;

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
      AND role IN ('admin', 'cashier')
      AND status = 'active'
      AND institution_id = p_institution_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_cashier_or_admin_of_institution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cashier_or_admin_of_institution(UUID) TO authenticated;

-- ============================================================================
-- 3. Update Profiles & Students Policies to Permit Same-Institution Cashier Lookups
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      id = auth.uid() OR
      public.is_principal_or_admin() OR
      public.is_cashier_of_institution(institution_id) OR
      EXISTS (
        SELECT 1 FROM public.get_auth_context() ctx
        WHERE ctx.user_role IN ('teacher', 'hod')
      )
    )
  );

DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_select_policy" ON public.students
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      id = auth.uid() OR
      public.is_principal_or_admin() OR
      public.is_cashier_of_institution(institution_id) OR
      public.is_hod_of_department(department_id) OR
      public.is_advisor_of_section(section_id) OR
      EXISTS (
        SELECT 1 FROM teacher_subjects ts
        WHERE ts.section_id = students.section_id AND ts.teacher_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- 4. Update Fees & Fee Payments Policies for Cashiers
-- ============================================================================
DROP POLICY IF EXISTS "fees_select_policy" ON public.fees;
CREATE POLICY "fees_select_policy" ON public.fees
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      student_id = auth.uid() OR
      public.is_principal_or_admin() OR
      public.is_cashier_of_institution(institution_id)
    )
  );

DROP POLICY IF EXISTS "fee_payments_select_policy" ON public.fee_payments;
CREATE POLICY "fee_payments_select_policy" ON public.fee_payments
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT inst_id FROM public.get_auth_context()) AND (
      student_id = auth.uid() OR
      public.is_principal_or_admin() OR
      public.is_cashier_of_institution(institution_id)
    )
  );

DROP POLICY IF EXISTS "fee_payments_insert_admin" ON public.fee_payments;
DROP POLICY IF EXISTS "fee_payments_insert_cashier_or_admin" ON public.fee_payments;
CREATE POLICY "fee_payments_insert_cashier_or_admin" ON public.fee_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_cashier_or_admin_of_institution(institution_id) AND
    (auth.uid() IS NULL OR recorded_by = auth.uid())
  );

-- Re-assert immutability
DROP POLICY IF EXISTS "fee_payments_no_update" ON public.fee_payments;
CREATE POLICY "fee_payments_no_update" ON public.fee_payments
  FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS "fee_payments_no_delete" ON public.fee_payments;
CREATE POLICY "fee_payments_no_delete" ON public.fee_payments
  FOR DELETE TO authenticated
  USING (false);

-- ============================================================================
-- 5. Business Trigger: Validate Payment Transactions & Auditable Reversals
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_fee_payment_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig RECORD;
BEGIN
  -- 1. Ensure recorded_by matches auth.uid() when invoked in authenticated context
  IF auth.uid() IS NOT NULL AND NEW.recorded_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access Denied: recorded_by must match authenticated caller.';
  END IF;

  -- 2. Validation for Completed Payment
  IF NEW.payment_status = 'completed' THEN
    IF NEW.reversed_payment_id IS NOT NULL THEN
      RAISE EXCEPTION 'Validation Error: Completed payment cannot reference a reversed_payment_id.';
    END IF;
  END IF;

  -- 3. Validation for Reversed Payment
  IF NEW.payment_status = 'reversed' THEN
    IF NEW.reversed_payment_id IS NULL THEN
      RAISE EXCEPTION 'Validation Error: Reversal payment must reference the original payment via reversed_payment_id.';
    END IF;

    -- Look up original payment
    SELECT id, institution_id, fee_id, student_id, amount, payment_status
    INTO v_orig
    FROM fee_payments
    WHERE id = NEW.reversed_payment_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Validation Error: Original payment record not found for reversal.';
    END IF;

    -- Cross-tenant reversal protection
    IF v_orig.institution_id IS DISTINCT FROM NEW.institution_id THEN
      RAISE EXCEPTION 'Access Denied: Cannot reverse a payment belonging to a different institution.';
    END IF;

    -- Structural consistency checks
    IF v_orig.fee_id IS DISTINCT FROM NEW.fee_id OR v_orig.student_id IS DISTINCT FROM NEW.student_id THEN
      RAISE EXCEPTION 'Validation Error: Reversal must match the fee and student of the original payment.';
    END IF;

    IF v_orig.payment_status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'Validation Error: Can only reverse a completed payment (original status is %).', v_orig.payment_status;
    END IF;

    IF NEW.amount IS DISTINCT FROM v_orig.amount THEN
      RAISE EXCEPTION 'Validation Error: Reversal amount (₹%) must exactly equal original payment amount (₹%).', NEW.amount, v_orig.amount;
    END IF;

    -- Duplicate reversal prevention
    IF EXISTS (
      SELECT 1 FROM fee_payments
      WHERE reversed_payment_id = NEW.reversed_payment_id
        AND payment_status = 'reversed'
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Validation Error: Original payment has already been reversed.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_fee_payment_transaction ON public.fee_payments;
CREATE TRIGGER trg_validate_fee_payment_transaction
BEFORE INSERT ON public.fee_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_fee_payment_transaction();

-- ============================================================================
-- 6. Reconcile Fee Balance Trigger Function: Add Underflow Check
-- ============================================================================
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

  -- Disallow negative balance or exceeding total fee
  IF v_total_paid < 0 THEN
    RAISE EXCEPTION 'Transaction Rejected: Net payments cannot be negative.';
  END IF;

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

COMMIT;
