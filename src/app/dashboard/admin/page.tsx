import { requireRole } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Shield, Users, BookOpen, Settings } from "lucide-react";

export const metadata = {
  title: "Admin Dashboard — College ERP",
};

export default async function AdminDashboardPage() {
  const user = await requireRole(["admin"]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Administrator Portal</h1>
          <p className="text-slate-400 text-sm pt-1">
            Institutional administration, user account governance, and system-wide configurations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/dashboard/admin/students" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Student Management
                </CardTitle>
                <Users className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Enroll & Manage</div>
                <p className="text-xs text-slate-400 pt-1">Search, paginate, filter, and administer student rosters</p>
              </CardContent>
            </Card>
          </Link>


          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Academic Structure</CardTitle>
              <BookOpen className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Phase 6 Engine</div>
              <p className="text-xs text-slate-400 pt-1">Departments, courses, curriculum, and semester sections</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Tenant Context</CardTitle>
              <Settings className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xs font-mono text-slate-300 truncate">{user.institutionId}</div>
              <p className="text-xs text-slate-400 pt-1">Active verified campus partition</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
