"use client";

import { useState, useTransition } from "react";
import { recordOfflinePaymentAction, reversePaymentAction, getPaymentReceiptAction, FeePaymentMethod, FeeReceiptData } from "@/app/actions/fees";
import { FeeReceiptModal } from "@/components/dashboard/FeeReceiptModal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Receipt, 
  Search, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  RotateCcw, 
  FileText,
  DollarSign,
  User,
  Hash,
  Calendar,
  Building,
  Printer
} from "lucide-react";

export interface StudentFeeDuesItem {
  id: string;
  student_id: string;
  academic_year: string;
  total_fee: number;
  paid_amount: number;
  pending_amount: number;
  student_name: string;
  student_email: string;
  roll_number: string;
  admission_number: string;
  department_name: string | null;
  course_name: string | null;
}

export interface PaymentLedgerItem {
  id: string;
  receipt_number: string;
  amount: number;
  payment_method: FeePaymentMethod;
  payment_status: "completed" | "reversed" | "failed";
  payment_date: string;
  reference_number: string | null;
  remarks: string | null;
  fee_id: string;
  student_id: string;
  reversed_payment_id: string | null;
  created_at: string;
  student_name: string;
  roll_number: string;
  cashier_name: string;
}

export function CashierWorkflowView({
  feeDues,
  ledger,
}: {
  feeDues: StudentFeeDuesItem[];
  ledger: PaymentLedgerItem[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFee, setSelectedFee] = useState<StudentFeeDuesItem | null>(null);
  
  // Payment Form State
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<FeePaymentMethod>("cash");
  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  
  // Feedback states
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Reversal Modal / Dialog State
  const [reversalTarget, setReversalTarget] = useState<PaymentLedgerItem | null>(null);
  const [reversalReceipt, setReversalReceipt] = useState<string>("");
  const [reversalReason, setReversalReason] = useState<string>("");

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<FeeReceiptData | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  const handleViewReceipt = (paymentId: string) => {
    setLoadingReceiptId(paymentId);
    startTransition(async () => {
      const res = await getPaymentReceiptAction(paymentId);
      setLoadingReceiptId(null);
      if (res.success && res.data) {
        setActiveReceipt(res.data);
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to load payment receipt.",
        });
      }
    });
  };

  // Filter student fee dues
  const filteredDues = feeDues.filter((f) => {
    const q = searchTerm.toLowerCase();
    return (
      f.student_name.toLowerCase().includes(q) ||
      f.roll_number.toLowerCase().includes(q) ||
      f.admission_number.toLowerCase().includes(q) ||
      f.student_email.toLowerCase().includes(q)
    );
  });

  const handleSelectFee = (item: StudentFeeDuesItem) => {
    setSelectedFee(item);
    setAmount(item.pending_amount > 0 ? String(item.pending_amount) : "");
    // Generate suggested unique receipt number
    const prefix = "REC";
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setReceiptNumber(`${prefix}-${year}-${randomSuffix}`);
    setFeedback(null);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFee) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({ type: "error", message: "Please enter a valid positive payment amount." });
      return;
    }

    if (numAmount > selectedFee.pending_amount) {
      setFeedback({
        type: "error",
        message: `Overpayment prevention: Entered amount (₹${numAmount.toLocaleString("en-IN")}) exceeds pending balance (₹${selectedFee.pending_amount.toLocaleString("en-IN")}).`,
      });
      return;
    }

    if (!receiptNumber.trim()) {
      setFeedback({ type: "error", message: "Unique receipt number is required for offline payments." });
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const res = await recordOfflinePaymentAction({
        feeId: selectedFee.id,
        studentId: selectedFee.student_id,
        amount: numAmount,
        paymentMethod,
        receiptNumber: receiptNumber.trim(),
        paymentDate,
        referenceNumber: referenceNumber.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      if (res.success && res.paymentId) {
        setFeedback({
          type: "success",
          message: `Payment of ₹${numAmount.toLocaleString("en-IN")} recorded successfully! Receipt: ${res.receiptNumber}`,
        });
        setSelectedFee(null);
        setAmount("");
        setReceiptNumber("");
        setReferenceNumber("");
        setRemarks("");

        // Auto-fetch receipt for immediate cashier preview & printing
        const receiptRes = await getPaymentReceiptAction(res.paymentId);
        if (receiptRes.success && receiptRes.data) {
          setActiveReceipt(receiptRes.data);
        }
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to record payment in ledger.",
        });
      }
    });
  };

  const handleStartReversal = (payment: PaymentLedgerItem) => {
    setReversalTarget(payment);
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setReversalReceipt(`REV-${year}-${randomSuffix}`);
    setReversalReason("");
    setFeedback(null);
  };

  const handleConfirmReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget) return;

    if (!reversalReceipt.trim()) {
      setFeedback({ type: "error", message: "Reversal receipt number is required." });
      return;
    }

    if (!reversalReason.trim()) {
      setFeedback({ type: "error", message: "A documented audit remark / reason is required for reversals." });
      return;
    }

    startTransition(async () => {
      setFeedback(null);
      const res = await reversePaymentAction({
        originalPaymentId: reversalTarget.id,
        feeId: reversalTarget.fee_id,
        studentId: reversalTarget.student_id,
        amount: reversalTarget.amount,
        receiptNumber: reversalReceipt.trim(),
        remarks: reversalReason.trim(),
      });

      if (res.success) {
        setFeedback({
          type: "success",
          message: `Reversal of ₹${reversalTarget.amount.toLocaleString("en-IN")} processed. Ledger synchronized.`,
        });
        setReversalTarget(null);
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to process reversal.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            feedback.type === "success"
              ? "bg-emerald-950/70 border-emerald-800 text-emerald-200"
              : "bg-red-950/70 border-red-800 text-red-200"
          }`}
        >
          <div className="flex items-center space-x-3">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.message}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFeedback(null)}
            className="text-xs h-7 px-2 hover:bg-slate-800/60"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Grid: Student Dues & Payment Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Student Dues Search & Select (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-400" />
                    Student Fee Dues Roster
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Select an active student account to record an offline installment or full payment
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search name, roll #, admission..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-xs bg-slate-950/60 border-slate-800 focus:border-indigo-500"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredDues.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  {searchTerm ? "No student fee dues matching search criteria." : "No outstanding student fee accounts found."}
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 max-h-[440px] overflow-y-auto">
                  {filteredDues.map((item) => {
                    const isSelected = selectedFee?.id === item.id;
                    const isPaidOff = item.pending_amount <= 0;
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isPaidOff && handleSelectFee(item)}
                        className={`p-4 transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-indigo-950/40 border-l-4 border-indigo-500"
                            : isPaidOff
                            ? "opacity-60 bg-slate-950/20 cursor-default"
                            : "hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm">{item.student_name}</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                              {item.roll_number}
                            </Badge>
                            <span className="text-xs text-slate-400 font-mono">({item.admission_number})</span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span>{item.department_name || "General"}</span>
                            <span>•</span>
                            <span>{item.course_name || "UG"}</span>
                            <span>•</span>
                            <span className="font-mono text-indigo-300">AY: {item.academic_year}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            Total: ₹{Number(item.total_fee).toLocaleString("en-IN")}
                          </div>
                          <div className="text-sm font-bold mt-0.5">
                            {isPaidOff ? (
                              <span className="text-emerald-400 flex items-center gap-1 justify-end">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Settled
                              </span>
                            ) : (
                              <span className="text-amber-400">
                                Pending: ₹{Number(item.pending_amount).toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Paid: ₹{Number(item.paid_amount).toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Record Offline Payment Form (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                Record Offline Payment
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                {selectedFee
                  ? `Recording payment for ${selectedFee.student_name}`
                  : "Select a student from the dues roster on the left"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {!selectedFee ? (
                <div className="py-12 px-4 text-center text-slate-500 text-sm">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  Please select a student from the roster to record an offline payment installment.
                </div>
              ) : (
                <form onSubmit={handleRecordPayment} className="space-y-4">
                  {/* Selected Student Summary Card */}
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Student:</span>
                      <span className="font-semibold text-white">{selectedFee.student_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pending Dues:</span>
                      <span className="font-bold text-amber-400">
                        ₹{Number(selectedFee.pending_amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Cumulative Paid:</span>
                      <span className="text-emerald-400">
                        ₹{Number(selectedFee.paid_amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* Payment Amount */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Payment Amount (₹) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                      <Input
                        type="number"
                        min="1"
                        max={selectedFee.pending_amount}
                        step="any"
                        placeholder="e.g. 15000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className="pl-8 bg-slate-950/70 border-slate-800 text-white font-semibold"
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>Min: ₹1</span>
                      <button
                        type="button"
                        onClick={() => setAmount(String(selectedFee.pending_amount))}
                        className="text-indigo-400 hover:underline"
                      >
                        Pay Full Dues (₹{selectedFee.pending_amount})
                      </button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Payment Method <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as FeePaymentMethod)}
                      className="w-full h-10 px-3 rounded-md bg-slate-950/70 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="cash">Cash (Counter Collection)</option>
                      <option value="upi">UPI / QR Code</option>
                      <option value="cheque">Cheque</option>
                      <option value="bank_transfer">Bank Transfer (NEFT / RTGS)</option>
                      <option value="demand_draft">Demand Draft (DD)</option>
                    </select>
                  </div>

                  {/* Receipt & Date Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">
                        Receipt # <span className="text-red-400">*</span>
                      </label>
                      <Input
                        value={receiptNumber}
                        onChange={(e) => setReceiptNumber(e.target.value)}
                        placeholder="REC-2026-..."
                        required
                        className="bg-slate-950/70 border-slate-800 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-300">Payment Date</label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                        className="bg-slate-950/70 border-slate-800 text-xs"
                      />
                    </div>
                  </div>

                  {/* Reference Number (Cheque / UTR / DD #) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Reference / UTR / Cheque / DD # (Optional)
                    </label>
                    <Input
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      placeholder="e.g. UTR-998877 / CHQ-102938"
                      className="bg-slate-950/70 border-slate-800 text-xs font-mono"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Verification Remarks</label>
                    <Input
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Verified and collected by cashier"
                      className="bg-slate-950/70 border-slate-800 text-xs"
                    />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-10 gap-2"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Recording Payment...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Confirm & Issue Receipt
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedFee(null)}
                      className="border-slate-800 text-slate-400 text-xs h-10"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reversal Confirmation Modal / Box */}
      {reversalTarget && (
        <Card className="border-amber-500/50 bg-amber-950/20 shadow-2xl">
          <CardHeader className="border-b border-amber-900/40 pb-3">
            <CardTitle className="text-lg font-bold text-amber-300 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-400" />
              Process Auditable Payment Reversal
            </CardTitle>
            <CardDescription className="text-amber-200/70 text-xs">
              Reversing Receipt: <span className="font-mono text-white">{reversalTarget.receipt_number}</span> |
              Amount: <span className="font-bold text-white">₹{Number(reversalTarget.amount).toLocaleString("en-IN")}</span> |
              Student: <span className="font-semibold text-white">{reversalTarget.student_name}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleConfirmReversal} className="space-y-4 max-w-xl">
              <p className="text-xs text-slate-300">
                Notice: Reversals do not delete records. An auditable, linked reversal transaction will be inserted into
                the financial ledger, and the student's dues will be recalculated automatically by the database trigger.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Reversal Receipt # <span className="text-red-400">*</span>
                  </label>
                  <Input
                    value={reversalReceipt}
                    onChange={(e) => setReversalReceipt(e.target.value)}
                    required
                    className="bg-slate-950/80 border-slate-800 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Original Payment Amount</label>
                  <Input
                    value={`₹${Number(reversalTarget.amount).toLocaleString("en-IN")}`}
                    disabled
                    className="bg-slate-950/80 border-slate-800 text-xs text-amber-300 font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Documented Reversal Reason / Audit Remarks <span className="text-red-400">*</span>
                </label>
                <Input
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g. Cheque bounced / cashier counter correction"
                  required
                  className="bg-slate-950/80 border-slate-800 text-xs"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-9 gap-1.5"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing Reversal...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" /> Confirm Auditable Reversal
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReversalTarget(null)}
                  className="border-slate-800 text-xs h-9"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bottom Section: Immutable Financial Payment Ledger */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Immutable Financial Transaction Ledger
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Permanent offline fee collection audit trail for your verified institution
              </CardDescription>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Total Transactions: {ledger.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {ledger.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No payment transactions recorded in this institution yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[11px] font-mono border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Receipt #</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Roll #</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3">Recorded By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-normal">
                  {ledger.map((tx) => {
                    const isReversed = tx.payment_status === "reversed";
                    const isCompleted = tx.payment_status === "completed";
                    // Check if this completed payment has already been reversed by another transaction in ledger
                    const hasBeenReversed = ledger.some(
                      (l) => l.payment_status === "reversed" && l.reversed_payment_id === tx.id
                    );

                    return (
                      <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-white flex items-center gap-1.5">
                          {tx.receipt_number}
                          {tx.reversed_payment_id && (
                            <span className="text-[10px] text-amber-400 font-sans" title="Links to original payment">
                              (rev)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-200">{tx.student_name}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{tx.roll_number}</td>
                        <td className="px-4 py-3 font-bold font-mono">
                          <span className={isReversed ? "text-amber-400 line-through" : "text-emerald-400"}>
                            ₹{Number(tx.amount).toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="px-4 py-3 uppercase font-mono text-[11px]">
                          {tx.payment_method.replace("_", " ")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              isCompleted
                                ? hasBeenReversed
                                  ? "secondary"
                                  : "success"
                                : isReversed
                                ? "warning"
                                : "destructive"
                            }
                            className="text-[10px] uppercase font-mono py-0 px-2"
                          >
                            {hasBeenReversed ? "reversed (settled)" : tx.payment_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{tx.payment_date}</td>
                        <td className="px-4 py-3 text-slate-400 text-[11px]">{tx.cashier_name}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={loadingReceiptId === tx.id}
                              onClick={() => handleViewReceipt(tx.id)}
                              className="text-[11px] h-7 px-2 border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors gap-1"
                              title="Print or view receipt"
                            >
                              {loadingReceiptId === tx.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Printer className="w-3 h-3 text-indigo-400" />
                              )}
                              Receipt
                            </Button>

                            {isCompleted && !hasBeenReversed ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStartReversal(tx)}
                                className="text-[11px] h-7 px-2 border-slate-700 hover:border-amber-600 hover:text-amber-400 text-slate-300 gap-1"
                              >
                                <RotateCcw className="w-3 h-3" /> Reverse
                              </Button>
                            ) : null}
                          </div>
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
