import { requireAuth } from "@/lib/auth/server";
import { getStudentById } from "@/lib/students/queries";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StudentProfileView } from "@/components/students/StudentProfileView";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Student Profile — College ERP",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const student = await getStudentById(id);
  if (!student) {
    notFound();
  }

  const canManage = user.role === "admin";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <StudentProfileView student={student} canManage={canManage} />
      </main>
    </div>
  );
}
