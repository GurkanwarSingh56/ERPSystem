import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit3, ArrowLeft, BookOpen, AlertCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Faculty Marks Entry & Evaluation — College ERP",
};

export default async function TeacherMarksPage() {
  const user = await requireRole(["teacher", "admin"]);
  const supabase = await createClient();

  // Query marks entered by this faculty member
  const { data: recentMarks, error } = await supabase
    .from("marks")
    .select(`
      id,
      internal_marks,
      midterm_marks,
      final_marks,
      practical_marks,
      total_marks,
      percentage,
      grade,
      student_id,
      students (
        roll_number,
        profiles (full_name)
      ),
      subjects (
        name,
        code
      )
    `)
    .eq("entered_by", user.userId)
    .order("updated_at", { ascending: false })
    .limit(20);

  const marksList = recentMarks || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/teacher">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <Edit3 className="w-6 h-6 text-violet-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Marks & Grade Assessment</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Submit and review continuous internal evaluation, midterms, and final exam marks.
            </p>
          </div>
        </div>

        {/* Informational Guidance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Automatic Grading</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">Trigger Reconciled</div>
              <p className="text-xs text-slate-400 pt-1">Totals, percentage, and letter grade calculated via database triggers</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Assessment Components</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-400">4 Categories</div>
              <p className="text-xs text-slate-400 pt-1">Internal (CIE), Midterm, Final, and Practical component marks</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Scope Restriction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-400">Assigned Cohorts</div>
              <p className="text-xs text-slate-400 pt-1">RLS restricts mark submission to students in your assigned sections</p>
            </CardContent>
          </Card>
        </div>

        {/* Marks Ledger */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <CardTitle className="text-base font-semibold text-white">Evaluated Student Marks</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="p-6 text-center text-sm text-rose-400 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to query marks ledger: {error.message}</span>
              </div>
            )}

            {!error && marksList.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-50" />
                <p className="text-slate-400 font-medium">No student evaluations submitted yet.</p>
                <p className="text-xs text-slate-500 pt-1">
                  Marks entered for students in your assigned subjects will be recorded and audited here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4 text-right">Internal</th>
                      <th className="py-3 px-4 text-right">Midterm</th>
                      <th className="py-3 px-4 text-right">Final</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {marksList.map((m: any) => (
                      <tr key={m.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans text-slate-200">
                          {m.subjects?.name || "Subject"} ({m.subjects?.code || "—"})
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-200">
                          {m.students?.profiles?.full_name || "Student"} ({m.students?.roll_number || "—"})
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">{m.internal_marks ?? "—"}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{m.midterm_marks ?? "—"}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{m.final_marks ?? "—"}</td>
                        <td className="py-3 px-4 text-right font-bold text-white">{m.total_marks}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">{m.grade}</Badge>
                        </td>
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
