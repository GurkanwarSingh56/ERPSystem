import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckSquare, ArrowLeft, Calendar, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "My Attendance Records — College ERP",
};

interface AttendanceRecord {
  id: string;
  date: string;
  period_number: number;
  status: "present" | "absent" | "late" | "excused";
  remarks: string | null;
  subjects?: {
    id: string;
    name: string;
    code: string;
  };
}

export default async function StudentAttendancePage() {
  const user = await requireRole(["student"]);
  const supabase = await createClient();

  // Query authenticated student's attendance records strictly scoped by RLS & user.id
  const { data: records, error } = await supabase
    .from("attendance")
    .select(`
      id,
      date,
      period_number,
      status,
      remarks,
      subjects (
        id,
        name,
        code
      )
    `)
    .eq("student_id", user.userId)
    .order("date", { ascending: false })
    .order("period_number", { ascending: true });

  const attendanceList = (records || []) as unknown as AttendanceRecord[];

  const totalClasses = attendanceList.length;
  const attendedClasses = attendanceList.filter(
    (r) => r.status === "present" || r.status === "late"
  ).length;
  const percentage = totalClasses > 0 ? ((attendedClasses / totalClasses) * 100).toFixed(1) : "0.0";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Present</Badge>;
      case "late":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">Late</Badge>;
      case "excused":
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Excused</Badge>;
      case "absent":
      default:
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">Absent</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/student">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <CheckSquare className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Attendance Records</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Verified daily attendance register and period-level session logs.
            </p>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Overall Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{percentage}%</div>
              <p className="text-xs text-slate-400 pt-1">
                {attendedClasses} of {totalClasses} eligible academic periods attended
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Total Recorded Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">{totalClasses}</div>
              <p className="text-xs text-slate-400 pt-1">Period-level logged attendances</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Minimum Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-400">75.0%</div>
              <p className="text-xs text-slate-400 pt-1">Institutional requirement for exam eligibility</p>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Log Table */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <CardTitle className="text-base font-semibold text-white">Session Attendance Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="p-6 text-center text-sm text-rose-400 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to query attendance records: {error.message}</span>
              </div>
            )}

            {!error && attendanceList.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <Calendar className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-50" />
                <p className="text-slate-400 font-medium">No attendance records published yet.</p>
                <p className="text-xs text-slate-500 pt-1">
                  Once your instructors mark period attendance, your verified records will appear here.
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
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {attendanceList.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 text-slate-200">{rec.date}</td>
                        <td className="py-3 px-4 text-indigo-300">Period {rec.period_number}</td>
                        <td className="py-3 px-4 font-sans text-slate-200">
                          {rec.subjects?.name || "Subject"} ({rec.subjects?.code || "N/A"})
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(rec.status)}</td>
                        <td className="py-3 px-4 text-slate-400 font-sans">{rec.remarks || "—"}</td>
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
