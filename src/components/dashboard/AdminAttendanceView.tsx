"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Search,
  Filter,
  BarChart3,
  BookOpen,
  History,
  Edit,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ChevronRight,
  TrendingDown,
  Check,
  X,
} from "lucide-react";
import {
  AdminAttendanceReportData,
  AdminAttendanceReportFilters,
  getAdminAttendanceReportAction,
  updateAttendanceRecordAction,
} from "@/app/actions/attendance";

interface FilterOption {
  id: string;
  name: string;
  code?: string;
  semesterNumber?: number;
}

interface Props {
  initialReport: AdminAttendanceReportData;
  courses: FilterOption[];
  semesters: FilterOption[];
  sections: FilterOption[];
  subjects: FilterOption[];
  user: {
    userId: string;
    role: string;
    fullName?: string;
  };
}

export function AdminAttendanceView({
  initialReport,
  courses,
  semesters,
  sections,
  subjects,
  user,
}: Props) {
  // Filters State
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [threshold, setThreshold] = useState<number>(75);

  // Active Report Data
  const [reportData, setReportData] = useState<AdminAttendanceReportData>(initialReport);
  const [isPending, startTransition] = useTransition();

  // Tab State
  const [activeTab, setActiveTab] = useState<"defaulters" | "subjects" | "students" | "audit">(
    "defaulters"
  );

  // Correction Modal State
  const [editingAuditItem, setEditingAuditItem] = useState<{
    attendanceId: string;
    studentName: string;
    currentStatus: "present" | "absent" | "leave";
  } | null>(null);
  const [correctionNewStatus, setCorrectionNewStatus] = useState<"present" | "absent" | "leave">(
    "present"
  );
  const [correctionReason, setCorrectionReason] = useState("");
  const [isUpdatingRecord, startUpdateTransition] = useTransition();
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Apply Filters
  const handleApplyFilters = () => {
    startTransition(async () => {
      const filters: AdminAttendanceReportFilters = {
        courseId: selectedCourseId || undefined,
        semesterId: selectedSemesterId || undefined,
        sectionId: selectedSectionId || undefined,
        subjectId: selectedSubjectId || undefined,
        date: selectedDate || undefined,
        threshold,
      };

      const res = await getAdminAttendanceReportAction(filters);
      if (res.success && res.data) {
        setReportData(res.data);
      }
    });
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCourseId("");
    setSelectedSemesterId("");
    setSelectedSectionId("");
    setSelectedSubjectId("");
    setSelectedDate("");
    setThreshold(75);

    startTransition(async () => {
      const res = await getAdminAttendanceReportAction({ threshold: 75 });
      if (res.success && res.data) {
        setReportData(res.data);
      }
    });
  };

  // Submit Correction
  const handleSaveCorrection = () => {
    if (!editingAuditItem) return;
    if (!correctionReason.trim()) {
      setModalFeedback("Please enter a valid audit reason for this status correction.");
      return;
    }

    startUpdateTransition(async () => {
      setModalFeedback(null);
      const res = await updateAttendanceRecordAction({
        attendanceId: editingAuditItem.attendanceId,
        newStatus: correctionNewStatus,
        reason: correctionReason,
      });

      if (!res.success) {
        setModalFeedback(res.error || "Failed to update attendance record.");
      } else {
        // Refresh report
        const refresh = await getAdminAttendanceReportAction({
          courseId: selectedCourseId || undefined,
          semesterId: selectedSemesterId || undefined,
          sectionId: selectedSectionId || undefined,
          subjectId: selectedSubjectId || undefined,
          date: selectedDate || undefined,
          threshold,
        });
        if (refresh.success && refresh.data) {
          setReportData(refresh.data);
        }
        setEditingAuditItem(null);
        setCorrectionReason("");
      }
    });
  };

  const { overview, studentSummaries, subjectSummaries, recentAuditTrail } = reportData;

  const defaulters = useMemo(() => {
    return studentSummaries.filter((s) => s.isBelowThreshold);
  }, [studentSummaries]);

  return (
    <div className="space-y-6">
      {/* Filter Toolbar Card */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-xl backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-400" />
                <span>Attendance Filter & Scope Controls</span>
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-0.5">
                Aggregate attendance metrics across departments, semesters, sections, and dates.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                disabled={isPending}
                className="bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white text-xs h-8"
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleApplyFilters}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 flex items-center gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Apply Filters</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {/* Course */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Academic Course
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Semester */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Semester</label>
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Semesters</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    Semester {s.semesterNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Section</label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">Subject</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Specific Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Threshold Slider / Input */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Threshold: <span className="text-amber-400 font-bold">{threshold}%</span>
              </label>
              <input
                type="number"
                min="50"
                max="95"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded py-1.5 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* Total Sessions Recorded */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-mono uppercase text-slate-400">Total Sessions</span>
            <div className="text-2xl font-bold text-white mt-1">{overview.totalSessions}</div>
          </CardContent>
        </Card>

        {/* Present Count */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-mono uppercase text-emerald-400">Present</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{overview.totalPresent}</div>
          </CardContent>
        </Card>

        {/* Absent Count */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-mono uppercase text-rose-400">Absent</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">{overview.totalAbsent}</div>
          </CardContent>
        </Card>

        {/* Leave Count */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-mono uppercase text-amber-400">Leave</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{overview.totalLeave}</div>
          </CardContent>
        </Card>

        {/* Campus Average % */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-mono uppercase text-indigo-400">Average %</span>
            <div className="text-2xl font-bold text-indigo-400 mt-1">
              {overview.averagePercentage}%
            </div>
          </CardContent>
        </Card>

        {/* Defaulters / Below Threshold */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3.5">
            <span className="text-[10px] font-mono uppercase text-rose-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-rose-400" />
              Below {threshold}%
            </span>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {overview.atRiskStudentsCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab("defaulters")}
          className={`py-2 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "defaulters"
              ? "border-rose-500 text-rose-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>At-Risk Students ({defaulters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("students")}
          className={`py-2 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "students"
              ? "border-emerald-500 text-emerald-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Student Directory ({studentSummaries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("subjects")}
          className={`py-2 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "subjects"
              ? "border-indigo-500 text-indigo-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Subject Summaries ({subjectSummaries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`py-2 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "audit"
              ? "border-amber-500 text-amber-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Trail ({recentAuditTrail.length})</span>
        </button>
      </div>

      {/* Tab 1: Defaulters / At-Risk */}
      {activeTab === "defaulters" && (
        <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Students Falling Below Minimum Required Attendance ({threshold}%)</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              Identifies candidates at risk of exam debarment due to insufficient lecture attendance.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {defaulters.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="font-semibold text-emerald-300">
                  No attendance defaulters under {threshold}%!
                </p>
                <p className="text-slate-500">All enrolled cohorts satisfy academic criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4 text-center">Classes Attended</th>
                      <th className="py-3 px-4 text-center">Unexcused Absences</th>
                      <th className="py-3 px-4 text-center">Percentage</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                    {defaulters.map((s) => (
                      <tr key={s.studentId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-rose-300">
                          {s.rollNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-white">{s.fullName}</td>
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          {s.courseCode} · {s.sectionName}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-400">
                          {s.present} / {s.total}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-rose-400">{s.absent}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-rose-400">
                          {s.percentage}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className="bg-rose-950/60 text-rose-300 border-rose-500/40 text-[10px]">
                            Defaulter Warning
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: All Students Directory */}
      {activeTab === "students" && (
        <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Full Student Attendance Roster</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {studentSummaries.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                No student attendance records found matching filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4 text-center">Present</th>
                      <th className="py-3 px-4 text-center">Absent</th>
                      <th className="py-3 px-4 text-center">Leave</th>
                      <th className="py-3 px-4 text-center">Total</th>
                      <th className="py-3 px-4 text-center">Percentage</th>
                      <th className="py-3 px-4 text-center">Eligibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                    {studentSummaries.map((s) => (
                      <tr key={s.studentId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                          {s.rollNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-white">{s.fullName}</td>
                        <td className="py-3 px-4 text-slate-300 font-mono">
                          {s.courseCode} · {s.sectionName}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-400">
                          {s.present}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-rose-400">{s.absent}</td>
                        <td className="py-3 px-4 text-center font-mono text-amber-400">{s.leave}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">{s.total}</td>
                        <td
                          className={`py-3 px-4 text-center font-mono font-bold ${
                            s.percentage >= threshold ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {s.percentage}%
                        </td>
                        <td className="py-3 px-4 text-center">
                          {s.percentage >= threshold ? (
                            <Badge className="bg-emerald-950/60 text-emerald-300 border-emerald-500/40 text-[10px]">
                              Eligible
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-950/60 text-rose-300 border-rose-500/40 text-[10px]">
                              Defaulter
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Subject & Class Summaries */}
      {activeTab === "subjects" && (
        <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Curricular Subject Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {subjectSummaries.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                No subject attendance summaries available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Section</th>
                      <th className="py-3 px-4 text-center">Total Sessions</th>
                      <th className="py-3 px-4 text-center">Present</th>
                      <th className="py-3 px-4 text-center">Absent</th>
                      <th className="py-3 px-4 text-center">Leave</th>
                      <th className="py-3 px-4 text-center">Average Attendance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                    {subjectSummaries.map((sub, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-white">{sub.subjectName}</td>
                        <td className="py-3 px-4 font-mono text-indigo-300">{sub.subjectCode}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{sub.sectionName}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-200">
                          {sub.totalSessions}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-emerald-400">
                          {sub.presentCount}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-rose-400">
                          {sub.absentCount}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-amber-400">
                          {sub.leaveCount}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-white">
                          <span
                            className={
                              sub.percentage >= threshold ? "text-emerald-400" : "text-rose-400"
                            }
                          >
                            {sub.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Audit Trail */}
      {activeTab === "audit" && (
        <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>Tamper-Resistant Attendance Modification Ledger</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              PostgreSQL trigger-enforced immutable historical log of all roll call modifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentAuditTrail.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-xs">
                No attendance modifications recorded in the audit trail yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-center">Transition</th>
                      <th className="py-3 px-4">Changed By</th>
                      <th className="py-3 px-4">Audit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {recentAuditTrail.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(a.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-white">
                          {a.studentName} ({a.rollNumber})
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-300">{a.subjectName}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="uppercase text-slate-400 line-through mr-1">
                            {a.previousStatus}
                          </span>
                          →{" "}
                          <span className="uppercase font-bold text-emerald-400 ml-1">
                            {a.newStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-300">{a.changedByName}</td>
                        <td className="py-3 px-4 font-sans text-slate-300">{a.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Correction Modal */}
      {editingAuditItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-slate-800 w-full max-w-md shadow-2xl">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-base font-semibold text-white">
                Correct Attendance Record
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Modifying record for {editingAuditItem.studentName}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {modalFeedback && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalFeedback}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  New Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectionNewStatus("present")}
                    className={`py-2 px-3 rounded text-xs font-mono font-medium border ${
                      correctionNewStatus === "present"
                        ? "bg-emerald-600 text-white border-emerald-500 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorrectionNewStatus("absent")}
                    className={`py-2 px-3 rounded text-xs font-mono font-medium border ${
                      correctionNewStatus === "absent"
                        ? "bg-rose-600 text-white border-rose-500 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    Absent
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorrectionNewStatus("leave")}
                    className={`py-2 px-3 rounded text-xs font-mono font-medium border ${
                      correctionNewStatus === "leave"
                        ? "bg-amber-600 text-white border-amber-500 font-bold"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    Leave
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Audit Reason (Strictly Required)
                </label>
                <textarea
                  rows={3}
                  placeholder="Specify official rationale (e.g., student attended lab with permission, medical certificate provided)..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingAuditItem(null)}
                  disabled={isUpdatingRecord}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCorrection}
                  disabled={isUpdatingRecord}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                >
                  {isUpdatingRecord ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : null}
                  Confirm & Log Audit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
