import { requireRole } from "@/lib/auth/server";
import { getTeacherById } from "@/lib/teachers/queries";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { TeacherProfileView } from "@/components/teachers/TeacherProfileView";

export const metadata = {
  title: "Faculty Profile & Allocations — College ERP",
};

interface TeacherDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function TeacherDetailPage({ params }: TeacherDetailPageProps) {
  const user = await requireRole(["admin", "principal", "hod"]);
  const { id } = await params;
  const supabase = await createClient();

  const teacher = await getTeacherById(id);
  if (!teacher) {
    notFound();
  }

  // Fetch academic structures for subject assignment cascade
  const [
    { data: departments },
    { data: courses },
    { data: semesters },
    { data: sections },
    { data: subjects },
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
      .select("id, name, semester_id")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("subjects")
      .select("id, name, code, semester_id, course_id")
      .eq("institution_id", user.institutionId)
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <TeacherProfileView
          teacher={teacher}
          departments={departments || []}
          courses={courses || []}
          semesters={semesters || []}
          sections={sections || []}
          subjects={subjects || []}
        />
      </main>
    </div>
  );
}
