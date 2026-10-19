import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Briefcase, Users, CalendarCheck } from "lucide-react";

export const metadata = {
  title: "HOD Dashboard — College ERP",
};

export default async function HodDashboardPage() {
  const user = await requireRole(["hod", "principal", "admin"]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Head of Department Portal</h1>
          <p className="text-slate-400 text-sm pt-1">
            Departmental administration, branch faculty allocations, and student academic performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Department Scope</CardTitle>
              <Briefcase className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Branch Leadership</div>
              <p className="text-xs text-slate-400 pt-1">Restricted to your assigned academic branch via RLS</p>
            </CardContent>
          </Card>

          <Link href="/dashboard/admin/attendance" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-emerald-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Department Attendance
                </CardTitle>
                <CalendarCheck className="w-4 h-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Session Auditing</div>
                <p className="text-xs text-slate-400 pt-1">View department attendance sheets, defaulters & modifications →</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Faculty Roster</CardTitle>
              <Users className="w-4 h-4 text-violet-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Department Faculty</div>
              <p className="text-xs text-slate-400 pt-1">Monitor assigned professors and class advisors</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
