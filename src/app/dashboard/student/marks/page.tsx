import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Award, ArrowLeft, BookOpen, AlertCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Curriculum Marks & Grades — College ERP",
};

interface MarksRecord {
  id: string;
  internal_marks: number | null;
  midterm_marks: number | null;
  final_marks: number | null;
  practical_marks: number | null;
  total_marks: number;
  percentage: number;
  grade: string;
  subjects?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
}

export default async function StudentMarksPage() {
  const user = await requireRole(["student"]);
  const supabase = await createClient();

  // Query authenticated student's marks records strictly scoped by RLS & user.id
  const { data: records, error } = await supabase
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
      subjects (
        id,
        name,
        code,
        type
      )
    `)
    .eq("student_id", user.userId)
    .order("created_at", { ascending: false });

  const marksList = (records || []) as unknown as MarksRecord[];

  const totalSubjects = marksList.length;
  const avgPercentage =
    totalSubjects > 0
      ? (marksList.reduce((acc, m) => acc + Number(m.percentage || 0), 0) / totalSubjects).toFixed(1)
      : "0.0";

  const passedSubjects = marksList.filter((m) => m.grade !== "F").length;

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case "O":
      case "A+":
      case "A":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">{grade}</Badge>;
      case "B+":
      case "B":
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">{grade}</Badge>;
      case "C":
      case "P":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">{grade}</Badge>;
      case "F":
      default:
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30">{grade}</Badge>;
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
              <Award className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Curriculum Marks & Grades</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Verified evaluation records, continuous assessments, and final semester grades.
            </p>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Average Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{avgPercentage}%</div>
              <p className="text-xs text-slate-400 pt-1">Cumulative assessment score</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Evaluated Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-400">{totalSubjects}</div>
              <p className="text-xs text-slate-400 pt-1">{passedSubjects} passed / cleared</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Grading System</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-slate-200">10-Point UGC Scale</div>
              <p className="text-xs text-slate-400 pt-1">Calculated via institutional grading triggers</p>
            </CardContent>
          </Card>
        </div>

        {/* Marks Table */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <CardTitle className="text-base font-semibold text-white">Subject Evaluation Ledger</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error && (
              <div className="p-6 text-center text-sm text-rose-400 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to query marks records: {error.message}</span>
              </div>
            )}

            {!error && marksList.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-50" />
                <p className="text-slate-400 font-medium">No evaluation records published yet.</p>
                <p className="text-xs text-slate-500 pt-1">
                  Once your instructors submit assessment grades, your verified marks will be reflected here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4 text-center">Type</th>
                      <th className="py-3 px-4 text-right">Internal</th>
                      <th className="py-3 px-4 text-right">Midterm</th>
                      <th className="py-3 px-4 text-right">Final</th>
                      <th className="py-3 px-4 text-right">Practical</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-right">Percentage</th>
                      <th className="py-3 px-4 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {marksList.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-sans">
                          <div className="font-medium text-slate-200">{m.subjects?.name || "Subject"}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{m.subjects?.code || "N/A"}</div>
                        </td>
                        <td className="py-3 px-4 text-center uppercase text-[11px] text-slate-400">
                          {m.subjects?.type || "Theory"}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {m.internal_marks != null ? m.internal_marks : "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {m.midterm_marks != null ? m.midterm_marks : "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {m.final_marks != null ? m.final_marks : "—"}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-300">
                          {m.practical_marks != null ? m.practical_marks : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">{m.total_marks}</td>
                        <td className="py-3 px-4 text-right font-semibold text-indigo-300">{m.percentage}%</td>
                        <td className="py-3 px-4 text-center">{getGradeBadge(m.grade)}</td>
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
