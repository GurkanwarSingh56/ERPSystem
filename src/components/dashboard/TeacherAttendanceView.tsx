"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
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
  Save,
  Users,
  AlertTriangle,
  RotateCcw,
  Search,
  BookOpen,
  Filter,
  Check,
  X,
  History,
  FileText,
  Loader2,
} from "lucide-react";
import {
  TeacherAllocationItem,
  getAttendanceSessionAction,
  recordAttendanceAction,
  StudentRosterItem,
} from "@/app/actions/attendance";

interface Props {
  initialAllocations: TeacherAllocationItem[];
  user: {
    userId: string;
    fullName?: string;
    role: string;
    email?: string;
  };
}

export function TeacherAttendanceView({ initialAllocations, user }: Props) {
  // Selection States
  const [selectedAllocationId, setSelectedAllocationId] = useState<string>(
    initialAllocations[0]?.id || ""
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);

  // Roster & Session State
  const [roster, setRoster] = useState<StudentRosterItem[]>([]);
  const [isExistingSession, setIsExistingSession] = useState<boolean>(false);
  const [markedByName, setMarkedByName] = useState<string | undefined>(undefined);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | undefined>(undefined);
  const [timetableSlot, setTimetableSlot] = useState<any>(null);

  // Student marks state: studentId -> { status: "present" | "absent" | "leave", remarks: string }
  const [marks, setMarks] = useState<
    Record<string, { status: "present" | "absent" | "leave"; remarks: string }>
  >({});

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent" | "leave">("all");

  // Status & Feedback
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Active selected allocation object
  const activeAllocation = useMemo(() => {
    return (
      initialAllocations.find((a) => a.id === selectedAllocationId) ||
      initialAllocations[0] ||
      null
    );
  }, [initialAllocations, selectedAllocationId]);

  // Load Session & Roster
  const loadRosterForSelection = async () => {
    if (!activeAllocation) return;

    setIsLoadingRoster(true);
    setFeedback(null);

    const res = await getAttendanceSessionAction({
      sectionId: activeAllocation.sectionId,
      subjectId: activeAllocation.subjectId,
      date: selectedDate,
      periodNumber: selectedPeriod,
    });

    setIsLoadingRoster(false);

    if (!res.success || !res.data) {
      setFeedback({
        type: "error",
        message: res.error || "Failed to load class roster.",
      });
      setRoster([]);
      setMarks({});
      return;
    }

    const {
      roster: fetchedRoster,
      isExistingSession: existing,
      markedByName: markedBy,
      updatedAt,
      timetableSlot: slot,
    } = res.data;

    setRoster(fetchedRoster);
    setIsExistingSession(existing);
    setMarkedByName(markedBy);
    setLastUpdatedAt(updatedAt);
    setTimetableSlot(slot);

    // Initialize marks map: if existing session, use saved values; otherwise default to "present"
    const newMarks: Record<string, { status: "present" | "absent" | "leave"; remarks: string }> =
      {};
    fetchedRoster.forEach((student) => {
      newMarks[student.id] = {
        status: student.existingStatus || "present",
        remarks: student.existingRemarks || "",
      };
    });
    setMarks(newMarks);

    if (existing) {
      setFeedback({
        type: "info",
        message: `Existing attendance session loaded for Period ${selectedPeriod} on ${selectedDate}. Any edits will update this session.`,
      });
    }
  };

  // Re-fetch roster when allocation, date, or period changes
  useEffect(() => {
    if (activeAllocation) {
      loadRosterForSelection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAllocationId, selectedDate, selectedPeriod]);

  // Status Counts
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;

    Object.values(marks).forEach((m) => {
      if (m.status === "present") present++;
      else if (m.status === "absent") absent++;
      else if (m.status === "leave") leave++;
    });

    const total = roster.length;
    const percentage = total > 0 ? ((present / total) * 100).toFixed(1) : "0.0";

    return { total, present, absent, leave, percentage };
  }, [marks, roster]);

  // Batch actions
  const setAllStatus = (newStatus: "present" | "absent" | "leave") => {
    setMarks((prev) => {
      const updated = { ...prev };
      roster.forEach((student) => {
        updated[student.id] = {
          ...updated[student.id],
          status: newStatus,
        };
      });
      return updated;
    });
  };

  // Single student status toggle
  const updateStudentStatus = (
    studentId: string,
    status: "present" | "absent" | "leave"
  ) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: {
        status,
        remarks: prev[studentId]?.remarks || "",
      },
    }));
  };

  // Student remarks change
  const updateStudentRemarks = (studentId: string, remarks: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || "present",
        remarks,
      },
    }));
  };

  // Filtered Roster for display
  const filteredRoster = useMemo(() => {
    return roster.filter((student) => {
      const mark = marks[student.id];
      if (statusFilter !== "all" && mark?.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesRoll = student.rollNumber.toLowerCase().includes(query);
        const matchesName = student.fullName.toLowerCase().includes(query);
        return matchesRoll || matchesName;
      }
      return true;
    });
  }, [roster, marks, statusFilter, searchQuery]);

  // Submit Batch Attendance
  const handleSaveAttendance = () => {
    if (!activeAllocation || roster.length === 0) return;

    setFeedback(null);

    // Prepare payload
    const records = roster.map((student) => ({
      studentId: student.id,
      status: marks[student.id]?.status || "present",
      remarks: marks[student.id]?.remarks || undefined,
    }));

    startTransition(async () => {
      const res = await recordAttendanceAction({
        date: selectedDate,
        periodNumber: selectedPeriod,
        sectionId: activeAllocation.sectionId,
        subjectId: activeAllocation.subjectId,
        records,
      });

      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || "Failed to save attendance record.",
        });
      } else {
        const actionWord = res.data?.isUpdate ? "updated" : "saved";
        setFeedback({
          type: "success",
          message: `Attendance successfully ${actionWord} for ${res.data?.recordedCount} students.`,
        });
        setIsExistingSession(true);
        setMarkedByName(user.fullName || "Current Faculty");
        setLastUpdatedAt(new Date().toISOString());
      }
    });
  };

  // Periods List 1-12
  const periodSlots = [
    { number: 1, label: "Period 1 (09:00 - 09:50)" },
    { number: 2, label: "Period 2 (09:50 - 10:40)" },
    { number: 3, label: "Period 3 (10:40 - 11:30)" },
    { number: 4, label: "Period 4 (11:30 - 12:20)" },
    { number: 5, label: "Period 5 (13:10 - 14:00)" },
    { number: 6, label: "Period 6 (14:00 - 14:50)" },
    { number: 7, label: "Period 7 (14:50 - 15:40)" },
    { number: 8, label: "Period 8 (15:40 - 16:30)" },
    { number: 9, label: "Period 9 (Extended 1)" },
    { number: 10, label: "Period 10 (Extended 2)" },
    { number: 11, label: "Period 11 (Tutorial)" },
    { number: 12, label: "Period 12 (Special)" },
  ];

  return (
    <div className="space-y-6">
      {/* Header controls & session configuration */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-xl backdrop-blur-sm">
        <CardHeader className="pb-4 border-b border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <span>Attendance Session Configuration</span>
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Select your assigned course cohort, subject, date, and academic period slot.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadRosterForSelection}
                disabled={isLoadingRoster || isSaving}
                className="bg-slate-800/60 border-slate-700 text-slate-300 hover:text-white"
              >
                <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingRoster ? "animate-spin" : ""}`} />
                Reload Roster
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Allocation Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Assigned Class & Subject
              </label>
              <select
                id="allocation-select"
                value={selectedAllocationId}
                onChange={(e) => setSelectedAllocationId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {initialAllocations.map((alloc) => (
                  <option key={alloc.id} value={alloc.id}>
                    {alloc.sectionName} — {alloc.subjectName} ({alloc.subjectCode})
                  </option>
                ))}
              </select>
              {activeAllocation && (
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeAllocation.courseCode} · Semester {activeAllocation.semesterNumber}
                </p>
              )}
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Session Date
              </label>
              <input
                id="attendance-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Cannot record attendance for future dates.
              </p>
            </div>

            {/* Period Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Academic Period
              </label>
              <select
                id="attendance-period"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {periodSlots.map((slot) => (
                  <option key={slot.number} value={slot.number}>
                    {slot.label}
                  </option>
                ))}
              </select>
              {timetableSlot && (
                <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Scheduled Slot: {timetableSlot.label} ({timetableSlot.startTime} - {timetableSlot.endTime})
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Banner if Overwriting an Existing Session */}
      {isExistingSession && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-semibold text-amber-200">
              Previously Recorded Session Loaded
            </h4>
            <p className="text-amber-300/80 text-xs mt-0.5">
              Attendance for Period {selectedPeriod} on {selectedDate} was already marked
              {markedByName ? ` by ${markedByName}` : ""}. Editing and saving will overwrite the
              existing records and create a verified entry in the tamper-evident audit ledger.
            </p>
            {lastUpdatedAt && (
              <p className="text-[11px] text-amber-400/60 mt-1 font-mono">
                Last modified: {new Date(lastUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg text-sm flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-950/50 border border-emerald-500/50 text-emerald-200"
              : feedback.type === "error"
              ? "bg-rose-950/50 border border-rose-500/50 text-rose-200"
              : "bg-indigo-950/50 border border-indigo-500/50 text-indigo-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : feedback.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Summary KPI Cards & Batch Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-slate-400">Total Enrolled</p>
              <div className="text-2xl font-bold text-white mt-0.5">{counts.total}</div>
            </div>
            <Users className="w-6 h-6 text-slate-500" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-emerald-400">Present</p>
              <div className="text-2xl font-bold text-emerald-400 mt-0.5">{counts.present}</div>
            </div>
            <span className="text-xs font-mono font-medium text-emerald-400/80 bg-emerald-950/60 px-2 py-1 rounded">
              {counts.percentage}%
            </span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-rose-400">Absent</p>
              <div className="text-2xl font-bold text-rose-400 mt-0.5">{counts.absent}</div>
            </div>
            <XCircle className="w-6 h-6 text-rose-500/40" />
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase text-amber-400">Leave</p>
              <div className="text-2xl font-bold text-amber-400 mt-0.5">{counts.leave}</div>
            </div>
            <Clock className="w-6 h-6 text-amber-500/40" />
          </CardContent>
        </Card>
      </div>

      {/* Main Roster Card */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-xl overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mr-1">
              Batch Quick Actions:
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllStatus("present")}
              className="bg-emerald-950/40 text-emerald-300 border-emerald-800/60 hover:bg-emerald-900/60 text-xs h-8"
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Mark All Present
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllStatus("absent")}
              className="bg-rose-950/40 text-rose-300 border-rose-800/60 hover:bg-rose-900/60 text-xs h-8"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Mark All Absent
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllStatus("leave")}
              className="bg-amber-950/40 text-amber-300 border-amber-800/60 hover:bg-amber-900/60 text-xs h-8"
            >
              <Clock className="w-3.5 h-3.5 mr-1" />
              Mark All Leave
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Search filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search roll or student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
              />
            </div>

            {/* Filter by status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All ({roster.length})</option>
              <option value="present">Present ({counts.present})</option>
              <option value="absent">Absent ({counts.absent})</option>
              <option value="leave">Leave ({counts.leave})</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoadingRoster ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              <p className="text-sm">Loading official section roll call...</p>
            </div>
          ) : roster.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-50" />
              <p className="text-slate-300 font-medium">No students enrolled in this section.</p>
              <p className="text-xs text-slate-500 pt-1">
                Ensure section rosters are mapped in the Academic Structure master.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4 text-center">Attendance Status</th>
                    <th className="py-3 px-4">Remarks / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans text-xs">
                  {filteredRoster.map((student, idx) => {
                    const currentMark = marks[student.id]?.status || "present";
                    const currentRemarks = marks[student.id]?.remarks || "";

                    return (
                      <tr
                        key={student.id}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          currentMark === "absent"
                            ? "bg-rose-950/10"
                            : currentMark === "leave"
                            ? "bg-amber-950/10"
                            : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-center text-slate-500 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                          {student.rollNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-white">
                          <div>{student.fullName}</div>
                          {student.admissionNumber && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              Adm: {student.admissionNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateStudentStatus(student.id, "present")}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-all ${
                                currentMark === "present"
                                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950 font-bold"
                                  : "bg-slate-800/80 text-slate-400 hover:text-emerald-300 hover:bg-slate-800"
                              }`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStudentStatus(student.id, "absent")}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-all ${
                                currentMark === "absent"
                                  ? "bg-rose-600 text-white shadow-md shadow-rose-950 font-bold"
                                  : "bg-slate-800/80 text-slate-400 hover:text-rose-300 hover:bg-slate-800"
                              }`}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStudentStatus(student.id, "leave")}
                              className={`px-3 py-1.5 rounded-md text-xs font-medium font-mono transition-all ${
                                currentMark === "leave"
                                  ? "bg-amber-600 text-white shadow-md shadow-amber-950 font-bold"
                                  : "bg-slate-800/80 text-slate-400 hover:text-amber-300 hover:bg-slate-800"
                              }`}
                            >
                              Leave
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            placeholder="Optional remark (e.g. late, medical)..."
                            value={currentRemarks}
                            onChange={(e) => updateStudentRemarks(student.id, e.target.value)}
                            className="w-full bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-600"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Action Footer */}
        {roster.length > 0 && (
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Ready to record attendance for{" "}
              <span className="font-semibold text-white">{roster.length}</span> students:{" "}
              <span className="text-emerald-400 font-bold">{counts.present} Present</span>,{" "}
              <span className="text-rose-400 font-bold">{counts.absent} Absent</span>,{" "}
              <span className="text-amber-400 font-bold">{counts.leave} Leave</span>.
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleSaveAttendance}
                disabled={isSaving || isLoadingRoster}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-5 py-2 h-auto shadow-lg shadow-emerald-950 transition-all flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving Session...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {isExistingSession ? "Update Attendance Session" : "Save Attendance Session"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
