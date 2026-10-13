"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeeReceiptModal } from "@/components/dashboard/FeeReceiptModal";
import { getPaymentReceiptAction, FeeReceiptData } from "@/app/actions/fees";
import { 
  CreditCard, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowLeft, 
  RotateCcw, 
  Info,
  Calendar,
  Hash,
  Search,
  Building2,
  FileText,
  Printer,
  Loader2,
  Filter,
  Sparkles
} from "lucide-react";

export interface StudentFeeSummary {
  id: string;
  academic_year: string;
  total_fee: number;
  paid_amount: number;
  pending_amount: number;
  status: "paid" | "partial" | "pending";
}

export interface StudentPaymentRecord {
  id: string;
  fee_id?: string | null;
  academic_year?: string | null;
  receipt_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_status: "completed" | "reversed" | "failed";
  reference_number: string | null;
  remarks: string | null;
  reversed_payment_id: string | null;
  created_at: string;
}

export interface StudentDetails {
  fullName: string;
  email: string;
  rollNumber: string;
  admissionNumber: string;
  departmentName: string | null;
  courseName: string | null;
}

export function StudentFeePortalView({
  studentDetails,
  allocations = [],
  payments = [],
}: {
  studentDetails: StudentDetails;
  allocations: StudentFeeSummary[];
  payments: StudentPaymentRecord[];
}) {
  // 1. Derive distinct available academic years from authorized student allocations
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(allocations.map((a) => a.academic_year)));
    // Sort descending so the most recent year appears first
    return years.sort().reverse();
  }, [allocations]);

  // 2. Default selected academic year to the latest year with an allocation, or "all" if none
  const defaultYear = availableYears.length > 0 ? availableYears[0] : "all";
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "completed" | "reversed">("all");

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<FeeReceiptData | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 3. Compute active Fee Summary based on selectedYear
  // When a specific year is selected: take that exact allocation
  // When "all" is selected: calculate cumulative totals across ALL distinct authorized allocations
  const activeFeeSummary = useMemo(() => {
    if (allocations.length === 0) return null;

    if (selectedYear === "all") {
      // Cumulative summary without double counting
      const totalFee = allocations.reduce((acc, a) => acc + a.total_fee, 0);
      const paidAmount = allocations.reduce((acc, a) => acc + a.paid_amount, 0);
      const pendingAmount = Math.max(0, totalFee - paidAmount);

      let status: "paid" | "partial" | "pending" = "pending";
      if (pendingAmount <= 0 && paidAmount > 0) {
        status = "paid";
      } else if (paidAmount > 0) {
        status = "partial";
      }

      return {
        id: "cumulative-all-years",
        academic_year: "All Academic Sessions (Cumulative)",
        total_fee: totalFee,
        paid_amount: paidAmount,
        pending_amount: pendingAmount,
        status,
        isCumulative: true,
      };
    }

    const matched = allocations.find((a) => a.academic_year === selectedYear);
    if (!matched) return null;

    return {
      ...matched,
      isCumulative: false,
    };
  }, [allocations, selectedYear]);

  // 4. Map each allocation ID to its academic year for payment linkage
  const feeIdToYearMap = useMemo(() => {
    const map = new Map<string, string>();
    allocations.forEach((a) => map.set(a.id, a.academic_year));
    return map;
  }, [allocations]);

  // Determine reversed payment IDs to visually flag original payments that were reversed
  const reversedOriginalPaymentIds = useMemo(() => {
    return new Set(
      payments.filter((p) => p.payment_status === "reversed" && p.reversed_payment_id).map((p) => p.reversed_payment_id!)
    );
  }, [payments]);

  // 5. Filter payments by selected academic year and text/status criteria
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Academic year matching:
      // A payment has either p.academic_year directly or via feeIdToYearMap (p.fee_id)
      const paymentYear = p.academic_year || (p.fee_id ? feeIdToYearMap.get(p.fee_id) : null);

      if (selectedYear !== "all") {
        if (!paymentYear || paymentYear !== selectedYear) {
          return false;
        }
      }

      // Search matching (receipt number, reference number, remarks)
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.receipt_number.toLowerCase().includes(q) ||
        (p.reference_number && p.reference_number.toLowerCase().includes(q)) ||
        (p.remarks && p.remarks.toLowerCase().includes(q));

      // Status filter
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "completed" && p.payment_status === "completed") ||
        (filterStatus === "reversed" && p.payment_status === "reversed");

      return matchesSearch && matchesStatus;
    });
  }, [payments, selectedYear, feeIdToYearMap, searchTerm, filterStatus]);

  const handleViewReceipt = (paymentId: string) => {
    setReceiptError(null);
    setLoadingReceiptId(paymentId);
    startTransition(async () => {
      const res = await getPaymentReceiptAction(paymentId);
      setLoadingReceiptId(null);
      if (res.success && res.data) {
        setActiveReceipt(res.data);
      } else {
        setReceiptError(res.error || "Failed to load payment receipt.");
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Student Context */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/student">
              <Button variant="outline" size="sm" className="h-8 border-slate-800 text-slate-300 hover:text-white gap-1.5 text-xs">
                <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Student Fee Portal</h1>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Official institutional fee allocation, academic-year schedules, paid installments, counter receipts, and ledger history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="font-semibold text-slate-200">{studentDetails.fullName}</div>
            <div className="text-slate-400 font-mono">
              Roll: {studentDetails.rollNumber} • Adm: {studentDetails.admissionNumber}
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
            {studentDetails.fullName.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Global Error Banner if receipt lookup fails */}
      {receiptError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 flex items-center justify-between text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{receiptError}</span>
          </div>
          <button onClick={() => setReceiptError(null)} className="text-rose-400 hover:text-rose-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Academic Year Selector Bar */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Academic Session:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* All Years Button */}
            <Button
              size="sm"
              variant={selectedYear === "all" ? "default" : "outline"}
              onClick={() => setSelectedYear("all")}
              className={`h-8 text-xs font-mono font-medium ${
                selectedYear === "all"
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                  : "border-slate-800 text-slate-300 hover:bg-slate-800"
              }`}
            >
              All Years ({allocations.length})
            </Button>

            {/* Individual Academic Years */}
            {availableYears.map((yr) => {
              const isSelected = selectedYear === yr;
              return (
                <Button
                  key={yr}
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => setSelectedYear(yr)}
                  className={`h-8 text-xs font-mono font-medium ${
                    isSelected
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                      : "border-slate-800 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {yr}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Case 1: No Fee Allocation Assigned At All */}
      {!activeFeeSummary ? (
        <Card className="bg-slate-900/60 border-slate-800 text-center py-12 px-4 shadow-xl">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">No Fee Allocation Found</h2>
              <p className="text-slate-400 text-xs mt-1">
                {selectedYear === "all"
                  ? "No academic fee schedules have been assigned to your student profile yet."
                  : `No fee allocation exists for academic session '${selectedYear}'.`}
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2 text-left">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Please contact the campus accounts office or administration desk if your semester allocation is missing.
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Total Fee Card */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {activeFeeSummary.isCumulative ? "Cumulative Total Fee" : "Total Allocated Fee"}
                </CardTitle>
                <CreditCard className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white font-mono">
                  ₹{activeFeeSummary.total_fee.toLocaleString("en-IN")}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {activeFeeSummary.isCumulative
                    ? `Sum of ${allocations.length} academic sessions`
                    : `Academic Year ${activeFeeSummary.academic_year}`}
                </p>
              </CardContent>
            </Card>

            {/* Total Paid Card */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {activeFeeSummary.isCumulative ? "Cumulative Paid" : "Net Amount Paid"}
                </CardTitle>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  ₹{activeFeeSummary.paid_amount.toLocaleString("en-IN")}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Verified offline cashier receipts
                </p>
              </CardContent>
            </Card>

            {/* Outstanding Balance Card */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {activeFeeSummary.isCumulative ? "Total Outstanding Due" : "Outstanding Balance"}
                </CardTitle>
                <Clock className="w-4 h-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">
                  {activeFeeSummary.pending_amount <= 0 ? (
                    <span className="text-emerald-400">₹0</span>
                  ) : (
                    <span className="text-amber-400">₹{activeFeeSummary.pending_amount.toLocaleString("en-IN")}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeFeeSummary.pending_amount <= 0 ? "Zero outstanding balance" : "Pending offline installment"}
                </p>
              </CardContent>
            </Card>

            {/* Payment Settlement Status Card */}
            <Card className="bg-slate-900/80 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Account Status
                </CardTitle>
                <Receipt className="w-4 h-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="pt-0.5">
                  <Badge
                    variant={
                      activeFeeSummary.status === "paid"
                        ? "success"
                        : activeFeeSummary.status === "partial"
                        ? "warning"
                        : "destructive"
                    }
                    className="text-xs font-mono uppercase px-2.5 py-1"
                  >
                    {activeFeeSummary.status === "paid"
                      ? "Fully Settled"
                      : activeFeeSummary.status === "partial"
                      ? "Partially Paid"
                      : "Pending Dues"}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {activeFeeSummary.status === "paid"
                    ? "All semester dues cleared."
                    : "Payable offline at counter desk."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Fully Settled Congratulatory Notice */}
          {activeFeeSummary.status === "paid" && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white">All Dues Settled:</span> You have no outstanding
                  financial dues for {activeFeeSummary.isCumulative ? "any academic session" : `academic year ${activeFeeSummary.academic_year}`}. Keep your counter receipts for future reference.
                </div>
              </div>
            </div>
          )}

          {/* Payment Notice & Offline Cashier Desk Info */}
          {activeFeeSummary.status !== "paid" && (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Offline Campus Fee Collection:</span> To make an installment or clear
                  pending dues for {activeFeeSummary.isCumulative ? "selected sessions" : activeFeeSummary.academic_year}, visit the designated Cashier Collection Counter. Payments can be submitted via
                  Cash, UPI, Cheque, Bank Transfer (NEFT/RTGS), or Demand Draft.
                </div>
              </div>
            </div>
          )}

          {/* Payment History & Receipt Ledger Section */}
          <Card className="bg-slate-900/80 border-slate-800 shadow-xl">
            <CardHeader className="border-b border-slate-800/80 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-400" />
                    Payment History & Counter Receipts
                    {selectedYear !== "all" && (
                      <span className="text-xs font-mono font-normal text-slate-400">
                        ({selectedYear})
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Immutable financial ledger records certified by the cashier office.
                  </CardDescription>
                </div>

                {/* Filter and Search Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search receipt, UTR #..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950/70 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="h-8 px-2.5 rounded-md bg-slate-950/70 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="all">All Transactions</option>
                    <option value="completed">Completed Only</option>
                    <option value="reversed">Reversals Only</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredPayments.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                  <Receipt className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="font-medium text-slate-300">
                    {payments.length === 0
                      ? "No payment transactions recorded yet."
                      : selectedYear !== "all"
                      ? `No payments recorded for academic year ${selectedYear}.`
                      : "No matching payment records found."}
                  </p>
                  <p className="text-slate-500">
                    {payments.length === 0
                      ? "When you submit an offline installment at the cashier counter, your receipt will appear here immediately."
                      : "Try switching the academic year filter or clearing your search query."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase text-[11px] font-mono border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3">Receipt #</th>
                        <th className="px-5 py-3">Academic Year</th>
                        <th className="px-5 py-3">Payment Date</th>
                        <th className="px-5 py-3">Amount</th>
                        <th className="px-5 py-3">Method</th>
                        <th className="px-5 py-3">Reference / UTR #</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Remarks</th>
                        <th className="px-5 py-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredPayments.map((p) => {
                        const isReversal = p.payment_status === "reversed";
                        const wasReversedByOther = reversedOriginalPaymentIds.has(p.id);
                        const isLoading = loadingReceiptId === p.id;
                        const paymentYear = p.academic_year || (p.fee_id ? feeIdToYearMap.get(p.fee_id) : "—") || "—";

                        return (
                          <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                            {/* Receipt Number */}
                            <td className="px-5 py-3.5 font-mono font-medium text-white flex items-center gap-1.5">
                              {p.receipt_number}
                              {isReversal && (
                                <span className="text-[10px] text-amber-400 font-sans" title="Corrective reversal record">
                                  (reversal)
                                </span>
                              )}
                            </td>

                            {/* Academic Year */}
                            <td className="px-5 py-3.5 font-mono text-slate-300">
                              {paymentYear}
                            </td>

                            {/* Payment Date */}
                            <td className="px-5 py-3.5 text-slate-400 font-mono">
                              {p.payment_date}
                            </td>

                            {/* Amount */}
                            <td className="px-5 py-3.5 font-bold font-mono">
                              <span
                                className={
                                  isReversal
                                    ? "text-amber-400"
                                    : wasReversedByOther
                                    ? "text-slate-400 line-through"
                                    : "text-emerald-400"
                                }
                              >
                                {isReversal ? "-" : ""}₹{Number(p.amount).toLocaleString("en-IN")}
                              </span>
                            </td>

                            {/* Method */}
                            <td className="px-5 py-3.5 uppercase font-mono text-[11px]">
                              {p.payment_method.replace("_", " ")}
                            </td>

                            {/* Reference / UTR # */}
                            <td className="px-5 py-3.5 font-mono text-slate-400">
                              {p.reference_number || "—"}
                            </td>

                            {/* Status Badge */}
                            <td className="px-5 py-3.5">
                              <Badge
                                variant={
                                  p.payment_status === "completed"
                                    ? wasReversedByOther
                                      ? "secondary"
                                      : "success"
                                    : isReversal
                                    ? "warning"
                                    : "destructive"
                                }
                                className="text-[10px] uppercase font-mono py-0 px-2"
                              >
                                {wasReversedByOther ? "Reversed" : p.payment_status}
                              </Badge>
                            </td>

                            {/* Remarks */}
                            <td className="px-5 py-3.5 text-slate-400 max-w-xs truncate" title={p.remarks || ""}>
                              {p.remarks || "—"}
                            </td>

                            {/* View Receipt Action */}
                            <td className="px-5 py-3.5 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isLoading}
                                onClick={() => handleViewReceipt(p.id)}
                                className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors gap-1.5"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <FileText className="w-3 h-3 text-indigo-400" />
                                )}
                                View Receipt
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Printable Receipt Modal */}
      {activeReceipt && (
        <FeeReceiptModal
          receipt={activeReceipt}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </div>
  );
}
