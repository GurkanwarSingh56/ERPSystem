"use client";

import { useState, useTransition } from "react";
import {
  createFeeAllocationAction,
  updateFeeAllocationAction,
  CreateFeeAllocationInput,
} from "@/app/actions/fees";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Filter,
  DollarSign,
  PlusCircle,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  CreditCard,
  Banknote,
  Receipt,
  X,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";

export interface StudentOption {
  id: string;
  fullName: string;
  rollNumber: string;
  admissionNumber: string;
  email: string;
  departmentName?: string | null;
  courseName?: string | null;
}

export interface AdminFeeAllocationItem {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  rollNumber: string;
  admissionNumber: string;
  academicYear: string;
  totalFee: number;
  paidAmount: number;
  pendingAmount: number;
  departmentName?: string | null;
  courseName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminFeeManagementViewProps {
  allocations: AdminFeeAllocationItem[];
  students: StudentOption[];
  academicYears: string[];
}

export function AdminFeeManagementView({
  allocations,
  students,
  academicYears,
}: AdminFeeManagementViewProps) {
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Modal States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<AdminFeeAllocationItem | null>(null);

  // Form Fields - New Allocation
  const [newStudentId, setNewStudentId] = useState("");
  const [studentSearchText, setStudentSearchText] = useState("");
  const [newAcademicYear, setNewAcademicYear] = useState(academicYears[0] || "2026-27");
  const [newTotalFee, setNewTotalFee] = useState("");
  const [isConfirmingAssign, setIsConfirmingAssign] = useState(false);

  // Form Fields - Edit Allocation
  const [editTotalFee, setEditTotalFee] = useState("");
  const [isConfirmingEdit, setIsConfirmingEdit] = useState(false);

  // Feedback State
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Financial Metrics Calculation
  const totalAllocated = allocations.reduce((acc, a) => acc + a.totalFee, 0);
  const totalCollected = allocations.reduce((acc, a) => acc + a.paidAmount, 0);
  const totalOutstanding = allocations.reduce((acc, a) => acc + a.pendingAmount, 0);

  // Filtered Allocations
  const filteredAllocations = allocations.filter((item) => {
    // 1. Text Search (name, roll_number, admission_number)
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.studentName.toLowerCase().includes(q) ||
      item.rollNumber.toLowerCase().includes(q) ||
      item.admissionNumber.toLowerCase().includes(q) ||
      item.studentEmail.toLowerCase().includes(q);

    // 2. Year Filter
    const matchesYear =
      selectedYearFilter === "all" || item.academicYear === selectedYearFilter;

    // 3. Status Filter
    let matchesStatus = true;
    if (selectedStatusFilter === "paid") {
      matchesStatus = item.pendingAmount <= 0 && item.paidAmount > 0;
    } else if (selectedStatusFilter === "partial") {
      matchesStatus = item.paidAmount > 0 && item.pendingAmount > 0;
    } else if (selectedStatusFilter === "unpaid") {
      matchesStatus = item.paidAmount === 0 && item.totalFee > 0;
    }

    return matchesSearch && matchesYear && matchesStatus;
  });

  // Filtered Students for combobox/picker in Assign Modal
  const filteredStudents = students.filter((s) => {
    const q = studentSearchText.toLowerCase().trim();
    if (!q) return true;
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.rollNumber.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  const selectedStudentObj = students.find((s) => s.id === newStudentId);

  // Handlers
  const handleOpenAssignModal = () => {
    setActionError(null);
    setActionSuccess(null);
    setNewStudentId("");
    setStudentSearchText("");
    setNewTotalFee("");
    setIsConfirmingAssign(false);
    setIsAssignModalOpen(true);
  };

  const handleOpenEditModal = (allocation: AdminFeeAllocationItem) => {
    setActionError(null);
    setActionSuccess(null);
    setEditingAllocation(allocation);
    setEditTotalFee(allocation.totalFee.toString());
    setIsConfirmingEdit(false);
  };

  const handleExecuteAssign = () => {
    setActionError(null);
    setActionSuccess(null);

    const feeNum = parseFloat(newTotalFee);
    if (!newStudentId) {
      setActionError("Please select a student.");
      return;
    }
    if (!newAcademicYear.trim()) {
      setActionError("Please provide an academic year.");
      return;
    }
    if (isNaN(feeNum) || feeNum < 0) {
      setActionError("Total fee amount must be a non-negative number.");
      return;
    }

    startTransition(async () => {
      const res = await createFeeAllocationAction({
        studentId: newStudentId,
        academicYear: newAcademicYear.trim(),
        totalFee: feeNum,
      });

      if (!res.success) {
        setActionError(res.error || "Failed to create fee allocation.");
        setIsConfirmingAssign(false);
      } else {
        setActionSuccess(
          `Fee allocation of ₹${feeNum.toLocaleString("en-IN")} assigned successfully for ${selectedStudentObj?.fullName || "Student"}.`
        );
        setIsAssignModalOpen(false);
        setIsConfirmingAssign(false);
      }
    });
  };

  const handleExecuteEdit = () => {
    if (!editingAllocation) return;
    setActionError(null);
    setActionSuccess(null);

    const feeNum = parseFloat(editTotalFee);
    if (isNaN(feeNum) || feeNum < 0) {
      setActionError("Total fee amount must be a non-negative number.");
      return;
    }

    if (feeNum < editingAllocation.paidAmount) {
      setActionError(
        `Total fee cannot be reduced below the already collected amount of ₹${editingAllocation.paidAmount.toLocaleString("en-IN")}.`
      );
      return;
    }

    startTransition(async () => {
      const res = await updateFeeAllocationAction({
        feeId: editingAllocation.id,
        totalFee: feeNum,
      });

      if (!res.success) {
        setActionError(res.error || "Failed to update fee allocation.");
        setIsConfirmingEdit(false);
      } else {
        setActionSuccess(
          `Fee allocation updated to ₹${feeNum.toLocaleString("en-IN")} successfully for ${editingAllocation.studentName}.`
        );
        setEditingAllocation(null);
        setIsConfirmingEdit(false);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Fee Structure & Student Allocation
          </h1>
          <p className="text-slate-400 text-sm pt-1">
            Institutional fee scheduling, student academic year allocations, and balance governance.
          </p>
        </div>
        <Button
          onClick={handleOpenAssignModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-2 shadow-lg shadow-indigo-600/20"
        >
          <PlusCircle className="w-4 h-4" />
          Assign Student Fee
        </Button>
      </div>

      {/* Global Action Banner Feedback */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 flex items-center justify-between gap-3 shadow-md animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 flex items-center justify-between gap-3 shadow-md animate-in fade-in-50">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-sm font-medium">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Allocated</CardTitle>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              ₹{totalAllocated.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-400 pt-1">
              Across {allocations.length} student record{allocations.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Collected</CardTitle>
            <Banknote className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              ₹{totalCollected.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-400 pt-1">Offline verified collections</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Outstanding Dues</CardTitle>
            <Receipt className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              ₹{totalOutstanding.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-400 pt-1">Unpaid student balances</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Total Allocations</CardTitle>
            <Users className="w-4 h-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-400">{allocations.length}</div>
            <p className="text-xs text-slate-400 pt-1">Enrolled student fees</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, roll number, admission number, or email..."
              className="pl-10 bg-slate-950/80 border-slate-800 text-slate-200 placeholder:text-slate-500 text-sm focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Year:</span>
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Academic Years</option>
                {academicYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Status:</span>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Fully Paid</option>
                <option value="partial">Partially Paid</option>
                <option value="unpaid">Unpaid / Full Due</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Allocations Table */}
      <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
        <CardHeader className="border-b border-slate-800/80 py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-white">
              Student Fee Allocations
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Showing {filteredAllocations.length} of {allocations.length} total records
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredAllocations.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-medium text-slate-300">No fee allocations found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto pt-1">
                {searchQuery || selectedYearFilter !== "all" || selectedStatusFilter !== "all"
                  ? "Try adjusting your search criteria or clearing selected filters."
                  : "No fee allocations have been assigned to students yet."}
              </p>
              {!allocations.length && (
                <Button
                  onClick={handleOpenAssignModal}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                  Assign First Fee Allocation
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs uppercase font-medium tracking-wider">
                    <th className="py-3 px-6">Student</th>
                    <th className="py-3 px-6">Academic Year</th>
                    <th className="py-3 px-6 text-right">Total Fee</th>
                    <th className="py-3 px-6 text-right">Paid Amount</th>
                    <th className="py-3 px-6 text-right">Outstanding</th>
                    <th className="py-3 px-6 text-center">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredAllocations.map((alloc) => {
                    const isFullyPaid = alloc.pendingAmount <= 0 && alloc.paidAmount > 0;
                    const isPartial = alloc.paidAmount > 0 && alloc.pendingAmount > 0;
                    const isUnpaid = alloc.paidAmount === 0;

                    return (
                      <tr
                        key={alloc.id}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <div className="font-medium text-white">{alloc.studentName}</div>
                          <div className="text-xs text-slate-400 font-mono flex items-center gap-2 pt-0.5">
                            <span>Roll: {alloc.rollNumber}</span>
                            <span>•</span>
                            <span>Adm: {alloc.admissionNumber}</span>
                          </div>
                          {alloc.departmentName && (
                            <div className="text-[11px] text-slate-500 pt-0.5">
                              {alloc.departmentName}
                              {alloc.courseName ? ` • ${alloc.courseName}` : ""}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 font-mono text-slate-300">
                          {alloc.academicYear}
                        </td>
                        <td className="py-4 px-6 text-right font-medium text-white">
                          ₹{alloc.totalFee.toLocaleString("en-IN")}
                        </td>
                        <td className="py-4 px-6 text-right font-medium text-emerald-400">
                          ₹{alloc.paidAmount.toLocaleString("en-IN")}
                        </td>
                        <td className="py-4 px-6 text-right font-medium">
                          {alloc.pendingAmount > 0 ? (
                            <span className="text-amber-400">
                              ₹{alloc.pendingAmount.toLocaleString("en-IN")}
                            </span>
                          ) : (
                            <span className="text-slate-500">₹0</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isFullyPaid && (
                            <Badge className="bg-emerald-950/80 text-emerald-300 border-emerald-800">
                              Fully Paid
                            </Badge>
                          )}
                          {isPartial && (
                            <Badge className="bg-amber-950/80 text-amber-300 border-amber-800">
                              Partial
                            </Badge>
                          )}
                          {isUnpaid && (
                            <Badge className="bg-rose-950/80 text-rose-300 border-rose-800">
                              Unpaid
                            </Badge>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditModal(alloc)}
                            className="h-8 px-2.5 text-xs border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            Adjust Fee
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

      {/* ========================================================================= */}
      {/* MODAL 1: ASSIGN FEE TO STUDENT */}
      {/* ========================================================================= */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-400" />
                  Assign Student Fee Allocation
                </h3>
                <p className="text-xs text-slate-400 pt-0.5">
                  Allocate academic year fee schedule for an enrolled student
                </p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {actionError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* 1. Student Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Select Enrolled Student <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={studentSearchText}
                    onChange={(e) => setStudentSearchText(e.target.value)}
                    placeholder="Search student by name, roll #, or admission #..."
                    className="pl-9 bg-slate-950 border-slate-800 text-xs text-slate-200"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 divide-y divide-slate-800/60">
                  {filteredStudents.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No matching students found
                    </div>
                  ) : (
                    filteredStudents.map((s) => {
                      const isSelected = newStudentId === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setNewStudentId(s.id)}
                          className={`p-3 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                            isSelected
                              ? "bg-indigo-950/60 border-l-2 border-indigo-500 text-white"
                              : "hover:bg-slate-800/40 text-slate-300"
                          }`}
                        >
                          <div>
                            <div className="font-medium text-white">{s.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Roll: {s.rollNumber} • Adm: {s.admissionNumber}
                            </div>
                            {s.departmentName && (
                              <div className="text-[10px] text-slate-500">
                                {s.departmentName}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <Badge className="bg-indigo-600 text-white text-[10px]">
                              Selected
                            </Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {selectedStudentObj && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Selected: {selectedStudentObj.fullName} (Roll: {selectedStudentObj.rollNumber})
                  </p>
                )}
              </div>

              {/* 2. Academic Year */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Academic Year <span className="text-rose-400">*</span>
                </label>
                <Input
                  value={newAcademicYear}
                  onChange={(e) => setNewAcademicYear(e.target.value)}
                  placeholder="e.g. 2026-27"
                  className="bg-slate-950 border-slate-800 text-slate-200 text-xs font-mono"
                />
                <p className="text-[11px] text-slate-500">
                  Standard format: YYYY-YY (e.g. 2026-27). Each student can have only one allocation per academic year.
                </p>
              </div>

              {/* 3. Total Fee Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Total Fee Amount (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newTotalFee}
                    onChange={(e) => setNewTotalFee(e.target.value)}
                    placeholder="e.g. 75000"
                    className="pl-8 bg-slate-950 border-slate-800 text-slate-200 text-sm font-semibold"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Enter the gross annual tuition and fee requirement. Must be non-negative.
                </p>
              </div>

              {/* Confirmation Step */}
              {isConfirmingAssign && (
                <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/80 space-y-2 animate-in fade-in-50">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    Please Confirm Fee Allocation Details
                  </div>
                  <div className="text-xs text-slate-300 space-y-1 font-mono pl-6">
                    <div>Student: {selectedStudentObj?.fullName}</div>
                    <div>Academic Year: {newAcademicYear}</div>
                    <div>
                      Total Fee: ₹{parseFloat(newTotalFee || "0").toLocaleString("en-IN")}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-6 pt-1">
                    Once saved, the cashier desk will be able to collect offline installments against this allocation.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (isConfirmingAssign) {
                    setIsConfirmingAssign(false);
                  } else {
                    setIsAssignModalOpen(false);
                  }
                }}
                className="text-xs border-slate-800 hover:bg-slate-800 text-slate-300"
              >
                Cancel
              </Button>

              {!isConfirmingAssign ? (
                <Button
                  disabled={!newStudentId || !newAcademicYear || !newTotalFee || isPending}
                  onClick={() => setIsConfirmingAssign(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  Review Allocation
                </Button>
              ) : (
                <Button
                  disabled={isPending}
                  onClick={handleExecuteAssign}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium gap-2"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm & Save Allocation
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADJUST EXISTING ALLOCATION */}
      {/* ========================================================================= */}
      {editingAllocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-50">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-amber-400" />
                  Adjust Fee Allocation
                </h3>
                <p className="text-xs text-slate-400 pt-0.5">
                  Update fee structure for {editingAllocation.studentName}
                </p>
              </div>
              <button
                onClick={() => setEditingAllocation(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {actionError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Student Summary Banner */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Student:</span>
                  <span className="font-medium text-white">{editingAllocation.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Academic Year:</span>
                  <span className="font-mono text-slate-200">{editingAllocation.academicYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Total Fee:</span>
                  <span className="font-medium text-white">
                    ₹{editingAllocation.totalFee.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Already Paid:</span>
                  <span className="font-medium text-emerald-400">
                    ₹{editingAllocation.paidAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Pending Balance:</span>
                  <span className="font-medium text-amber-400">
                    ₹{editingAllocation.pendingAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Financial Safeguard Warning */}
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-300">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Financial Integrity Safeguard:</span> The new total
                  fee cannot be reduced below the amount already collected (₹
                  {editingAllocation.paidAmount.toLocaleString("en-IN")}). The payment ledger and
                  verified receipts remain completely unchanged.
                </div>
              </div>

              {/* New Total Fee Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  New Total Fee Amount (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min={editingAllocation.paidAmount}
                    step="0.01"
                    value={editTotalFee}
                    onChange={(e) => setEditTotalFee(e.target.value)}
                    placeholder="Enter new total fee..."
                    className="pl-8 bg-slate-950 border-slate-800 text-slate-200 text-sm font-semibold"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Minimum allowed amount: ₹{editingAllocation.paidAmount.toLocaleString("en-IN")}{" "}
                  (collected amount).
                </p>
              </div>

              {/* Confirmation Step */}
              {isConfirmingEdit && (
                <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/80 space-y-2 animate-in fade-in-50">
                  <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    Confirm Fee Adjustment
                  </div>
                  <div className="text-xs text-slate-300 space-y-1 font-mono pl-6">
                    <div>
                      Previous Total: ₹{editingAllocation.totalFee.toLocaleString("en-IN")}
                    </div>
                    <div>
                      New Total: ₹{parseFloat(editTotalFee || "0").toLocaleString("en-IN")}
                    </div>
                    <div>
                      New Outstanding: ₹
                      {Math.max(
                        0,
                        parseFloat(editTotalFee || "0") - editingAllocation.paidAmount
                      ).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => {
                  if (isConfirmingEdit) {
                    setIsConfirmingEdit(false);
                  } else {
                    setEditingAllocation(null);
                  }
                }}
                className="text-xs border-slate-800 hover:bg-slate-800 text-slate-300"
              >
                Cancel
              </Button>

              {!isConfirmingEdit ? (
                <Button
                  disabled={!editTotalFee || isPending}
                  onClick={() => setIsConfirmingEdit(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  Review Adjustment
                </Button>
              ) : (
                <Button
                  disabled={isPending}
                  onClick={handleExecuteEdit}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium gap-2"
                >
                  {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm & Apply Adjustment
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
