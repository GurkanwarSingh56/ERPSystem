import { requireRole } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { CheckSquare, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { getStudentAttendanceSummaryAction } from "@/app/actions/attendance";
import { StudentAttendanceView } from "@/components/dashboard/StudentAttendanceView";

export const metadata = {
  title: "My Attendance Records — College ERP",
};

export default async function StudentAttendancePage() {
  const user = await requireRole(["student"]);

  const res = await getStudentAttendanceSummaryAction();

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
              <h1 className="text-2xl font-bold tracking-tight text-white">Student Attendance Portal</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Verified daily attendance register, subject compliance metrics, and period-level session logs.
            </p>
          </div>
        </div>

        {!res.success || !res.data ? (
          <div className="p-8 text-center text-sm text-rose-400 flex flex-col items-center justify-center gap-2 bg-slate-900 border border-slate-800 rounded-lg">
            <AlertCircle className="w-6 h-6 text-rose-400" />
            <span>Failed to load student attendance record: {res.error || "Unknown error"}</span>
          </div>
        ) : (
          <StudentAttendanceView summary={res.data} />
        )}
      </main>
    </div>
  );
}
