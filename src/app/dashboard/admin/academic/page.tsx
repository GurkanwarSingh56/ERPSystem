import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Layers, Bookmark, Hash } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Academic Structure Directory — College ERP",
};

export default async function AcademicStructurePage() {
  const user = await requireRole(["admin", "principal", "hod"]);
  const supabase = await createClient();

  // Fetch departments, courses, sections, and subjects for the caller's institution
  const [deptsRes, coursesRes, subjectsRes, sectionsRes] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, code, created_at")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("courses")
      .select("id, name, code, department_id, created_at")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("subjects")
      .select("id, name, code, type, course_id, semester_id, created_at")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("sections")
      .select("id, name, course_id, semester_id, created_at")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
  ]);

  const departments = deptsRes.data || [];
  const courses = coursesRes.data || [];
  const subjects = subjectsRes.data || [];
  const sections = sectionsRes.data || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/admin">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white p-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <BookOpen className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Academic Structure Directory</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Curricular framework, institutional departments, approved courses, and section allocations.
            </p>
          </div>
        </div>

        {/* Aggregate Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Departments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{departments.length}</div>
              <p className="text-xs text-slate-400 pt-1">Active faculty branches</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Degree Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-400">{courses.length}</div>
              <p className="text-xs text-slate-400 pt-1">Approved academic programs</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Curricular Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-400">{subjects.length}</div>
              <p className="text-xs text-slate-400 pt-1">Theory & practical courses</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono uppercase text-slate-400">Class Sections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-violet-400">{sections.length}</div>
              <p className="text-xs text-slate-400 pt-1">Semester cohorts</p>
            </CardContent>
          </Card>
        </div>

        {/* Departments and Courses Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="border-b border-slate-800/80 pb-4">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                Departments ({departments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-3 px-4">Department Name</th>
                      <th className="py-3 px-4">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {departments.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans text-slate-200">{d.name}</td>
                        <td className="py-3 px-4 text-indigo-300 font-bold">{d.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-slate-800">
            <CardHeader className="border-b border-slate-800/80 pb-4">
              <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-emerald-400" />
                Degree Programs & Courses ({courses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-xs uppercase font-mono text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-3 px-4">Course Title</th>
                      <th className="py-3 px-4">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                    {courses.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-sans text-slate-200">{c.name}</td>
                        <td className="py-3 px-4 text-emerald-300 font-bold">{c.code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
