import { requireRole } from "@/lib/auth/server";
import { getStudents } from "@/lib/students/queries";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StudentTable } from "@/components/students/StudentTable";
import { StudentFiltersBar } from "@/components/students/StudentFiltersBar";
import { Button } from "@/components/ui/button";
import { UserPlus, Users } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Student Management — College ERP",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireRole(["admin", "principal", "hod", "teacher"]);
  const params = await searchParams;

  const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  const search = typeof params.search === "string" ? params.search : undefined;
  const departmentId = typeof params.departmentId === "string" ? params.departmentId : undefined;
  const courseId = typeof params.courseId === "string" ? params.courseId : undefined;
  const semesterId = typeof params.semesterId === "string" ? params.semesterId : undefined;
  const sectionId = typeof params.sectionId === "string" ? params.sectionId : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  const result = await getStudents({
    page,
    search,
    departmentId,
    courseId,
    semesterId,
    sectionId,
    status,
    pageSize: 10,
  });

  // Fetch departments & courses for filter dropdowns
  const supabase = await createClient();
  const [{ data: departments }, { data: courses }] = await Promise.all([
    supabase.from("departments").select("id, name, code").eq("institution_id", user.institutionId),
    supabase.from("courses").select("id, name, code").eq("institution_id", user.institutionId),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold tracking-tight text-white">Student Management</h1>
            </div>
            <p className="text-xs text-slate-400 pt-1">
              Search, filter, enroll, and manage enrolled academic students with tenant isolation.
            </p>
          </div>

          {user.role === "admin" && (
            <Link href="/dashboard/admin/students/new">
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-xs font-medium gap-1.5 shadow-lg shadow-indigo-600/20">
                <UserPlus className="w-4 h-4" /> Enroll Student
              </Button>
            </Link>
          )}
        </div>

        <StudentFiltersBar
          departments={departments || []}
          courses={courses || []}
        />

        <StudentTable
          students={result.data}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          totalPages={result.totalPages}
        />
      </main>
    </div>
  );
}
