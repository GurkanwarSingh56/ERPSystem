import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DataImportView } from "@/components/dashboard/DataImportView";
import { Database } from "lucide-react";

export const metadata = {
  title: "College Academic Data Import Wizard — College ERP",
};

export default async function DataImportPage() {
  const user = await requireRole(["admin", "principal"]);
  const supabase = await createClient();

  // 1. Fetch current institutional entities
  const [
    deptRes,
    coursesRes,
    semestersRes,
    sectionsRes,
    subjectsRes,
    teachersRes,
    teacherSubsRes,
    studentsRes,
  ] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, code")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("courses")
      .select("id, name, code, department_id")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("semesters")
      .select("id, semester_number, course_id")
      .eq("institution_id", user.institutionId)
      .order("semester_number", { ascending: true }),
    supabase
      .from("sections")
      .select("id, name, semester_id, course_id")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("subjects")
      .select("id, name, code, course_id, semester_id, type, weekly_hours")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("teachers")
      .select("id, employee_id, department_id, designation, min_load, max_load, profiles!inner(full_name)")
      .eq("institution_id", user.institutionId),
    supabase
      .from("teacher_subjects")
      .select("id, teacher_id, subject_id, section_id, subjects(name, code, weekly_hours)")
      .eq("institution_id", user.institutionId),
    supabase
      .from("students")
      .select("id, roll_number, admission_number, section_id")
      .eq("institution_id", user.institutionId),
  ]);

  const departments = deptRes.data || [];
  const courses = coursesRes.data || [];
  const semesters = semestersRes.data || [];
  const sections = sectionsRes.data || [];
  const subjects = subjectsRes.data || [];
  const teachers = teachersRes.data || [];
  const teacherAssignments = teacherSubsRes.data || [];
  const students = studentsRes.data || [];

  const readinessSummary = {
    departmentsCount: departments.length,
    coursesCount: courses.length,
    semestersCount: semesters.length,
    sectionsCount: sections.length,
    subjectsCount: subjects.length,
    teachersCount: teachers.length,
    teacherAssignmentsCount: teacherAssignments.length,
    studentsCount: students.length,
    readyForTimetable:
      sections.length > 0 && subjects.length > 0 && teacherAssignments.length > 0,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Four-Step Academic Data Import Wizard</h1>
          </div>
          <p className="text-slate-400 text-xs pt-1">
            Guided onboarding workflow: Faculty Master → Curriculum & Subject Catalog → Student Roster → Teaching Allocation Matrix.
          </p>
        </div>

        <DataImportView
          departments={departments}
          courses={courses}
          semesters={semesters}
          sections={sections}
          subjects={subjects}
          teachers={teachers}
          teacherAssignments={teacherAssignments}
          readinessSummary={readinessSummary}
        />
      </main>
    </div>
  );
}
