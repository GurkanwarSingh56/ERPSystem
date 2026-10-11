import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AddStudentForm } from "@/components/students/AddStudentForm";

export const metadata = {
  title: "Enroll Student — College ERP",
};

export default async function NewStudentPage() {
  const user = await requireRole(["admin"]);
  const supabase = await createClient();

  const [
    { data: departments },
    { data: courses },
    { data: semesters },
    { data: sections },
  ] = await Promise.all([
    supabase.from("departments").select("id, name, code").eq("institution_id", user.institutionId),
    supabase.from("courses").select("id, name, code, department_id").eq("institution_id", user.institutionId),
    supabase.from("semesters").select("id, semester_number, course_id").eq("institution_id", user.institutionId),
    supabase.from("sections").select("id, name, semester_id").eq("institution_id", user.institutionId),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <AddStudentForm
          departments={departments || []}
          courses={courses || []}
          semesters={semesters || []}
          sections={sections || []}
        />
      </main>
    </div>
  );
}
