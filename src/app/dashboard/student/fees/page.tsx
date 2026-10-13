import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  StudentFeePortalView,
  StudentFeeSummary,
  StudentPaymentRecord,
  StudentDetails,
} from "@/components/dashboard/StudentFeePortalView";

export const metadata = {
  title: "Fee Portal — Student Dashboard | College ERP",
};

export default async function StudentFeesPage() {
  // 1. Authenticate server-side and enforce 'student' role
  const user = await requireRole(["student"]);
  const supabase = await createClient();

  // 2. Fetch authenticated student profile and academic mapping
  // Uses auth.uid() directly, never trusting any client-supplied parameters
  const { data: studentRecord } = await supabase
    .from("students")
    .select(`
      id,
      roll_number,
      admission_number,
      departments(name),
      courses(name)
    `)
    .eq("id", user.userId)
    .single();

  const studentDetails: StudentDetails = {
    fullName: user.fullName || "Student",
    email: user.email,
    rollNumber: studentRecord?.roll_number || "—",
    admissionNumber: studentRecord?.admission_number || "—",
    departmentName: (studentRecord?.departments as any)?.name || null,
    courseName: (studentRecord?.courses as any)?.name || null,
  };

  // 3. Fetch all fee master allocations for this authenticated student
  // Filtered explicitly by student_id = user.userId and institution_id = user.institutionId
  // Protected by RLS policy: fees_select_policy (student_id = auth.uid())
  const { data: rawFees } = await supabase
    .from("fees")
    .select("id, academic_year, total_fee, paid_amount, pending_amount, created_at")
    .eq("student_id", user.userId)
    .eq("institution_id", user.institutionId)
    .order("academic_year", { ascending: false });

  const allocations: StudentFeeSummary[] = (rawFees || []).map((f) => {
    const totalFee = Number(f.total_fee);
    const paidAmount = Number(f.paid_amount);
    const pendingAmount = Number(f.pending_amount);

    let status: "paid" | "partial" | "pending" = "pending";
    if (pendingAmount <= 0 && paidAmount > 0) {
      status = "paid";
    } else if (paidAmount > 0) {
      status = "partial";
    }

    return {
      id: f.id,
      academic_year: f.academic_year,
      total_fee: totalFee,
      paid_amount: paidAmount,
      pending_amount: pendingAmount,
      status,
    };
  });

  // 4. Fetch complete payment transaction history for this authenticated student
  // Protected by RLS policy: fee_payments_select_policy (student_id = auth.uid())
  const { data: rawPayments } = await supabase
    .from("fee_payments")
    .select(`
      id,
      fee_id,
      receipt_number,
      amount,
      payment_date,
      payment_method,
      payment_status,
      reference_number,
      remarks,
      reversed_payment_id,
      created_at,
      fees!fk_fee_payments_fee_student(
        academic_year
      )
    `)
    .eq("student_id", user.userId)
    .eq("institution_id", user.institutionId)
    .order("created_at", { ascending: false });

  const payments: StudentPaymentRecord[] = (rawPayments || []).map((p: any) => ({
    id: p.id,
    fee_id: p.fee_id,
    academic_year: p.fees?.academic_year || null,
    receipt_number: p.receipt_number,
    amount: Number(p.amount),
    payment_date: p.payment_date,
    payment_method: p.payment_method,
    payment_status: p.payment_status as "completed" | "reversed" | "failed",
    reference_number: p.reference_number,
    remarks: p.remarks,
    reversed_payment_id: p.reversed_payment_id,
    created_at: p.created_at,
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        <StudentFeePortalView
          studentDetails={studentDetails}
          allocations={allocations}
          payments={payments}
        />
      </main>
    </div>
  );
}
