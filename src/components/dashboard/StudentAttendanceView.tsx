"use client";

import { useState, useMemo } from "react";
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
  CheckSquare,
  ArrowLeft,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Filter,
  Search,
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Award,
} from "lucide-react";
import { StudentAttendanceSummary } from "@/app/actions/attendance";

interface Props {
  summary: StudentAttendanceSummary;
}

export function StudentAttendanceView({ summary }: Props) {
  const { studentInfo, overall, subjectWise, history } = summary;

  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter history records
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (selectedSubjectId !== "all") {
        const sub = subjectWise.find((s) => s.subjectId === selectedSubjectId);
        if (sub && item.subjectCode !== sub.subjectCode) return false;
      }
      if (selectedStatus !== "all" && item.status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSub = item.subjectName.toLowerCase().includes(q) || item.subjectCode.toLowerCase().includes(q);
        const matchesRemarks = (item.remarks || "").toLowerCase().includes(q);
        const matchesFaculty = (item.markedByName || "").toLowerCase().includes(q);
        return matchesSub || matchesRemarks || matchesFaculty;
      }
      return true;
    });
  }, [history, selectedSubjectId, selectedStatus, searchQuery, subjectWise]);

  const getStatusBadge = (status: "present" | "absent" | "leave") => {
    switch (status) {
      case "present":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Present
          </Badge>
        );
      case "leave":
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">
            <Clock className="w-3 h-3 mr-1" />
            Leave
          </Badge>
        );
      case "absent":
      default:
        return (
          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40">
            <XCircle className="w-3 h-3 mr-1" />
            Absent
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Student Academic Identification Header Card */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-xl backdrop-blur-sm">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
              {studentInfo.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{studentInfo.fullName}</h2>
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 font-mono text-[11px]">
                  Roll: {studentInfo.rollNumber}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {studentInfo.courseName} · Semester {studentInfo.semesterNumber} · {studentInfo.sectionName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5">
            <div className="text-right">
              <span className="text-xs font-mono text-slate-400">Institutional Standing</span>
              <div className="text-sm font-semibold flex items-center gap-1.5 justify-end mt-0.5">
                {overall.isCompliant ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Exam Eligible (≥ 75%)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-rose-400">Shortage Warning (&lt; 75%)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Stat KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Overall Percentage */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-slate-400">
              Overall Percentage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${
                overall.isCompliant ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {overall.percentage}%
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  overall.isCompliant ? "bg-emerald-500" : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(overall.percentage, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 pt-1.5 font-mono">
              Threshold: 75.0% required
            </p>
          </CardContent>
        </Card>

        {/* Present Sessions */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-emerald-400">
              Classes Attended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {overall.presentCount}{" "}
              <span className="text-sm text-slate-500 font-normal">/ {overall.totalClasses}</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 font-mono">
              Present period roll calls
            </p>
          </CardContent>
        </Card>

        {/* Absent Sessions */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-rose-400">
              Unexcused Absences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-400">{overall.absentCount}</div>
            <p className="text-[11px] text-slate-400 pt-1 font-mono">
              Missed lectures & labs
            </p>
          </CardContent>
        </Card>

        {/* Approved Leave */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono uppercase text-amber-400">
              Authorized Leaves
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">{overall.leaveCount}</div>
            <p className="text-[11px] text-slate-400 pt-1 font-mono">
              Medical & official duty
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Official Attendance Computation Policy Note */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3.5 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-slate-300">Attendance Calculation Policy:</span>{" "}
          Overall attendance is computed as{" "}
          <code className="text-indigo-300 bg-slate-950 px-1 py-0.5 rounded font-mono text-[11px]">
            (Attended Classes ÷ Total Scheduled Classes) × 100
          </code>
          . Authorized leaves are recorded distinctly and evaluated separately during examination
          admit card clearance.
        </div>
      </div>

      {/* Subject-Wise Attendance Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>Subject-Wise Attendance Breakdown</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {subjectWise.length} Academic Subjects
          </span>
        </div>

        {subjectWise.length === 0 ? (
          <Card className="bg-slate-900/80 border-slate-800 p-8 text-center text-slate-500 text-xs">
            No subject attendance records found.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectWise.map((sub) => (
              <Card
                key={sub.subjectId}
                className="bg-slate-900/80 border-slate-800 hover:border-slate-700 transition-colors"
              >
                <CardHeader className="pb-3 border-b border-slate-800/60">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold text-white">
                        {sub.subjectName}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono text-indigo-400 mt-0.5">
                        {sub.subjectCode}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-mono ${
                        sub.isCompliant
                          ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/20"
                          : "text-rose-400 border-rose-500/30 bg-rose-950/20"
                      }`}
                    >
                      {sub.percentage}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 space-y-2">
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        sub.isCompliant ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${Math.min(sub.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono pt-1 text-slate-400">
                    <span className="text-emerald-400 font-semibold">{sub.presentCount} Present</span>
                    <span className="text-rose-400 font-semibold">{sub.absentCount} Absent</span>
                    <span className="text-amber-400 font-semibold">{sub.leaveCount} Leave</span>
                    <span className="text-slate-300 font-bold">{sub.totalClasses} Total</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Date-Wise Session History Log Table */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Verified Session Attendance History</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              Historical ledger of every official class roll call logged by faculty.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Subject Filter */}
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Subjects</option>
              {subjectWise.map((sub) => (
                <option key={sub.subjectId} value={sub.subjectId}>
                  {sub.subjectCode} — {sub.subjectName}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
            </select>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredHistory.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <Calendar className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
              No attendance records match your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Faculty</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-200">
                        {item.date}
                      </td>
                      <td className="py-3 px-4 font-mono text-indigo-300">
                        Period {item.periodNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{item.subjectName}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {item.subjectCode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {item.markedByName || "Faculty"}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(item.status)}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {item.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
