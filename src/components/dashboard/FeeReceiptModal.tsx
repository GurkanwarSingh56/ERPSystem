"use client";

import { useRef } from "react";
import { FeeReceiptData } from "@/app/actions/fees";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Download,
  X,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Receipt,
  Calendar,
  CreditCard,
  User,
  ShieldCheck,
  Hash,
} from "lucide-react";

interface FeeReceiptModalProps {
  receipt: FeeReceiptData;
  onClose: () => void;
}

export function FeeReceiptModal({ receipt, onClose }: FeeReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const isReversed = receipt.paymentStatus === "reversed";
  const isFailed = receipt.paymentStatus === "failed";
  const isCompleted = receipt.paymentStatus === "completed";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-50 print:p-0 print:bg-white print:static">
      {/* Modal Container */}
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-white print:text-black">
        {/* Top Control Bar - Hidden when printing */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/60 print:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Receipt className="w-4 h-4 text-indigo-400" />
            Payment Receipt Preview
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save as PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Receipt Area */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 print:p-0 print:overflow-visible">
          {/* Printable Receipt Paper */}
          <div
            ref={receiptRef}
            id="printable-receipt"
            className="bg-slate-950 border border-slate-800/80 rounded-xl p-6 sm:p-8 space-y-6 print:border print:border-gray-300 print:bg-white print:text-black print:p-6 print:rounded-none"
          >
            {/* Header / Institution Identity */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-6 print:border-gray-300">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 print:bg-indigo-600 print:shadow-none">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white print:text-black">
                      {receipt.institutionName}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono print:text-gray-600">
                      Official Fee Payment Acknowledgment
                    </p>
                  </div>
                </div>
              </div>

              {/* Receipt Number & Date */}
              <div className="text-left sm:text-right space-y-1">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-400 print:text-gray-600">
                  Receipt Number
                </div>
                <div className="text-base font-mono font-bold text-white tracking-wide print:text-black">
                  {receipt.receiptNumber}
                </div>
                <div className="text-xs text-slate-400 font-mono print:text-gray-600 flex sm:justify-end items-center gap-1.5 pt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 print:hidden" />
                  <span>Date: {receipt.paymentDate}</span>
                </div>
              </div>
            </div>

            {/* Reversal / Status Notice */}
            {isReversed && (
              <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-300 flex items-start gap-2.5 text-xs print:bg-gray-100 print:border-gray-400 print:text-black">
                <RotateCcw className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 print:text-black" />
                <div>
                  <span className="font-bold uppercase tracking-wider">
                    Reversal Acknowledgment:
                  </span>{" "}
                  This transaction is an authorized accounting reversal of payment
                  {receipt.reversedReceiptNumber ? ` (${receipt.reversedReceiptNumber})` : ""}.
                  It has been credited back to outstanding dues.
                </div>
              </div>
            )}

            {isFailed && (
              <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 flex items-start gap-2.5 text-xs print:bg-gray-100 print:border-gray-400 print:text-black">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 print:text-black" />
                <div>
                  <span className="font-bold uppercase tracking-wider">
                    Transaction Failed:
                  </span>{" "}
                  This record represents an unconfirmed or rejected transaction. No funds were
                  credited towards student balance.
                </div>
              </div>
            )}

            {/* Student Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs print:bg-gray-50 print:border-gray-300 print:text-black">
              <div className="space-y-1.5">
                <div className="text-slate-400 print:text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                  Student Name
                </div>
                <div className="font-bold text-white text-sm print:text-black">
                  {receipt.studentName}
                </div>
                <div className="text-slate-400 font-mono print:text-gray-700">
                  {receipt.studentEmail}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-slate-400 print:text-gray-600 uppercase text-[10px] tracking-wider font-semibold">
                  Academic Identification
                </div>
                <div className="font-mono text-slate-200 print:text-black">
                  Roll No: <span className="font-bold">{receipt.rollNumber}</span>
                </div>
                <div className="font-mono text-slate-200 print:text-black">
                  Admission No: <span className="font-bold">{receipt.admissionNumber}</span>
                </div>
                {receipt.departmentName && (
                  <div className="text-slate-400 text-[11px] print:text-gray-700 pt-0.5">
                    {receipt.departmentName}
                    {receipt.courseName ? ` • ${receipt.courseName}` : ""}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Details Table */}
            <div className="border border-slate-800 rounded-xl overflow-hidden print:border-gray-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800 print:bg-gray-100 print:border-gray-300 print:text-black">
                  <tr>
                    <th className="py-3 px-4">Description / Particulars</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-gray-300">
                  <tr className="text-slate-200 print:text-black">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white print:text-black">
                        {isReversed ? "Fee Payment Reversal" : "Academic Tuition & Fee Installment"}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono print:text-gray-600">
                        Academic Session: {receipt.academicYear}
                      </div>
                      {receipt.referenceNumber && (
                        <div className="text-[11px] text-slate-400 font-mono print:text-gray-600">
                          Ref/UTR: {receipt.referenceNumber}
                        </div>
                      )}
                      {receipt.remarks && (
                        <div className="text-[11px] text-slate-500 italic pt-0.5 print:text-gray-600">
                          Note: {receipt.remarks}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 uppercase font-mono text-[11px] text-slate-300 print:text-black">
                      {receipt.paymentMethod.replace("_", " ")}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={
                          isCompleted
                            ? "success"
                            : isReversed
                            ? "warning"
                            : "destructive"
                        }
                        className="text-[10px] uppercase font-mono py-0 px-2 print:border print:border-gray-400"
                      >
                        {receipt.paymentStatus}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-base text-white print:text-black">
                      {isReversed ? "-" : ""}₹{receipt.amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Fee Statement Context */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/40 space-y-2 text-xs print:bg-white print:border-gray-300">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider print:text-gray-600">
                Academic Year Account Summary
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono pt-1">
                <div>
                  <span className="text-slate-400 print:text-gray-600">Allocated Dues:</span>{" "}
                  <span className="font-bold text-slate-200 print:text-black">
                    ₹{receipt.totalFee.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600">Total Paid to Date:</span>{" "}
                  <span className="font-bold text-emerald-400 print:text-black">
                    ₹{receipt.totalPaidToDate.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 print:text-gray-600">Remaining Due:</span>{" "}
                  <span className="font-bold text-amber-400 print:text-black">
                    ₹{receipt.pendingBalance.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer / Verification Signoff */}
            <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400 print:border-gray-300 print:text-gray-600">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium print:text-black">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 print:hidden" />
                  Verified Counter Payment
                </div>
                <div>Issued by: {receipt.cashierName}</div>
                <div className="text-[10px] text-slate-500 font-mono print:text-gray-500">
                  Electronic Computer-Generated Voucher • No Signature Required
                </div>
              </div>

              <div className="text-left sm:text-right font-mono text-[11px] text-slate-500 print:text-gray-500">
                <div>Logged: {new Date(receipt.createdAt).toLocaleString("en-IN")}</div>
                <div className="text-[10px]">College ERP Financial Ledger</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
