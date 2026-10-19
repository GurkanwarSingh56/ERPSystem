import Link from "next/link";
import { requireRole } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Shield, Users, BookOpen, Settings, GraduationCap, CreditCard, Calendar, Database, CalendarCheck } from "lucide-react";

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/dashboard/admin/students" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Student Management
                </CardTitle>
                <Users className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Students</div>
                <p className="text-xs text-slate-400 pt-1">Search, paginate, filter, and administer student rosters</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/admin/teachers" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Faculty Management
                </CardTitle>
                <GraduationCap className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Faculty</div>
                <p className="text-xs text-slate-400 pt-1">Enroll teachers, department mappings, and subject allocations</p>
              </CardContent>
            </Card>
          </Link>


          <Link href="/dashboard/admin/attendance" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-emerald-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Attendance Portal
                </CardTitle>
                <CalendarCheck className="w-4 h-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Attendance</div>
                <p className="text-xs text-slate-400 pt-1">Session audits, shortage threshold alerts & campus summaries</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/admin/fees" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Fee Management
                </CardTitle>
                <CreditCard className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Fees</div>
                <p className="text-xs text-slate-400 pt-1">Assign academic structures, configure student allocations, and track balances</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/admin/academic" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Academic Structure
                </CardTitle>
                <BookOpen className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Structure & Roster</div>
                <p className="text-xs text-slate-400 pt-1">Departments, courses, curriculum, and semester cohorts →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/admin/timetable" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Timetable Generator
                </CardTitle>
                <Calendar className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Smart Timetable</div>
                <p className="text-xs text-slate-400 pt-1">Generate, validate, publish schedules & resolve conflicts →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/admin/accounts" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Account Governance
                </CardTitle>
                <Shield className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">Accounts & Access</div>
                <p className="text-xs text-slate-400 pt-1">Provision Login IDs, credential resets, and accounts access delegations →</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/admin/data-import" className="block group">
            <Card className="bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 transition-colors h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Data Management
                </CardTitle>
                <Database className="w-4 h-4 text-indigo-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">CSV Bulk Import</div>
                <p className="text-xs text-slate-400 pt-1">Onboard departments, courses, teachers, students & assignments →</p>
              </CardContent>
            </Card>
          </Link>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Tenant Context</CardTitle>
              <Settings className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-xs font-mono text-emerald-300 truncate font-semibold">Active Campus Isolation</div>
              <p className="text-xs font-mono text-slate-400 pt-1 truncate">{user.institutionId}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
