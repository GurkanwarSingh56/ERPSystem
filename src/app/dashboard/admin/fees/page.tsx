import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  AdminFeeManagementView,
  AdminFeeAllocationItem,
  StudentOption,
} from "@/components/dashboard/AdminFeeManagementView";

export const metadata = {
  title: "Fee Management — Admin Dashboard | College ERP",
};

export default async function AdminFeesPage() {
  // 1. Authorize strictly: only administrators may access
  const user = await requireRole(["admin"]);
  const supabase = await createClient();

  // 2. Fetch all student fee allocations in this institution
  // Protected by RLS policy fees_admin_all
  const { data: rawFees } = await supabase
    .from("fees")
    .select(`
      id,
      student_id,
      academic_year,
      total_fee,
      paid_amount,
      pending_amount,
      created_at,
      updated_at,
      students!fk_fees_student(
        id,
        roll_number,
        admission_number,
        profiles!students_id_fkey(
          full_name,
          email
        ),
        departments!students_department_id_fkey(
          name
        ),
        courses!students_course_id_fkey(
          name
        )
      )
    `)
    .eq("institution_id", user.institutionId)
    .order("created_at", { ascending: false });

  const allocations: AdminFeeAllocationItem[] = (rawFees || []).map((f: any) => ({
    id: f.id,
    studentId: f.student_id,
    studentName: f.students?.profiles?.full_name || "Unknown Student",
    studentEmail: f.students?.profiles?.email || "",
    rollNumber: f.students?.roll_number || "—",
    admissionNumber: f.students?.admission_number || "—",
    academicYear: f.academic_year,
    totalFee: Number(f.total_fee),
    paidAmount: Number(f.paid_amount),
    pendingAmount: Number(f.pending_amount),
    departmentName: f.students?.departments?.name || null,
    courseName: f.students?.courses?.name || null,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));

  // 3. Fetch all active enrolled students within institution for the assign fee picker
  const { data: rawStudents } = await supabase
    .from("students")
    .select(`
      id,
      roll_number,
      admission_number,
      is_dropped,
      profiles!students_id_fkey(
        full_name,
        email,
        status
      ),
      departments!students_department_id_fkey(
        name
      ),
      courses!students_course_id_fkey(
        name
      )
    `)
    .eq("institution_id", user.institutionId)
    .eq("is_dropped", false)
    .order("roll_number", { ascending: true })
    .limit(300);

  const students: StudentOption[] = (rawStudents || []).map((s: any) => ({
    id: s.id,
    fullName: s.profiles?.full_name || "Unknown",
    rollNumber: s.roll_number || "—",
    admissionNumber: s.admission_number || "—",
    email: s.profiles?.email || "",
    departmentName: s.departments?.name || null,
    courseName: s.courses?.name || null,
  }));

  // Extract distinct academic years from existing allocations or fallback to current
  const academicYearsSet = new Set<string>();
  allocations.forEach((a) => {
    if (a.academicYear) academicYearsSet.add(a.academicYear);
  });
  if (academicYearsSet.size === 0) {
    academicYearsSet.add("2026-27");
  }
  const academicYears = Array.from(academicYearsSet).sort().reverse();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <DashboardHeader user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
        <AdminFeeManagementView
          allocations={allocations}
          students={students}
          academicYears={academicYears}
        />
      </main>
    </div>
  );
}
