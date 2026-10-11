import { requireRole } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Award, Users, BarChart3 } from "lucide-react";

export const metadata = {
  title: "Principal Dashboard — College ERP",
};

export default async function PrincipalDashboardPage() {
  const user = await requireRole(["principal", "admin"]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Principal & Dean Portal</h1>
          <p className="text-slate-400 text-sm pt-1">
            Executive oversight of institutional attendance, fees, academic marks, and faculty performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Executive Scope</CardTitle>
              <Award className="w-4 h-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">All Departments</div>
              <p className="text-xs text-slate-400 pt-1">Institution-wide read access to all student & faculty metrics</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Attendance & Reports</CardTitle>
              <BarChart3 className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Consolidated View</div>
              <p className="text-xs text-slate-400 pt-1">Real-time attendance summaries across all curriculum branches</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Campus Identity</CardTitle>
              <Users className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xs font-mono text-slate-300 truncate">{user.email}</div>
              <p className="text-xs text-slate-400 pt-1">Authorized Dean credentials verified</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
