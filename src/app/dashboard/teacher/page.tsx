import { requireRole } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { GraduationCap, Calendar, Edit3 } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Teacher Dashboard — College ERP",
};

export default async function TeacherDashboardPage() {
  const user = await requireRole(["teacher", "admin"]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Faculty & Teacher Portal</h1>
          <p className="text-slate-400 text-sm pt-1">
            Mark daily attendance, enter student marks, and review assigned class performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/dashboard/teacher/assignments" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Teaching Assignments
                </CardTitle>
                <GraduationCap className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Assigned Classes</div>
                <p className="text-xs text-slate-400 pt-1">Review your allocated subjects, courses, and section rosters →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/teacher/attendance" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-emerald-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Daily Attendance
                </CardTitle>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">12 Periods/Day</div>
                <p className="text-xs text-slate-400 pt-1">Period-wise student attendance log and audit tracking →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/teacher/marks" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-violet-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Marks Entry
                </CardTitle>
                <Edit3 className="w-4 h-4 text-violet-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Assessment Grades</div>
                <p className="text-xs text-slate-400 pt-1">Continuous evaluations, midterms, and trigger-calculated grades →</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
