import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarCheck, Shield } from "lucide-react";
import Link from "next/link";
import { getAdminAttendanceReportAction } from "@/app/actions/attendance";
import { AdminAttendanceView } from "@/components/dashboard/AdminAttendanceView";

export const metadata = {
  title: "Institutional Attendance Portal — College ERP",
};

export default async function AdminAttendancePage() {
  const user = await requireRole(["admin", "principal", "hod"]);
  const supabase = await createClient();

  // Fetch initial report
  const reportRes = await getAdminAttendanceReportAction({ threshold: 75 });
  const initialReport = reportRes.success && reportRes.data ? reportRes.data : {
    overview: {
      totalSessions: 0,
      totalPresent: 0,
      totalAbsent: 0,
      totalLeave: 0,
      averagePercentage: 0,
      atRiskStudentsCount: 0,
    },
    studentSummaries: [],
    subjectSummaries: [],
    recentAuditTrail: [],
  };

  // Fetch filter dropdown options
  const [coursesRes, semestersRes, sectionsRes, subjectsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name, code")
      .eq("institution_id", user.institutionId)
      .order("code"),
    supabase
      .from("semesters")
      .select("id, semester_number")
      .eq("institution_id", user.institutionId)
      .order("semester_number"),
    supabase
      .from("sections")
      .select("id, name")
      .eq("institution_id", user.institutionId)
      .order("name"),
    supabase
      .from("subjects")
      .select("id, name, code")
      .eq("institution_id", user.institutionId)
      .order("code"),
  ]);

  const courses = (coursesRes.data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    code: c.code,
  }));

  const semesters = (semestersRes.data || []).map((s: any) => ({
    id: s.id,
    name: `Semester ${s.semester_number}`,
    semesterNumber: s.semester_number,
  }));

  const sections = (sectionsRes.data || []).map((sec: any) => ({
    id: sec.id,
    name: sec.name,
  }));

  const subjects = (subjectsRes.data || []).map((sub: any) => ({
    id: sub.id,
    name: sub.name,
    code: sub.code,
  }));

  const backLink =
    user.role === "hod"
      ? "/dashboard/hod"
      : user.role === "principal"
      ? "/dashboard/principal"
      : "/dashboard/admin";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href={backLink}>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <CalendarCheck className="w-6 h-6 text-emerald-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Institutional Attendance Management & Reports
              </h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Campus-wide attendance auditing, shortage threshold screening, and verified roll call logs.
            </p>
          </div>
        </div>

        <AdminAttendanceView
          initialReport={initialReport}
          courses={courses}
          semesters={semesters}
          sections={sections}
          subjects={subjects}
          user={user}
        />
      </main>
    </div>
  );
}
