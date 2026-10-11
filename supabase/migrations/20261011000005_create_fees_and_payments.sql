-- Migration: 20261011000005_create_fees_and_payments.sql
-- Description: Fees and fee_payments ledger with composite student foreign key and idempotency tracking.

BEGIN;

-- 1. Fees Table (Student Fee Master)
CREATE TABLE fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL,
  academic_year TEXT NOT NULL,
  total_fee NUMERIC(12,2) NOT NULL CHECK (total_fee >= 0),
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  pending_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_fee - paid_amount) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_fees_student FOREIGN KEY (institution_id, student_id)
    REFERENCES students(institution_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_fees_student_year UNIQUE (institution_id, student_id, academic_year),
  CONSTRAINT uq_fees_inst_student_id UNIQUE (institution_id, student_id, id)
);

-- 2. Fee Payments Table (Immutable Financial Transaction Ledger)
CREATE TABLE fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  fee_id UUID NOT NULL,
  student_id UUID NOT NULL,
  receipt_number TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'completed',
  reference_number TEXT NULL,
  remarks TEXT NULL,
  recorded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reversed_payment_id UUID NULL REFERENCES fee_payments(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT fk_fee_payments_fee_student FOREIGN KEY (institution_id, student_id, fee_id)
    REFERENCES fees(institution_id, student_id, id) ON DELETE RESTRICT,
  CONSTRAINT uq_fee_payments_inst_receipt UNIQUE (institution_id, receipt_number),
  CONSTRAINT uq_fee_payments_inst_idempotency UNIQUE (institution_id, idempotency_key)
);

COMMIT;
