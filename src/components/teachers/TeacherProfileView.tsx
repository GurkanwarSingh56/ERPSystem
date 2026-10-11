"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TeacherListItem } from "@/lib/teachers/types";
import {
  updateTeacherAction,
  setTeacherStatusAction,
  assignTeacherSubjectAction,
  removeTeacherSubjectAction,
} from "@/app/actions/teachers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Trash2,
  PlusCircle,
  PowerOff,
  Power,
  Shield,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface TeacherProfileViewProps {
  teacher: TeacherListItem;
  departments: Array<{ id: string; name: string; code: string }>;
  courses: Array<{ id: string; name: string; code: string; department_id: string }>;
  semesters: Array<{ id: string; semester_number: number; course_id: string }>;
  sections: Array<{ id: string; name: string; semester_id: string }>;
  subjects: Array<{ id: string; name: string; code: string; semester_id: string; course_id: string }>;
}

export function TeacherProfileView({
  teacher,
  departments,
  courses,
  semesters,
  sections,
  subjects,
}: TeacherProfileViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Profile Edit State
  const [fullName, setFullName] = useState(teacher.profiles.full_name);
  const [phone, setPhone] = useState(teacher.profiles.phone || "");
  const [departmentId, setDepartmentId] = useState(teacher.department_id);
  const [designation, setDesignation] = useState(teacher.designation);

  // Subject Allocation State
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const isActive = teacher.profiles.status === "active";

  // Filter dependent cascades for allocation
  const availableSemesters = semesters.filter((s) => s.course_id === selectedCourse);
  const availableSections = sections.filter((sec) => sec.semester_id === selectedSemester);
  const availableSubjects = subjects.filter((sub) => sub.semester_id === selectedSemester && sub.course_id === selectedCourse);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const formData = new FormData();
    formData.append("teacherId", teacher.id);
    formData.append("fullName", fullName);
    formData.append("phone", phone);
    formData.append("departmentId", departmentId);
    formData.append("designation", designation);

    startTransition(async () => {
      const res = await updateTeacherAction(null, formData);
      if (res.success) {
        setFeedback({ type: "success", message: "Faculty profile updated successfully." });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to update profile." });
      }
    });
  };

  const handleToggleStatus = async () => {
    setFeedback(null);
    const action = isActive ? "deactivate" : "activate";

    startTransition(async () => {
      const res = await setTeacherStatusAction(teacher.id, action);
      if (res.success) {
        setFeedback({
          type: "success",
          message: `Faculty member successfully ${isActive ? "deactivated" : "reactivated"}.`,
        });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to update status." });
      }
    });
  };

  const handleAssignSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const formData = new FormData();
    formData.append("teacherId", teacher.id);
    formData.append("courseId", selectedCourse);
    formData.append("semesterId", selectedSemester);
    formData.append("subjectId", selectedSubject);
    formData.append("sectionId", selectedSection);

    startTransition(async () => {
      const res = await assignTeacherSubjectAction(null, formData);
      if (res.success) {
        setFeedback({ type: "success", message: "Subject allocation mapped successfully." });
        setSelectedCourse("");
        setSelectedSemester("");
        setSelectedSubject("");
        setSelectedSection("");
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to assign subject." });
      }
    });
  };

  const handleRemoveAllocation = async (allocationId: string) => {
    if (!confirm("Are you sure you want to unassign this subject and section from the faculty member?")) return;
    setFeedback(null);

    startTransition(async () => {
      const res = await removeTeacherSubjectAction(allocationId, teacher.id);
      if (res.success) {
        setFeedback({ type: "success", message: "Subject assignment removed." });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: res.error || "Failed to remove assignment." });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/admin/teachers">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Faculty Directory
          </Button>
        </Link>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-start gap-3 text-sm ${
            feedback.type === "success"
              ? "bg-emerald-950/40 border border-emerald-800/60 text-emerald-200"
              : "bg-red-950/40 border border-red-800/60 text-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-medium">{feedback.type === "success" ? "Success" : "Action Failed"}</p>
            <p className="text-xs opacity-90 mt-0.5">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* Header Profile Summary */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-300 font-bold text-2xl shadow-inner">
            {teacher.profiles.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{teacher.profiles.full_name}</h2>
              {isActive ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-xs">
                  Active Faculty
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs">
                  Inactive / On Leave
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="font-mono text-indigo-300">ID: {teacher.employee_id}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-500" />
                {teacher.profiles.email}
              </span>
              {teacher.profiles.phone && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {teacher.profiles.phone}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleToggleStatus}
            disabled={isPending}
            className={`cursor-pointer ${
              isActive
                ? "border-amber-500/30 text-amber-400 hover:bg-amber-950/30"
                : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/30"
            }`}
          >
            {isActive ? (
              <>
                <PowerOff className="w-4 h-4 mr-2" />
                Deactivate Faculty
              </>
            ) : (
              <>
                <Power className="w-4 h-4 mr-2" />
                Reactivate Faculty
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Details & Edit Form */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-4 border-b border-slate-800/80">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                Edit Faculty Details
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Update designation and departmental affiliation.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">Full Name</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="bg-slate-950/80 border-slate-800 text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">Phone Number</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91..."
                    className="bg-slate-950/80 border-slate-800 text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">Designation</label>
                  <Input
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    required
                    className="bg-slate-950/80 border-slate-800 text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">Department</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    required
                    className="w-full h-10 rounded-md border border-slate-800 bg-slate-950/80 px-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium cursor-pointer"
                >
                  {isPending ? "Saving Changes..." : "Save Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Teaching Assignments & Subject Allocations */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-4 border-b border-slate-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    Curricular Allocations & Teaching Assignments
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Subjects and sections assigned to this teacher via teacher_subjects relationship.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {/* Existing Allocations List */}
              {(!teacher.teacher_subjects || teacher.teacher_subjects.length === 0) ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                  <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300">No subjects currently assigned</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Use the form below to allocate a subject and section to this faculty member.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teacher.teacher_subjects.map((alloc) => (
                    <div
                      key={alloc.id}
                      className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white text-sm">
                            {alloc.subjects?.name || "Subject"}
                          </span>
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/50">
                            {alloc.subjects?.code}
                          </span>
                          <Badge variant="outline" className="text-slate-400 border-slate-700 text-xs uppercase">
                            {alloc.subjects?.type || "theory"}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-3">
                          <span>Course: <strong className="text-slate-200">{alloc.courses?.name}</strong></span>
                          <span>•</span>
                          <span>Semester: <strong className="text-slate-200">{alloc.semesters?.semester_number}</strong></span>
                          <span>•</span>
                          <span>Section: <strong className="text-slate-200">{alloc.sections?.name}</strong></span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleRemoveAllocation(alloc.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Unassign
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Allocation Form */}
              <div className="pt-6 border-t border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                  Assign New Subject & Section
                </h4>
                <form onSubmit={handleAssignSubject} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-300 mb-1 block">Course</label>
                      <select
                        value={selectedCourse}
                        onChange={(e) => {
                          setSelectedCourse(e.target.value);
                          setSelectedSemester("");
                          setSelectedSubject("");
                          setSelectedSection("");
                        }}
                        required
                        className="w-full h-9 rounded-md border border-slate-800 bg-slate-950/80 px-3 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select Course...</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 mb-1 block">Semester</label>
                      <select
                        value={selectedSemester}
                        onChange={(e) => {
                          setSelectedSemester(e.target.value);
                          setSelectedSubject("");
                          setSelectedSection("");
                        }}
                        disabled={!selectedCourse}
                        required
                        className="w-full h-9 rounded-md border border-slate-800 bg-slate-950/80 px-3 text-xs text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select Semester...</option>
                        {availableSemesters.map((s) => (
                          <option key={s.id} value={s.id}>
                            Semester {s.semester_number}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 mb-1 block">Subject</label>
                      <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        disabled={!selectedSemester}
                        required
                        className="w-full h-9 rounded-md border border-slate-800 bg-slate-950/80 px-3 text-xs text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select Subject...</option>
                        {availableSubjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} ({sub.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 mb-1 block">Section</label>
                      <select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        disabled={!selectedSemester}
                        required
                        className="w-full h-9 rounded-md border border-slate-800 bg-slate-950/80 px-3 text-xs text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select Section...</option>
                        {availableSections.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            Section {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isPending || !selectedSection || !selectedSubject}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-4 cursor-pointer"
                    >
                      {isPending ? "Assigning..." : "Confirm Subject Assignment"}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
