"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";

export type FeePaymentMethod = "cash" | "cheque" | "bank_transfer" | "upi" | "demand_draft";

export interface RecordOfflinePaymentInput {
  feeId: string;
  studentId: string;
  amount: number;
  paymentMethod: FeePaymentMethod;
  receiptNumber: string;
  idempotencyKey?: string;
  paymentDate?: string;
  referenceNumber?: string;
  remarks?: string;
}

export interface ReversePaymentInput {
  originalPaymentId: string;
  feeId: string;
  studentId: string;
  amount: number;
  receiptNumber: string;
  idempotencyKey?: string;
  remarks: string;
}

export type FeeActionResponse = {
  success: boolean;
  error?: string;
  paymentId?: string;
  receiptNumber?: string;
};

export interface CreateFeeAllocationInput {
  studentId: string;
  academicYear: string;
  totalFee: number;
}

export interface UpdateFeeAllocationInput {
  feeId: string;
  totalFee: number;
}

export type FeeAllocationActionResponse = {
  success: boolean;
  error?: string;
  feeId?: string;
  totalFee?: number;
  paidAmount?: number;
  pendingAmount?: number;
};

export interface FeeReceiptData {
  paymentId: string;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: "completed" | "reversed" | "failed";
  referenceNumber: string | null;
  remarks: string | null;
  reversedPaymentId: string | null;
  reversedReceiptNumber?: string | null;
  createdAt: string;

  // Student Details
  studentId: string;
  studentName: string;
  studentEmail: string;
  rollNumber: string;
  admissionNumber: string;
  departmentName: string | null;
  courseName: string | null;

  // Fee Structure Context
  feeId: string;
  academicYear: string;
  totalFee: number;
  totalPaidToDate: number;
  pendingBalance: number;

  // Issuer / Institution Context
  institutionName: string;
  cashierName: string;
}

export type FeeReceiptResponse = {
  success: boolean;
  error?: string;
  data?: FeeReceiptData;
};



const VALID_PAYMENT_METHODS: readonly FeePaymentMethod[] = [
  "cash",
  "cheque",
  "bank_transfer",
  "upi",
  "demand_draft",
];

/**
 * Server Action: Record Verified Offline Fee Payment.
 * Strictly restricted to Cashier and Administrator roles.
 * Derives institution_id and recorded_by from the authenticated profile.
 */
export async function recordOfflinePaymentAction(
  input: RecordOfflinePaymentInput
): Promise<FeeActionResponse> {
  try {
    const caller = await requireRole(["cashier", "admin"]);

    if (!input.feeId || !input.studentId) {
      return { success: false, error: "Fee ID and Student ID are required." };
    }

    if (typeof input.amount !== "number" || input.amount <= 0 || isNaN(input.amount)) {
      return { success: false, error: "Payment amount must be a positive number." };
    }

    if (!VALID_PAYMENT_METHODS.includes(input.paymentMethod)) {
      return {
        success: false,
        error: `Invalid payment method. Supported offline methods: ${VALID_PAYMENT_METHODS.join(", ")}`,
      };
    }

    const trimmedReceipt = input.receiptNumber?.trim();
    if (!trimmedReceipt) {
      return { success: false, error: "Receipt number is required for offline payments." };
    }

    const idempotencyKey =
      input.idempotencyKey?.trim() || `IDEM-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const paymentDate = input.paymentDate || new Date().toISOString().split("T")[0];

    const supabase = await createClient();

    // Insert payment ledger row via RLS
    const { data: payment, error } = await supabase
      .from("fee_payments")
      .insert({
        institution_id: caller.institutionId,
        fee_id: input.feeId,
        student_id: input.studentId,
        amount: input.amount,
        payment_method: input.paymentMethod,
        payment_status: "completed",
        receipt_number: trimmedReceipt,
        idempotency_key: idempotencyKey,
        payment_date: paymentDate,
        reference_number: input.referenceNumber?.trim() || null,
        remarks: input.remarks?.trim() || "Offline fee collection verified by cashier",
        recorded_by: caller.userId,
      })
      .select("id, receipt_number")
      .single();

    if (error || !payment) {
      return {
        success: false,
        error: error?.message || "Failed to record payment in ledger.",
      };
    }

    revalidatePath("/dashboard/cashier");
    revalidatePath("/dashboard/student");

    return {
      success: true,
      paymentId: payment.id,
      receiptNumber: payment.receipt_number,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected authorization error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Server Action: Process Auditable Fee Payment Reversal.
 * Strictly restricted to Cashier and Administrator roles.
 * Maintains full audit trail by inserting a linked reversal record.
 */
export async function reversePaymentAction(
  input: ReversePaymentInput
): Promise<FeeActionResponse> {
  try {
    const caller = await requireRole(["cashier", "admin"]);

    if (!input.originalPaymentId || !input.feeId || !input.studentId) {
      return { success: false, error: "Original payment, Fee ID, and Student ID are required." };
    }

    if (typeof input.amount !== "number" || input.amount <= 0 || isNaN(input.amount)) {
      return { success: false, error: "Reversal amount must be a positive number matching the original payment." };
    }

    const trimmedReceipt = input.receiptNumber?.trim();
    if (!trimmedReceipt) {
      return { success: false, error: "Reversal receipt number is required." };
    }

    const idempotencyKey =
      input.idempotencyKey?.trim() || `REV-IDEM-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const supabase = await createClient();

    // Verify original payment exists within caller's institution
    const { data: origPayment, error: fetchErr } = await supabase
      .from("fee_payments")
      .select("id, institution_id, amount, payment_status")
      .eq("id", input.originalPaymentId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (fetchErr || !origPayment) {
      return {
        success: false,
        error: "Original payment record not found or belongs to a different institution.",
      };
    }

    if (origPayment.payment_status !== "completed") {
      return {
        success: false,
        error: `Cannot reverse payment: original status is '${origPayment.payment_status}'.`,
      };
    }

    if (Number(origPayment.amount) !== input.amount) {
      return {
        success: false,
        error: `Reversal amount (${input.amount}) does not match original payment (${origPayment.amount}).`,
      };
    }

    // Insert reversal ledger entry via RLS
    const { data: reversal, error: revErr } = await supabase
      .from("fee_payments")
      .insert({
        institution_id: caller.institutionId,
        fee_id: input.feeId,
        student_id: input.studentId,
        amount: input.amount,
        payment_method: "cash",
        payment_status: "reversed",
        receipt_number: trimmedReceipt,
        idempotency_key: idempotencyKey,
        reversed_payment_id: input.originalPaymentId,
        remarks: input.remarks?.trim() || "Payment reversal authorized by cashier",
        recorded_by: caller.userId,
      })
      .select("id, receipt_number")
      .single();

    if (revErr || !reversal) {
      return {
        success: false,
        error: revErr?.message || "Failed to record reversal in ledger.",
      };
    }

    revalidatePath("/dashboard/cashier");
    revalidatePath("/dashboard/student");

    return {
      success: true,
      paymentId: reversal.id,
      receiptNumber: reversal.receipt_number,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected authorization error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Server Action: Create Fee Allocation for a Student.
 * Strictly restricted to Administrator role.
 * Derives institution_id from the verified authenticated administrator profile.
 * Enforces non-negative total fee, valid student check, and duplicate prevention.
 */
export async function createFeeAllocationAction(
  input: CreateFeeAllocationInput
): Promise<FeeAllocationActionResponse> {
  try {
    const caller = await requireRole(["admin"]);

    if (!input.studentId || typeof input.studentId !== "string" || !input.studentId.trim()) {
      return { success: false, error: "A valid student selection is required." };
    }

    const academicYear = input.academicYear?.trim();
    if (!academicYear) {
      return { success: false, error: "Academic year is required (e.g. 2026-27)." };
    }

    if (typeof input.totalFee !== "number" || isNaN(input.totalFee) || input.totalFee < 0) {
      return { success: false, error: "Total fee amount must be a non-negative number." };
    }

    const supabase = await createClient();

    // Verify student exists and belongs to the same institution
    const { data: studentRecord, error: studentErr } = await supabase
      .from("students")
      .select("id, institution_id")
      .eq("id", input.studentId.trim())
      .eq("institution_id", caller.institutionId)
      .maybeSingle();

    if (studentErr || !studentRecord) {
      return {
        success: false,
        error: "Selected student record not found within your institution.",
      };
    }

    // Insert fee allocation via RLS (governed by fees_admin_all)
    const { data: newFee, error: insertErr } = await supabase
      .from("fees")
      .insert({
        institution_id: caller.institutionId,
        student_id: input.studentId.trim(),
        academic_year: academicYear,
        total_fee: input.totalFee,
        paid_amount: 0,
      })
      .select("id, total_fee, paid_amount, pending_amount")
      .single();

    if (insertErr || !newFee) {
      if (insertErr?.code === "23505" || insertErr?.message?.includes("uq_fees_student_year")) {
        return {
          success: false,
          error: `A fee allocation already exists for this student in academic year '${academicYear}'.`,
        };
      }
      return {
        success: false,
        error: insertErr?.message || "Failed to create student fee allocation.",
      };
    }

    revalidatePath("/dashboard/admin/fees");
    revalidatePath("/dashboard/cashier");
    revalidatePath("/dashboard/student/fees");

    return {
      success: true,
      feeId: newFee.id,
      totalFee: Number(newFee.total_fee),
      paidAmount: Number(newFee.paid_amount),
      pendingAmount: Number(newFee.pending_amount),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected authorization error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Server Action: Safely Update Existing Fee Allocation Total.
 * Strictly restricted to Administrator role.
 * Financial Safeguards Enforced:
 * 1. Checks that fee belongs to caller's verified institution.
 * 2. Total fee must be a valid, non-negative number.
 * 3. Total fee CANNOT be reduced below what has already been paid (new total_fee >= paid_amount).
 * 4. Never touches paid_amount manually; preserves ledger triggers and balances.
 */
export async function updateFeeAllocationAction(
  input: UpdateFeeAllocationInput
): Promise<FeeAllocationActionResponse> {
  try {
    const caller = await requireRole(["admin"]);

    if (!input.feeId || typeof input.feeId !== "string" || !input.feeId.trim()) {
      return { success: false, error: "Fee ID is required." };
    }

    if (typeof input.totalFee !== "number" || isNaN(input.totalFee) || input.totalFee < 0) {
      return { success: false, error: "Total fee amount must be a non-negative number." };
    }

    const supabase = await createClient();

    // Fetch existing fee allocation to verify tenant ownership and current paid balance
    const { data: existingFee, error: fetchErr } = await supabase
      .from("fees")
      .select("id, institution_id, student_id, academic_year, total_fee, paid_amount, pending_amount")
      .eq("id", input.feeId.trim())
      .eq("institution_id", caller.institutionId)
      .maybeSingle();

    if (fetchErr || !existingFee) {
      return {
        success: false,
        error: "Fee allocation record not found within your institution.",
      };
    }

    const currentPaid = Number(existingFee.paid_amount || 0);

    // Financial safeguard: Cannot reduce total fee below the amount already collected
    if (input.totalFee < currentPaid) {
      return {
        success: false,
        error: `Cannot reduce total fee to ₹${input.totalFee.toLocaleString("en-IN")} because ₹${currentPaid.toLocaleString("en-IN")} has already been paid. Total fee cannot be less than collected amount.`,
      };
    }

    // Update total_fee only; paid_amount is preserved and triggers compute pending_amount automatically
    const { data: updatedFee, error: updateErr } = await supabase
      .from("fees")
      .update({
        total_fee: input.totalFee,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingFee.id)
      .eq("institution_id", caller.institutionId)
      .select("id, total_fee, paid_amount, pending_amount")
      .single();

    if (updateErr || !updatedFee) {
      return {
        success: false,
        error: updateErr?.message || "Failed to update fee allocation.",
      };
    }

    revalidatePath("/dashboard/admin/fees");
    revalidatePath("/dashboard/cashier");
    revalidatePath("/dashboard/student/fees");

    return {
      success: true,
      feeId: updatedFee.id,
      totalFee: Number(updatedFee.total_fee),
      paidAmount: Number(updatedFee.paid_amount),
      pendingAmount: Number(updatedFee.pending_amount),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected authorization error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Server Action: Fetch Verified Official Payment Receipt.
 * Authorization Rules:
 * - Allowed Roles: student (self only), cashier (same institution), admin (same institution).
 * - Enforces campus boundary via caller.institutionId.
 * - If caller is a student, verifies payment belongs to caller.userId.
 * - Returns structured, sanitized receipt metadata for rendering and printing.
 */
export async function getPaymentReceiptAction(
  paymentId: string
): Promise<FeeReceiptResponse> {
  try {
    const caller = await requireRole(["student", "cashier", "admin"]);

    if (!paymentId || typeof paymentId !== "string" || !paymentId.trim()) {
      return { success: false, error: "Payment identifier is required." };
    }

    const supabase = await createClient();

    // 1. Fetch payment record scoped to caller's institution
    const { data: payment, error: payErr } = await supabase
      .from("fee_payments")
      .select(`
        id,
        institution_id,
        fee_id,
        student_id,
        receipt_number,
        amount,
        payment_date,
        payment_method,
        payment_status,
        reference_number,
        remarks,
        recorded_by,
        reversed_payment_id,
        created_at,
        institutions!fee_payments_institution_id_fkey(
          name
        ),
        profiles!fee_payments_recorded_by_fkey(
          full_name
        )
      `)
      .eq("id", paymentId.trim())
      .eq("institution_id", caller.institutionId)
      .maybeSingle();

    if (payErr || !payment) {
      return {
        success: false,
        error: "Payment record not found or access denied.",
      };
    }

    // 2. Strict Student Ownership Check:
    // If caller is student, payment.student_id must match caller.userId
    if (caller.role === "student" && payment.student_id !== caller.userId) {
      return {
        success: false,
        error: "Access Denied: You are not authorized to view receipts belonging to another student.",
      };
    }

    // 3. Fetch Student Academic Details
    const { data: studentRecord } = await supabase
      .from("students")
      .select(`
        id,
        roll_number,
        admission_number,
        profiles!students_id_fkey(
          full_name,
          email
        ),
        departments!students_department_id_fkey(
          name
        ),
        courses!students_course_id_fkey(
          name
        )
      `)
      .eq("id", payment.student_id)
      .eq("institution_id", caller.institutionId)
      .maybeSingle();

    // 4. Fetch Fee Master Context
    const { data: feeRecord } = await supabase
      .from("fees")
      .select("id, academic_year, total_fee, paid_amount, pending_amount")
      .eq("id", payment.fee_id)
      .eq("institution_id", caller.institutionId)
      .maybeSingle();

    // 5. If this is a reversal payment, optionally fetch original receipt number for audit reference
    let reversedReceiptNumber: string | null = null;
    if (payment.reversed_payment_id) {
      const { data: origPay } = await supabase
        .from("fee_payments")
        .select("receipt_number")
        .eq("id", payment.reversed_payment_id)
        .eq("institution_id", caller.institutionId)
        .maybeSingle();
      if (origPay) {
        reversedReceiptNumber = origPay.receipt_number;
      }
    }

    const receiptData: FeeReceiptData = {
      paymentId: payment.id,
      receiptNumber: payment.receipt_number,
      paymentDate: payment.payment_date,
      amount: Number(payment.amount),
      paymentMethod: payment.payment_method,
      paymentStatus: payment.payment_status as "completed" | "reversed" | "failed",
      referenceNumber: payment.reference_number,
      remarks: payment.remarks,
      reversedPaymentId: payment.reversed_payment_id,
      reversedReceiptNumber,
      createdAt: payment.created_at,

      studentId: payment.student_id,
      studentName: (studentRecord?.profiles as any)?.full_name || "Enrolled Student",
      studentEmail: (studentRecord?.profiles as any)?.email || "",
      rollNumber: studentRecord?.roll_number || "—",
      admissionNumber: studentRecord?.admission_number || "—",
      departmentName: (studentRecord?.departments as any)?.name || null,
      courseName: (studentRecord?.courses as any)?.name || null,

      feeId: payment.fee_id,
      academicYear: feeRecord?.academic_year || "Current Session",
      totalFee: Number(feeRecord?.total_fee || 0),
      totalPaidToDate: Number(feeRecord?.paid_amount || 0),
      pendingBalance: Number(feeRecord?.pending_amount || 0),

      institutionName: (payment.institutions as any)?.name || "College ERP Campus",
      cashierName: (payment.profiles as any)?.full_name || "Accounts / Cashier Desk",
    };

    return {
      success: true,
      data: receiptData,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected authorization error occurred.";
    return { success: false, error: message };
  }
}


