import { requireRole } from "@/lib/auth/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckSquare, DollarSign, Award, BookOpen } from "lucide-react";

export const metadata = {
  title: "Student Dashboard — College ERP",
};

export default async function StudentDashboardPage() {
  const user = await requireRole(["student"]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Student Academic Portal</h1>
          <p className="text-slate-400 text-sm pt-1">
            Personal academic summary, session attendance, fee records, and semester marks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Attendance Percentage</CardTitle>
              <CheckSquare className="w-4 h-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Confidential Record</div>
              <p className="text-xs text-slate-400 pt-1">RLS strictly prevents access to peer student records</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Fee Status</CardTitle>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Ledger Receipts</div>
              <p className="text-xs text-slate-400 pt-1">Review fee dues, paid installments, and receipts</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Curriculum Marks</CardTitle>
              <Award className="w-4 h-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Grades & Results</div>
              <p className="text-xs text-slate-400 pt-1">Subject scores calculated via database triggers</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
