import { requireAccountsAccess } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Receipt, CreditCard, Banknote, ShieldCheck } from "lucide-react";
import { CashierWorkflowView, StudentFeeDuesItem, PaymentLedgerItem } from "@/components/dashboard/CashierWorkflowView";

export const metadata = {
  title: "Cashier Dashboard — College ERP",
};

export default async function CashierDashboardPage() {
  const user = await requireAccountsAccess();
  const supabase = await createClient();

  // 1. Fetch fee summaries for institution metrics
  const { data: feeSummaries } = await supabase
    .from("fees")
    .select("id, total_fee, paid_amount, pending_amount")
    .eq("institution_id", user.institutionId);

  const totalDues = feeSummaries?.reduce((acc, f) => acc + Number(f.total_fee || 0), 0) || 0;
  const totalCollected = feeSummaries?.reduce((acc, f) => acc + Number(f.paid_amount || 0), 0) || 0;
  const totalPending = feeSummaries?.reduce((acc, f) => acc + Number(f.pending_amount || 0), 0) || 0;

  // 2. Fetch student fee dues roster with profile, student roll #, department, and course
  // Scoped to cashier's institution via RLS and explicit query filter
  const { data: rawFeeDues } = await supabase
    .from("fees")
    .select(`
      id,
      student_id,
      academic_year,
      total_fee,
      paid_amount,
      pending_amount,
      students!fk_fees_student(
        id,
        roll_number,
        admission_number,
        profiles!students_id_fkey(
          full_name,
          email
        )
      )
    `)
    .eq("institution_id", user.institutionId)
    .order("created_at", { ascending: false });

  const formattedFeeDues: StudentFeeDuesItem[] = (rawFeeDues || []).map((f: any) => ({
    id: f.id,
    student_id: f.student_id,
    academic_year: f.academic_year,
    total_fee: Number(f.total_fee),
    paid_amount: Number(f.paid_amount),
    pending_amount: Number(f.pending_amount),
    student_name: f.students?.profiles?.full_name || "Unknown Student",
    student_email: f.students?.profiles?.email || "",
    roll_number: f.students?.roll_number || "—",
    admission_number: f.students?.admission_number || "—",
    department_name: null,
    course_name: null,
  }));

  // 3. Fetch comprehensive financial payment ledger
  const { data: rawLedger } = await supabase
    .from("fee_payments")
    .select(`
      id,
      receipt_number,
      amount,
      payment_method,
      payment_status,
      payment_date,
      reference_number,
      remarks,
      fee_id,
      student_id,
      reversed_payment_id,
      created_at,
      fees!fk_fee_payments_fee_student(
        students!fk_fees_student(
          roll_number,
          profiles!students_id_fkey(
            full_name
          )
        )
      ),
      profiles!fee_payments_recorded_by_fkey(
        full_name
      )
    `)
    .eq("institution_id", user.institutionId)
    .order("created_at", { ascending: false })
    .limit(50);

  const formattedLedger: PaymentLedgerItem[] = (rawLedger || []).map((p: any) => ({
    id: p.id,
    receipt_number: p.receipt_number,
    amount: Number(p.amount),
    payment_method: p.payment_method,
    payment_status: p.payment_status,
    payment_date: p.payment_date,
    reference_number: p.reference_number,
    remarks: p.remarks,
    fee_id: p.fee_id,
    student_id: p.student_id,
    reversed_payment_id: p.reversed_payment_id,
    created_at: p.created_at,
    student_name: p.fees?.students?.profiles?.full_name || "Unknown Student",
    roll_number: p.fees?.students?.roll_number || "—",
    cashier_name: p.profiles?.full_name || "Cashier",
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Cashier Fee Collection Portal
            </h1>
            <p className="text-slate-400 text-sm pt-1">
              Manual offline fee collection, instant receipt issuing, partial installments, and auditable reversals.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Verified Offline Collection Desk
          </div>
        </div>

        {/* Financial Stat Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total Billed Fees</CardTitle>
              <CreditCard className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">₹{totalDues.toLocaleString("en-IN")}</div>
              <p className="text-xs text-slate-400 pt-1">Institution academic billing dues</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total Collected (Verified)</CardTitle>
              <Banknote className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">₹{totalCollected.toLocaleString("en-IN")}</div>
              <p className="text-xs text-slate-400 pt-1">Cash, Cheque, UPI, DD, and Netbanking receipts</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Outstanding Balance</CardTitle>
              <Receipt className="w-4 h-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">₹{totalPending.toLocaleString("en-IN")}</div>
              <p className="text-xs text-slate-400 pt-1">Pending student payments</p>
            </CardContent>
          </Card>
        </div>

        {/* Interactive Cashier Workflow Component */}
        <CashierWorkflowView feeDues={formattedFeeDues} ledger={formattedLedger} />
      </main>
    </div>
  );
}
