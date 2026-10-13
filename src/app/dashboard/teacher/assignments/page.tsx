import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowLeft, BookOpen, Users, Calendar, AlertCircle } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "My Teaching Assignments — College ERP",
};

interface AssignmentRecord {
  id: string;
  course_id: string;
  semester_id: string;
  subject_id: string;
  section_id: string;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  sections?: {
    id: string;
    name: string;
  };
}

export default async function TeacherAssignmentsPage() {
  const user = await requireRole(["teacher", "admin"]);
  const supabase = await createClient();

  // Find teacher record corresponding to auth profile id
  const { data: teacherProfile } = await supabase
    .from("teachers")
    .select("id, employee_id, designation, department_id, departments(name, code)")
    .eq("id", user.userId)
    .maybeSingle();

  let assignments: AssignmentRecord[] = [];
  let errorMsg: string | null = null;

  if (teacherProfile) {
    const { data, error } = await supabase
      .from("teacher_subjects")
      .select(`
        id,
        course_id,
        semester_id,
        subject_id,
        section_id,
        created_at,
        subjects (
          id,
          name,
          code,
          type
        ),
        sections (
          id,
          name
        )
      `)
      .eq("teacher_id", teacherProfile.id)
      .eq("institution_id", user.institutionId);

    if (error) {
      errorMsg = error.message;
    } else {
      assignments = (data || []) as unknown as AssignmentRecord[];
    }
  }

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
              <GraduationCap className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Teaching Assignments</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Authorized subjects, course offerings, and section rosters allocated to your faculty account.
            </p>
          </div>
        </div>

        {/* Profile Card */}
        {teacherProfile && (
          <Card className="bg-slate-900/80 border-slate-800">
            <CardContent className="py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">{teacherProfile.designation}</div>
                <div className="text-xs text-slate-400">
                  Employee ID: <span className="font-mono text-indigo-300">{teacherProfile.employee_id}</span> • Department:{" "}
                  <span className="text-slate-200">{(teacherProfile as any).departments?.name || "General Faculty"}</span>
                </div>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                {assignments.length} Allocated Subjects
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Allocations Table */}
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <CardTitle className="text-base font-semibold text-white">Allocated Classes & Curricular Offerings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {errorMsg && (
              <div className="p-6 text-center text-sm text-rose-400 flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to query teaching assignments: {errorMsg}</span>
              </div>
            )}

            {!errorMsg && assignments.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-3 opacity-50" />
                <p className="text-slate-400 font-medium">No teaching subjects assigned yet.</p>
                <p className="text-xs text-slate-500 pt-1">
                  Contact your Department Head (HOD) or Academic Administrator to map courses and cohorts.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Class Section</th>
                      <th className="py-3 px-4 text-right">Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {assignments.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-slate-800/30">
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-medium text-slate-200">{alloc.subjects?.name || "Subject"}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{alloc.subjects?.code || "N/A"}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="outline" className="text-[11px] uppercase border-slate-700 text-slate-300">
                            {alloc.subjects?.type || "Theory"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 font-sans text-slate-200">
                          {alloc.sections?.name || "Cohort Section"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Badge className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                            Authorized Instructor
                          </Badge>
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
