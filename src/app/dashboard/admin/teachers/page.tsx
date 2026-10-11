import { requireRole } from "@/lib/auth/server";
import { getTeachers } from "@/lib/teachers/queries";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { TeacherTable } from "@/components/teachers/TeacherTable";
import { TeacherFiltersBar } from "@/components/teachers/TeacherFiltersBar";
import { Button } from "@/components/ui/button";
import { UserPlus, GraduationCap } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Faculty & Staff Directory — College ERP",
};

interface TeachersPageProps {
  searchParams: Promise<{
    search?: string;
    departmentId?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function TeachersPage({ searchParams }: TeachersPageProps) {
  const user = await requireRole(["admin", "principal", "hod"]);
  const params = await searchParams;
  const supabase = await createClient();

  const currentPage = params.page ? parseInt(params.page, 10) : 1;

  // Fetch departments for filter dropdown
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, code")
    .eq("institution_id", user.institutionId)
    .order("name", { ascending: true });

  // Query paginated teachers
  const paginatedData = await getTeachers({
    search: params.search,
    departmentId: params.departmentId,
    status: params.status,
    page: currentPage,
    pageSize: 10,
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Faculty & Staff Management</h1>
            </div>
            <p className="text-slate-400 text-xs pt-1">
              Administer faculty profiles, departmental affiliations, and teaching allocations.
            </p>
          </div>

          <Link href="/dashboard/admin/teachers/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 cursor-pointer">
              <UserPlus className="w-4 h-4 mr-2" />
              Enroll Faculty Member
            </Button>
          </Link>
        </div>

        <TeacherFiltersBar departments={departments || []} />

        <TeacherTable paginatedData={paginatedData} searchParams={params} />
      </main>
    </div>
  );
}
