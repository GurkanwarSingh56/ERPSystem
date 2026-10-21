import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Clock, History, AlertCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTeacherAllocationsAction } from "@/app/actions/attendance";
import { TeacherAttendanceView } from "@/components/dashboard/TeacherAttendanceView";

export const metadata = {
  title: "Faculty Daily Attendance — College ERP",
};

export default async function TeacherAttendancePage() {
  const user = await requireRole(["teacher", "admin", "principal", "hod"]);
  const supabase = await createClient();

  // 1. Fetch authorized class/subject allocations for this faculty/admin
  const allocRes = await getTeacherAllocationsAction();
  const allocations = allocRes.success && allocRes.data ? allocRes.data : [];

  // 2. Query recent attendance sessions recorded by this user
  const { data: recentSessions, error } = await supabase
    .from("attendance")
    .select(`
      id,
      date,
      period_number,
      status,
      remarks,
      student_id,
      students!fk_attendance_student_section (
        roll_number,
        profiles (full_name)
      ),
      subjects (
        name,
        code
      ),
      sections!fk_attendance_section (
        name
      )
    `)
    .eq("marked_by", user.userId)
    .order("date", { ascending: false })
    .order("period_number", { ascending: true })
    .limit(20);

  const sessions = recentSessions || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href={user.role === "admin" ? "/dashboard/admin" : "/dashboard/teacher"}>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <Calendar className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Daily Attendance Portal</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Mark period-wise student attendance, edit past roll calls, and maintain a verified audit trail.
            </p>
          </div>
        </div>

        {/* Informational Guidance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Timetable Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">12 Periods / Day</div>
              <p className="text-xs text-slate-400 pt-1">Periods 1 through 12 validated by schema check constraints</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">Trigger Logging</div>
              <p className="text-xs text-slate-400 pt-1">All attendance status edits require a recorded audit reason</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Instructor Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-400">
                {allocations.length} Assigned {allocations.length === 1 ? "Cohort" : "Cohorts"}
              </div>
              <p className="text-xs text-slate-400 pt-1">RLS restricts roll calls to your authorized subjects</p>
            </CardContent>
          </Card>
        </div>

        {/* Interactive Roll Call Portal */}
        {allocations.length === 0 ? (
          <Card className="bg-slate-900/80 border-slate-800 p-8 text-center">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-400 mb-3" />
            <h3 className="text-base font-semibold text-white">No Teaching Allocations Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              You are not currently assigned to teach any subjects for active sections.
              Please contact the campus academic administrator or department HOD to assign curricular allocations.
            </p>
          </Card>
        ) : (
          <TeacherAttendanceView initialAllocations={allocations} user={user} />
        )}

        {/* Sessions Ledger */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <CardTitle className="text-base font-semibold text-white">Recently Recorded Attendance Logs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="p-6 text-center text-sm text-rose-400 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to query attendance history: {error.message}</span>
              </div>
            )}

            {!error && sessions.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <Clock className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-50" />
                <p className="text-slate-400 font-medium">No attendance marked for today yet.</p>
                <p className="text-xs text-slate-500 pt-1">
                  Attendance records marked for assigned sections will appear in this verified ledger.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {sessions.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 text-slate-200">{s.date}</td>
                        <td className="py-3 px-4 text-indigo-300">Period {s.period_number}</td>
                        <td className="py-3 px-4 font-sans text-slate-200">
                          {s.subjects?.name || "Subject"}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-200">
                          {s.students?.profiles?.full_name || "Student"} ({s.students?.roll_number || "—"})
                        </td>
                        <td className="py-3 px-4 uppercase font-bold">
                          {s.status === "present" ? (
                            <span className="text-emerald-400">Present</span>
                          ) : s.status === "leave" ? (
                            <span className="text-amber-400">Leave</span>
                          ) : (
                            <span className="text-rose-400">Absent</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-sans">{s.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
