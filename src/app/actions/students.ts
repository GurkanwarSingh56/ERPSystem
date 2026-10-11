"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole } from "@/lib/auth/server";
import { createStudentSchema, updateStudentSchema } from "@/lib/students/types";
import { revalidatePath } from "next/cache";

export type StudentActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  studentId?: string;
};

/**
 * Create a new student account and academic record.
 * Restricted to administrators and authorized staff.
 */
export async function createStudentAction(
  prevState: unknown,
  formData: FormData
): Promise<StudentActionResponse> {
  try {
    const caller = await requireRole(["admin", "principal"]);

    const rawData = {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone") || null,
      rollNumber: formData.get("rollNumber"),
      admissionNumber: formData.get("admissionNumber"),
      departmentId: formData.get("departmentId"),
      courseId: formData.get("courseId"),
      semesterId: formData.get("semesterId"),
      sectionId: formData.get("sectionId"),
      password: formData.get("password"),
    };

    const parseResult = createStudentSchema.safeParse(rawData);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message;
        }
      });
      return { success: false, fieldErrors, error: "Validation failed." };
    }

    const input = parseResult.data;
    const adminSupabase = createAdminClient();

    // 0. Verify academic hierarchy and institutional ownership
    const { data: section, error: sectionError } = await adminSupabase
      .from("sections")
      .select("id, course_id, semester_id, institution_id")
      .eq("id", input.sectionId)
      .eq("course_id", input.courseId)
      .eq("semester_id", input.semesterId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (sectionError || !section) {
      return {
        success: false,
        error: "Invalid section hierarchy: Section, course, and semester do not match within your institution.",
      };
    }

    const { data: course, error: courseError } = await adminSupabase
      .from("courses")
      .select("id, department_id, institution_id")
      .eq("id", input.courseId)
      .eq("department_id", input.departmentId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (courseError || !course) {
      return {
        success: false,
        error: "Invalid course hierarchy: Course does not belong to the selected department within your institution.",
      };
    }

    // 1. Create Supabase Auth identity
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });

    if (authError || !authData.user) {
      return {
        success: false,
        error: `Failed to create auth identity: ${authError?.message || "Unknown error"}`,
      };
    }

    const userId = authData.user.id;

    // 2. Insert into public.profiles
    const { error: profileError } = await adminSupabase.from("profiles").insert({
      id: userId,
      institution_id: caller.institutionId,
      email: input.email,
      full_name: input.fullName,
      role: "student",
      phone: input.phone,
      status: "active",
    });

    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: `Failed to create profile: ${profileError.message}`,
      };
    }

    // 3. Insert into public.students
    const { error: studentError } = await adminSupabase.from("students").insert({
      id: userId,
      institution_id: caller.institutionId,
      roll_number: input.rollNumber,
      admission_number: input.admissionNumber,
      department_id: input.departmentId,
      course_id: input.courseId,
      semester_id: input.semesterId,
      section_id: input.sectionId,
      is_dropped: false,
    });

    if (studentError) {
      await adminSupabase.from("profiles").delete().eq("id", userId);
      await adminSupabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: `Failed to create academic student record: ${studentError.message}`,
      };
    }

    revalidatePath("/dashboard/admin/students");
    return { success: true, studentId: userId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Update basic student details.
 * Allowed for Admin and Class Advisors of the student's assigned section.
 */
export async function updateStudentAction(
  prevState: unknown,
  formData: FormData
): Promise<StudentActionResponse> {
  try {
    const caller = await requireAuth();

    const rawData = {
      studentId: formData.get("studentId"),
      fullName: formData.get("fullName"),
      phone: formData.get("phone") || null,
      rollNumber: formData.get("rollNumber"),
      isDropped: formData.get("isDropped") === "true",
    };

    const parseResult = updateStudentSchema.safeParse(rawData);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message;
        }
      });
      return { success: false, fieldErrors, error: "Validation failed." };
    }

    const { studentId, fullName, phone, rollNumber, isDropped } = parseResult.data;
    const supabase = await createClient();

    // Verify student belongs to caller's institution
    const { data: student, error: fetchError } = await supabase
      .from("students")
      .select("id, section_id, institution_id")
      .eq("id", studentId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (fetchError || !student) {
      return { success: false, error: "Student record not found in this institution." };
    }

    // Role verification: Admin or Advisor
    if (caller.role !== "admin") {
      const { data: section } = await supabase
        .from("sections")
        .select("advisor_id")
        .eq("id", student.section_id)
        .single();

      if (!section || section.advisor_id !== caller.userId) {
        return { success: false, error: "Permission denied: Only class advisors or administrators can edit student records." };
      }
    }

    // 1. Update Profile (Name & Phone)
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentId);

    if (profileUpdateError) {
      return { success: false, error: `Profile update failed: ${profileUpdateError.message}` };
    }

    // 2. Update Student Record
    const { error: studentUpdateError } = await supabase
      .from("students")
      .update({
        roll_number: rollNumber,
        is_dropped: isDropped ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", studentId);

    if (studentUpdateError) {
      return { success: false, error: `Academic update failed: ${studentUpdateError.message}` };
    }

    revalidatePath("/dashboard/admin/students");
    return { success: true, studentId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Deactivate or Drop a student without deleting academic, attendance, or fee records.
 */
export async function setStudentStatusAction(
  studentId: string,
  action: "deactivate" | "activate" | "drop" | "reinstate"
): Promise<StudentActionResponse> {
  try {
    const caller = await requireRole(["admin", "principal"]);
    const adminSupabase = createAdminClient();

    // Verify student belongs to caller's institution
    const { data: student, error: fetchError } = await adminSupabase
      .from("students")
      .select("id, institution_id")
      .eq("id", studentId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (fetchError || !student) {
      return { success: false, error: "Student record not found in this institution." };
    }

    if (action === "deactivate") {
      await adminSupabase.from("profiles").update({ status: "inactive" }).eq("id", studentId).eq("institution_id", caller.institutionId);
    } else if (action === "activate") {
      await adminSupabase.from("profiles").update({ status: "active" }).eq("id", studentId).eq("institution_id", caller.institutionId);
    } else if (action === "drop") {
      await adminSupabase.from("students").update({ is_dropped: true }).eq("id", studentId).eq("institution_id", caller.institutionId);
    } else if (action === "reinstate") {
      await adminSupabase.from("students").update({ is_dropped: false }).eq("id", studentId).eq("institution_id", caller.institutionId);
    }

    revalidatePath("/dashboard/admin/students");
    return { success: true, studentId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}
