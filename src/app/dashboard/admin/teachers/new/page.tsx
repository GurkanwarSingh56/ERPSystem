import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AddTeacherForm } from "@/components/teachers/AddTeacherForm";

export const metadata = {
  title: "Enroll Faculty Member — College ERP",
};

export default async function NewTeacherPage() {
  const user = await requireRole(["admin", "principal"]);
  const supabase = await createClient();

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, code")
    .eq("institution_id", user.institutionId)
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <AddTeacherForm departments={departments || []} />
      </main>
    </div>
  );
}
