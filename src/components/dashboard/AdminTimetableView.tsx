"use client";

import { useState, useTransition, useMemo } from "react";
import {
  autoGenerateTimetableAction,
  generateDepartmentTimetableAction,
  publishTimetableAction,
  createTimetableRevisionAction,
  upsertRoomResourceAction,
  assignFacultySubjectAction,
  removeFacultySubjectAction,
} from "@/app/actions/timetable";
import {
  TimetableSlot,
  TimetableEntry,
  TimetableDay,
  TIMETABLE_DAYS,
} from "@/lib/timetable/generator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  Building,
  Loader2,
  BookOpen,
  GraduationCap,
  ArrowRight,
  Info,
  Users,
  Grid,
  FileSpreadsheet,
  Download,
  PlusCircle,
  Trash2,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SectionItem {
  id: string;
  name: string;
  course_id: string;
  semester_id: string;
  semester_number?: number;
  course_name: string;
  course_code: string;
}

interface AdminTimetableViewProps {
  initialTimetable: any;
  slots: TimetableSlot[];
  entries: TimetableEntry[];
  allYearEntries?: any[];
  departments?: any[];
  courses?: any[];
  semesters?: any[];
  sections: SectionItem[];
  rooms?: any[];
  teachers?: any[];
  academicYears: string[];
  selectedSectionId?: string;
  selectedAcademicYear: string;
  readiness?: {
    hasSlots: boolean;
    slotsCount: number;
    hasSubjects: boolean;
    subjectsCount: number;
    hasTeacherAssignments: boolean;
    teacherAssignmentsCount: number;
    hasRooms: boolean;
    roomsCount: number;
    missingDetails: string[];
    isReady: boolean;
    sectionSubjects?: any[];
    sectionAssignments?: any[];
  };
}

export function AdminTimetableView({
  initialTimetable,
  slots,
  entries,
  allYearEntries = [],
  departments = [],
  courses = [],
  semesters = [],
  sections,
  rooms = [],
  teachers = [],
  academicYears,
  selectedSectionId,
  selectedAcademicYear,
  readiness,
}: AdminTimetableViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Department-wide generation states
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departments[0]?.id || "");
  const [deptGenResult, setDeptGenResult] = useState<any>(null);

  // Active Main Tab: Generator / 4 Views / Resources & Mapping
  const [activeMainTab, setActiveMainTab] = useState<"generator" | "views" | "resources">("generator");

  // Four-View Selector: Class-wise | Lab-wise | Room-wise | Faculty-wise
  const [viewMode, setViewMode] = useState<"class" | "lab" | "room" | "faculty">("class");

  // View Filter Selectors
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  // Filters for Course and Semester to easily locate sections
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("");
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>("");

  const [workingDays, setWorkingDays] = useState<TimetableDay[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]);

  // Resource Management Form States
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"classroom" | "lab">("classroom");
  const [newRoomCapacity, setNewRoomCapacity] = useState("60");
  const [newRoomConsecutive, setNewRoomConsecutive] = useState(false);

  // Faculty Subject Assignment Form States
  const [assignFacultyId, setAssignFacultyId] = useState("");
  const [assignSubjectId, setAssignSubjectId] = useState("");

  const labs = useMemo(() => rooms.filter((r) => r.type === "lab"), [rooms]);
  const classrooms = useMemo(() => rooms.filter((r) => r.type !== "lab"), [rooms]);

  // Filter sections by selected course/semester if filters are active
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      if (selectedCourseFilter && s.course_id !== selectedCourseFilter) return false;
      if (selectedSemesterFilter && s.semester_id !== selectedSemesterFilter) return false;
      return true;
    });
  }, [sections, selectedCourseFilter, selectedSemesterFilter]);

  const activeSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId);
  }, [sections, selectedSectionId]);

  // Timetable grid index: day_slot -> entry
  const sectionGridMap = useMemo(() => {
    const map = new Map<string, TimetableEntry>();
    entries.forEach((e) => {
      map.set(`${e.day_of_week}_${e.slot_number}`, e);
    });
    return map;
  }, [entries]);

  // Auto-set default selections for views
  useMemo(() => {
    if (!selectedLabId && labs.length > 0) setSelectedLabId(labs[0].id);
    if (!selectedRoomId && classrooms.length > 0) setSelectedRoomId(classrooms[0].id);
    if (!selectedTeacherId && teachers.length > 0) setSelectedTeacherId(teachers[0].id);
  }, [labs, classrooms, teachers, selectedLabId, selectedRoomId, selectedTeacherId]);

  // Build grid map for active 4-view selection
  const viewGridMap = useMemo(() => {
    const map = new Map<string, any[]>();
    allYearEntries.forEach((entry) => {
      let matches = false;
      if (viewMode === "class" && activeSection) {
        matches = entry.timetables?.section_id === activeSection.id;
      } else if (viewMode === "lab") {
        matches = entry.room_id === selectedLabId || entry.rooms?.id === selectedLabId;
      } else if (viewMode === "room") {
        matches = entry.room_id === selectedRoomId || entry.rooms?.id === selectedRoomId;
      } else if (viewMode === "faculty") {
        matches = entry.teacher_id === selectedTeacherId;
      }

      if (matches) {
        const key = `${entry.day_of_week}_${entry.slot_number}`;
        const existing = map.get(key) || [];
        existing.push(entry);
        map.set(key, existing);
      }
    });
    return map;
  }, [allYearEntries, viewMode, activeSection, selectedLabId, selectedRoomId, selectedTeacherId]);

  // Compute selected teacher's assigned weekly load
  const selectedTeacherLoad = useMemo(() => {
    if (!selectedTeacherId) return 0;
    return allYearEntries
      .filter((e) => e.teacher_id === selectedTeacherId)
      .reduce((acc, curr) => acc + (curr.subjects?.weekly_hours || 1), 0);
  }, [allYearEntries, selectedTeacherId]);

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  const handleGenerateDepartment = () => {
    if (!selectedDeptId) {
      setErrorMsg("Please select a department to generate timetables for.");
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setDeptGenResult(null);

    startTransition(async () => {
      const res = await generateDepartmentTimetableAction({
        departmentId: selectedDeptId,
        academicYear: selectedAcademicYear,
        workingDays,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Department generation failed.");
      } else {
        setDeptGenResult(res.data);
        setSuccessMsg(
          `Department timetable generated! ${res.data?.successfulSections} sections succeeded, ${res.data?.failedSections} failed.`
        );
        router.refresh();
      }
    });
  };

  const handleGenerate = () => {
    if (!initialTimetable?.id) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await autoGenerateTimetableAction({
        timetableId: initialTimetable.id,
        workingDays,
        defaultRoomNumber: classrooms[0]?.room_number || "B-110",
      });

      if (!res.success) {
        setErrorMsg(res.error || "Generation failed.");
      } else {
        setSuccessMsg(
          `Timetable successfully generated with ${res.data?.generatedCount} class periods scheduled!`
        );
        router.refresh();
      }
    });
  };

  const handlePublish = () => {
    if (!initialTimetable?.id) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await publishTimetableAction(initialTimetable.id);
      if (!res.success) {
        setErrorMsg(res.error || "Publishing failed.");
      } else {
        setSuccessMsg("Timetable is officially PUBLISHED and now live for students and faculty!");
        router.refresh();
      }
    });
  };

  const handleCreateRevision = () => {
    if (!initialTimetable?.id) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await createTimetableRevisionAction(initialTimetable.id);
      if (!res.success) {
        setErrorMsg(res.error || "Revision creation failed.");
      } else {
        setSuccessMsg("Created a new working revision draft!");
        router.refresh();
      }
    });
  };

  const handleCreateRoom = () => {
    if (!newRoomNumber.trim()) {
      setErrorMsg("Room number is required.");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      const res = await upsertRoomResourceAction({
        roomNumber: newRoomNumber,
        name: newRoomName || `${newRoomType === "lab" ? "Lab" : "Classroom"} ${newRoomNumber}`,
        type: newRoomType,
        capacity: parseInt(newRoomCapacity, 10) || 60,
        requiresConsecutiveSlots: newRoomConsecutive,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to create room.");
      } else {
        setSuccessMsg(`Room ${newRoomNumber} saved successfully.`);
        setNewRoomNumber("");
        setNewRoomName("");
        router.refresh();
      }
    });
  };

  const handleAssignFaculty = () => {
    if (!assignFacultyId || !assignSubjectId || !activeSection) {
      setErrorMsg("Please select both faculty and subject.");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      const res = await assignFacultySubjectAction({
        teacherId: assignFacultyId,
        subjectId: assignSubjectId,
        sectionId: activeSection.id,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to assign faculty.");
      } else {
        setSuccessMsg("Faculty successfully assigned to subject!");
        setAssignFacultyId("");
        setAssignSubjectId("");
        router.refresh();
      }
    });
  };

  const handleRemoveAssignment = (id: string) => {
    startTransition(async () => {
      const res = await removeFacultySubjectAction(id);
      if (res.success) {
        setSuccessMsg("Assignment removed.");
        router.refresh();
      }
    });
  };

  // CSV Export for Active View
  const handleExportViewCsv = () => {
    const headers = ["Day", ...slots.map((s) => `${s.label} (${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)})`)];
    const rows = workingDays.map((day) => {
      const cols = [day.toUpperCase()];
      slots.forEach((s) => {
        if (s.is_break) {
          cols.push("BREAK");
        } else {
          const cellEntries = viewGridMap.get(`${day}_${s.slot_number}`) || [];
          if (cellEntries.length === 0) {
            cols.push("-");
          } else {
            const str = cellEntries
              .map((e) => `${e.subjects?.code || "Subject"} (${e.teachers?.profiles?.full_name || "Faculty"}) ${e.room_number || ""}`)
              .join(" | ");
            cols.push(`"${str.replace(/"/g, '""')}"`);
          }
        }
      });
      return cols.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timetable_${viewMode}_${selectedAcademicYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* HEADER CONTROLS & MAIN TABS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex border border-slate-800 rounded-lg p-1 bg-slate-950">
            <button
              onClick={() => setActiveMainTab("generator")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeMainTab === "generator"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Schedule Generator
            </button>
            <button
              onClick={() => setActiveMainTab("views")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeMainTab === "views"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Four Master Views
            </button>
            <button
              onClick={() => setActiveMainTab("resources")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeMainTab === "resources"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              Rooms & Faculty Mapping
            </button>
          </div>
        </div>

        {/* ACADEMIC YEAR SELECTOR */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Academic Year:</span>
          <select
            value={selectedAcademicYear}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set("year", e.target.value);
              router.push(url.pathname + url.search);
            }}
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
          >
            {academicYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {errorMsg && (
        <div className="p-3 bg-red-950/60 border border-red-800 rounded-md flex items-center gap-2 text-red-200 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-md flex items-center gap-2 text-emerald-200 text-xs">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 1: SCHEDULE GENERATOR */}
      {/* ======================================================================= */}
      {activeMainTab === "generator" && (
        <div className="space-y-6">
          {/* DEPARTMENT-WIDE SCHEDULE GENERATION CARD */}
          <Card className="bg-gradient-to-r from-slate-900 via-indigo-950/20 to-slate-900 border-indigo-900/40">
            <CardHeader className="pb-3 border-b border-indigo-900/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-xs uppercase tracking-wider text-indigo-300 font-mono flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Primary Mode: Department-Wide Timetable Generation
                </CardTitle>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Department:</span>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-medium text-xs focus:ring-1 focus:ring-indigo-500"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-white">
                    Simultaneous Cross-Section Conflict-Free Scheduling
                  </p>
                  <p className="text-slate-400 leading-relaxed max-w-2xl">
                    Schedules all semesters, sections, labs and theory lectures across the entire department together in one operation. Maintains shared global faculty and room occupancy registries to ensure zero double-booking.
                  </p>
                </div>
                <Button
                  onClick={handleGenerateDepartment}
                  disabled={isPending || !selectedDeptId}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs h-9 px-5 shrink-0 shadow-lg shadow-indigo-950"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Generating Department...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Generate Entire Department Timetable
                    </>
                  )}
                </Button>
              </div>

              {/* Department Generation Report */}
              {deptGenResult && (
                <div className="mt-4 pt-4 border-t border-indigo-900/30 text-xs space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white">Department Generation Readiness & Summary:</span>
                    <Badge variant="outline" className="text-emerald-400 border-emerald-700 bg-emerald-950/40">
                      {deptGenResult.successfulSections} Successful
                    </Badge>
                    {deptGenResult.failedSections > 0 && (
                      <Badge variant="outline" className="text-red-400 border-red-700 bg-red-950/40">
                        {deptGenResult.failedSections} Failed
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                    {deptGenResult.sectionReports?.map((r: any) => (
                      <div
                        key={r.sectionId}
                        className={`p-2.5 rounded border ${
                          r.success
                            ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-200"
                            : "bg-red-950/20 border-red-800/40 text-red-200"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono font-bold">
                          <span>{r.courseCode} - S{r.semesterNumber}</span>
                          <span>{r.sectionName}</span>
                        </div>
                        <div className="text-[11px] mt-1 text-slate-400">
                          {r.success ? (
                            <span className="text-emerald-400">✓ {r.periodsScheduled} periods scheduled</span>
                          ) : (
                            <span className="text-red-400">✗ {r.error}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SECTION CHOOSER RIBBON (OPTIONAL SINGLE SECTION VIEW) */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-xs uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
                  <Grid className="w-3.5 h-3.5 text-indigo-400" />
                  Select Class Section Cohort
                </CardTitle>
                <div className="flex items-center gap-2 text-xs">
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300"
                  >
                    <option value="">All Programs...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              {filteredSections.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No sections match the current filter.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredSections.map((sec) => {
                    const isSelected = sec.id === selectedSectionId;
                    return (
                      <button
                        key={sec.id}
                        onClick={() => {
                          const url = new URL(window.location.href);
                          url.searchParams.set("sectionId", sec.id);
                          router.push(url.pathname + url.search);
                        }}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-950"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                      >
                        <span className="font-semibold">{sec.name}</span>
                        <span className="text-[10px] opacity-80 font-mono">
                          ({sec.course_code} - S{sec.semester_number})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* GENERATOR ACTION & STATUS BAR */}
          {activeSection && (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="pt-4 pb-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">
                        {activeSection.course_name} — {activeSection.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          initialTimetable?.status === "published"
                            ? "border-emerald-600 text-emerald-400 bg-emerald-950/30"
                            : "border-amber-600 text-amber-400 bg-amber-950/30"
                        }`}
                      >
                        {initialTimetable?.status?.toUpperCase() || "DRAFT"} (v{initialTimetable?.version || 1})
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {readiness?.isReady ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> All prerequisites satisfied (
                          {readiness.subjectsCount} subjects, {readiness.teacherAssignmentsCount} assignments,{" "}
                          {readiness.roomsCount} rooms)
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Missing:{" "}
                          {readiness?.missingDetails.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleGenerate}
                    disabled={isPending || !readiness?.isReady || initialTimetable?.status === "published"}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs h-8 px-4"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                        Auto-Generate Schedule
                      </>
                    )}
                  </Button>

                  {initialTimetable?.status === "draft" ? (
                    <Button
                      size="sm"
                      onClick={handlePublish}
                      disabled={isPending || entries.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-8 px-4"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                      Publish Timetable
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCreateRevision}
                      disabled={isPending}
                      className="border-slate-700 bg-slate-800 text-slate-200 text-xs h-8"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Create New Revision
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* WEEKLY SCHEDULE GRID (CLASS VIEW FOR GENERATOR) */}
          {activeSection && (
            <Card className="bg-slate-900 border-slate-800 overflow-hidden">
              <CardHeader className="py-3 px-4 border-b border-slate-800 flex flex-row items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wider text-slate-400 font-mono">
                  Weekly Class Grid ({activeSection.name})
                </CardTitle>
                <div className="text-[11px] text-slate-500">
                  {entries.length} Scheduled Periods
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                      <th className="p-3 w-28 font-semibold border-r border-slate-800 text-center">Day</th>
                      {slots.map((s) => (
                        <th
                          key={s.id}
                          className={`p-3 min-w-[125px] font-semibold text-center border-r border-slate-800 ${
                            s.is_break ? "bg-amber-950/20 text-amber-300/80" : ""
                          }`}
                        >
                          <div>{s.label}</div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {workingDays.map((day) => (
                      <tr key={day} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-semibold uppercase font-mono text-[11px] text-slate-300 border-r border-slate-800 text-center bg-slate-950/60">
                          {day}
                        </td>
                        {slots.map((s) => {
                          if (s.is_break) {
                            return (
                              <td
                                key={s.id}
                                className="p-2 text-center border-r border-slate-800 bg-amber-950/15 text-amber-400/70 font-mono text-[10px]"
                              >
                                BREAK
                              </td>
                            );
                          }

                          const entry = sectionGridMap.get(`${day}_${s.slot_number}`);
                          if (!entry) {
                            return (
                              <td
                                key={s.id}
                                className="p-2 text-center border-r border-slate-800 text-slate-600 font-mono text-xs"
                              >
                                —
                              </td>
                            );
                          }

                          const isLab = entry.subjects?.type === "practical";

                          return (
                            <td
                              key={s.id}
                              className={`p-2.5 border-r border-slate-800 ${
                                isLab ? "bg-purple-950/20" : "bg-indigo-950/20"
                              }`}
                            >
                              <div className="font-semibold text-slate-100 flex items-center justify-between">
                                <span className="truncate">{entry.subjects?.code}</span>
                                {entry.batch_group && (
                                  <span className="text-[9px] font-mono px-1 rounded bg-purple-900/60 text-purple-300">
                                    {entry.batch_group}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-300 truncate mt-0.5">
                                {entry.teachers?.profiles?.full_name || "Faculty"}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center justify-between">
                                <span className="text-indigo-400">{entry.room_number || "Room-101"}</span>
                                <span className="uppercase text-[9px] text-slate-500">
                                  {isLab ? "LAB" : "LEC"}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 2: FOUR MASTER VIEWS (CLASS WISE, LAB WISE, ROOM WISE, FACULTY) */}
      {/* ======================================================================= */}
      {activeMainTab === "views" && (
        <div className="space-y-6">
          {/* VIEW SWITCHER SUB-RIBBON */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center gap-2">
              {(["class", "lab", "room", "faculty"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${
                    viewMode === mode
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                  }`}
                >
                  {mode} Wise
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Context Selector based on active view mode */}
              {viewMode === "lab" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Select Lab:</span>
                  <select
                    value={selectedLabId}
                    onChange={(e) => setSelectedLabId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-xs"
                  >
                    {labs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.room_number} — {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {viewMode === "room" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Select Room:</span>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-xs"
                  >
                    {classrooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.room_number} — {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {viewMode === "faculty" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Select Faculty:</span>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-xs"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.profiles?.full_name} ({t.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportViewCsv}
                className="border-slate-700 bg-slate-800 text-slate-200 text-xs h-8"
              >
                <Download className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                Export CSV Grid
              </Button>
            </div>
          </div>

          {/* VIEW TITLE & LOAD SUMMARY */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
            <div className="font-semibold text-slate-200 uppercase font-mono tracking-wide">
              {viewMode === "class" && `CLASS WISE: ${activeSection ? `${activeSection.course_name} (${activeSection.name})` : "Select a section"}`}
              {viewMode === "lab" && `LAB WISE: ${labs.find((l) => l.id === selectedLabId)?.name || "Select Lab"}`}
              {viewMode === "room" && `ROOM WISE: ${classrooms.find((r) => r.id === selectedRoomId)?.name || "Select Room"}`}
              {viewMode === "faculty" && `FACULTY WISE: ${teachers.find((t) => t.id === selectedTeacherId)?.profiles?.full_name || "Faculty"}`}
            </div>
            {viewMode === "faculty" && (
              <Badge className="bg-indigo-900/60 border border-indigo-700 text-indigo-200 text-xs font-mono">
                TOTAL LOAD: {selectedTeacherLoad} HRS / WEEK
              </Badge>
            )}
          </div>

          {/* UNIFIED 4-VIEW MASTER TABLE */}
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400">
                    <th className="p-3 w-28 font-semibold border-r border-slate-800 text-center">Day</th>
                    {slots.map((s) => (
                      <th
                        key={s.id}
                        className={`p-3 min-w-[130px] font-semibold text-center border-r border-slate-800 ${
                          s.is_break ? "bg-amber-950/20 text-amber-300/80" : ""
                        }`}
                      >
                        <div>{s.label}</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {workingDays.map((day) => (
                    <tr key={day} className="hover:bg-slate-800/30 transition-colors">
                      <td className="p-3 font-semibold uppercase font-mono text-[11px] text-slate-300 border-r border-slate-800 text-center bg-slate-950/60">
                        {day}
                      </td>
                      {slots.map((s) => {
                        if (s.is_break) {
                          return (
                            <td
                              key={s.id}
                              className="p-2 text-center border-r border-slate-800 bg-amber-950/15 text-amber-400/70 font-mono text-[10px]"
                            >
                              BREAK
                            </td>
                          );
                        }

                        const cellEntries = viewGridMap.get(`${day}_${s.slot_number}`) || [];
                        if (cellEntries.length === 0) {
                          return (
                            <td
                              key={s.id}
                              className="p-2 text-center border-r border-slate-800 text-slate-600 font-mono text-xs"
                            >
                              —
                            </td>
                          );
                        }

                        return (
                          <td key={s.id} className="p-2.5 border-r border-slate-800 bg-slate-950/40">
                            {cellEntries.map((entry, idx) => (
                              <div key={idx} className="space-y-0.5">
                                <div className="font-semibold text-slate-100 flex items-center justify-between">
                                  <span>{entry.subjects?.code}</span>
                                  {entry.batch_group && (
                                    <span className="text-[9px] font-mono px-1 rounded bg-purple-900/60 text-purple-300">
                                      {entry.batch_group}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-300 truncate">
                                  {viewMode === "faculty"
                                    ? entry.timetables?.sections?.name || "Class"
                                    : entry.teachers?.profiles?.full_name || "Faculty"}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                                  <span className="text-indigo-400">{entry.room_number || "B-110"}</span>
                                  <span className="text-[9px] text-slate-500">
                                    {entry.timetables?.sections?.semesters?.courses?.code || ""}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 3: ROOMS & FACULTY-SUBJECT MAPPING CONFIGURATION */}
      {/* ======================================================================= */}
      {activeMainTab === "resources" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ROOM & LAB CONFIGURATION */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-400" />
                Classrooms & Laboratories
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 mb-1 block">Room Code</label>
                  <Input
                    placeholder="e.g. B-110 / CL-1"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Display Name</label>
                  <Input
                    placeholder="e.g. Computer Lab 1"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Type</label>
                  <select
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="classroom">Classroom</option>
                    <option value="lab">Laboratory (Lab)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 mb-1 block">Capacity</label>
                  <Input
                    type="number"
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={newRoomConsecutive}
                    onChange={(e) => setNewRoomConsecutive(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                  />
                  <span>Requires consecutive double-period slots (Labs)</span>
                </label>

                <Button
                  size="sm"
                  onClick={handleCreateRoom}
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1" />
                  Save Room / Lab
                </Button>
              </div>

              {/* LIST OF EXISTING ROOMS */}
              <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-60 mt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Room Code</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Capacity</th>
                      <th className="py-2 px-3">Consecutive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {rooms.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-200">{r.room_number}</td>
                        <td className="py-2 px-3 text-slate-300">{r.name}</td>
                        <td className="py-2 px-3">
                          <Badge
                            variant="outline"
                            className={`text-[9px] uppercase ${
                              r.type === "lab"
                                ? "border-purple-600 text-purple-400"
                                : "border-indigo-600 text-indigo-400"
                            }`}
                          >
                            {r.type}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">{r.capacity}</td>
                        <td className="py-2 px-3 font-mono text-[10px]">
                          {r.requires_consecutive_slots ? "Yes (2 Slots)" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* FACULTY-SUBJECT ASSIGNMENT FOR ACTIVE SECTION */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Assign Faculty to Subjects ({activeSection?.name || "Select Section"})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 mb-1 block">Select Subject</label>
                  <select
                    value={assignSubjectId}
                    onChange={(e) => setAssignSubjectId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="">Choose syllabus subject...</option>
                    {(readiness?.sectionSubjects || []).map((sub: any) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} — {sub.name} ({sub.weekly_hours || 4} hrs/wk)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 mb-1 block">Select Faculty Member</label>
                  <select
                    value={assignFacultyId}
                    onChange={(e) => setAssignFacultyId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200"
                  >
                    <option value="">Choose teacher...</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.profiles?.full_name} ({t.employee_id}) — Max: {t.max_load || 18} hrs
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={handleAssignFaculty}
                  disabled={isPending || !activeSection}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8"
                >
                  <PlusCircle className="w-3.5 h-3.5 mr-1" />
                  Assign to Section
                </Button>
              </div>

              {/* LIST OF ACTIVE SECTION ALLOCATIONS */}
              <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-60 mt-3">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Subject</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Faculty</th>
                      <th className="py-2 px-3">Weekly Hrs</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {(readiness?.sectionAssignments || []).map((alloc: any) => (
                      <tr key={alloc.id}>
                        <td className="py-2 px-3 font-semibold text-slate-200">
                          {alloc.subjects?.code} - {alloc.subjects?.name}
                        </td>
                        <td className="py-2 px-3">
                          <span className="uppercase text-[9px] text-slate-400 font-mono">
                            {alloc.subjects?.type}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {alloc.teachers?.profiles?.full_name || alloc.teachers?.employee_id}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">
                          {alloc.subjects?.weekly_hours || 4}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleRemoveAssignment(alloc.id)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
