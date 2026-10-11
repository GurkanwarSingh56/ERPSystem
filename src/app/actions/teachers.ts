"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireRole } from "@/lib/auth/server";
import {
  createTeacherSchema,
  updateTeacherSchema,
  assignTeacherSubjectSchema,
  removeTeacherSubjectSchema,
} from "@/lib/teachers/types";
import { revalidatePath } from "next/cache";

export type TeacherActionResponse = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  teacherId?: string;
  allocationId?: string;
};

/**
 * Create a new faculty member account, profile, and teacher record.
 * Restricted to administrators and principals.
 */
export async function createTeacherAction(
  prevState: unknown,
  formData: FormData
): Promise<TeacherActionResponse> {
  try {
    const caller = await requireRole(["admin", "principal"]);

    const rawData = {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone") || null,
      employeeId: formData.get("employeeId"),
      departmentId: formData.get("departmentId"),
      designation: formData.get("designation"),
      password: formData.get("password"),
    };

    const parseResult = createTeacherSchema.safeParse(rawData);
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

    // 0. Verify Department belongs to caller's institution
    const { data: dept, error: deptError } = await adminSupabase
      .from("departments")
      .select("id")
      .eq("id", input.departmentId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (deptError || !dept) {
      return {
        success: false,
        error: "Selected department does not exist in your institution.",
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
      role: "teacher",
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

    // 3. Insert into public.teachers
    const { error: teacherError } = await adminSupabase.from("teachers").insert({
      id: userId,
      institution_id: caller.institutionId,
      employee_id: input.employeeId,
      department_id: input.departmentId,
      designation: input.designation,
    });

    if (teacherError) {
      await adminSupabase.from("profiles").delete().eq("id", userId);
      await adminSupabase.auth.admin.deleteUser(userId);
      return {
        success: false,
        error: `Failed to create faculty record: ${teacherError.message}`,
      };
    }

    revalidatePath("/dashboard/admin/teachers");
    return { success: true, teacherId: userId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Update teacher details (Full Name, Phone, Department, Designation).
 * Restricted to administrators, principals, and HODs (within their department).
 */
export async function updateTeacherAction(
  prevState: unknown,
  formData: FormData
): Promise<TeacherActionResponse> {
  try {
    const caller = await requireRole(["admin", "principal", "hod"]);

    const rawData = {
      teacherId: formData.get("teacherId"),
      fullName: formData.get("fullName"),
      phone: formData.get("phone") || null,
      departmentId: formData.get("departmentId"),
      designation: formData.get("designation"),
    };

    const parseResult = updateTeacherSchema.safeParse(rawData);
    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message;
        }
      });
      return { success: false, fieldErrors, error: "Validation failed." };
    }

    const { teacherId, fullName, phone, departmentId, designation } = parseResult.data;
    const adminSupabase = createAdminClient();

    // Verify teacher belongs to caller's institution
    const { data: teacher, error: fetchError } = await adminSupabase
      .from("teachers")
      .select("id, department_id, institution_id")
      .eq("id", teacherId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (fetchError || !teacher) {
      return { success: false, error: "Teacher record not found in this institution." };
    }

    // Verify department target belongs to caller's institution
    const { data: targetDept } = await adminSupabase
      .from("departments")
      .select("id, hod_id")
      .eq("id", departmentId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (!targetDept) {
      return { success: false, error: "Target department does not exist in your institution." };
    }

    // If caller is HOD, verify they lead this teacher's department or target department
    if (caller.role === "hod") {
      const { data: currentDept } = await adminSupabase
        .from("departments")
        .select("hod_id")
        .eq("id", teacher.department_id)
        .single();

      if (currentDept?.hod_id !== caller.userId && targetDept.hod_id !== caller.userId) {
        return { success: false, error: "Access Denied: HOD can only manage faculty within their assigned department." };
      }
    }

    // 1. Update Profile (Name & Phone)
    const { error: profileUpdateError } = await adminSupabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teacherId);

    if (profileUpdateError) {
      return { success: false, error: `Profile update failed: ${profileUpdateError.message}` };
    }

    // 2. Update Teacher Record
    const { error: teacherUpdateError } = await adminSupabase
      .from("teachers")
      .update({
        department_id: departmentId,
        designation: designation,
        updated_at: new Date().toISOString(),
      })
      .eq("id", teacherId);

    if (teacherUpdateError) {
      return { success: false, error: `Faculty update failed: ${teacherUpdateError.message}` };
    }

    revalidatePath("/dashboard/admin/teachers");
    revalidatePath(`/dashboard/admin/teachers/${teacherId}`);
    return { success: true, teacherId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Deactivate or Reactivate faculty account status.
 * Updates public.profiles status ('active' | 'inactive') without deleting teaching or academic history.
 */
export async function setTeacherStatusAction(
  teacherId: string,
  action: "activate" | "deactivate"
): Promise<TeacherActionResponse> {
  try {
    const caller = await requireRole(["admin", "principal"]);
    const adminSupabase = createAdminClient();

    // Verify teacher belongs to caller's institution
    const { data: teacher, error: fetchError } = await adminSupabase
      .from("teachers")
      .select("id, institution_id")
      .eq("id", teacherId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (fetchError || !teacher) {
      return { success: false, error: "Teacher record not found in this institution." };
    }

    const newStatus = action === "activate" ? "active" : "inactive";
    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", teacherId);

    if (updateError) {
      return { success: false, error: `Status update failed: ${updateError.message}` };
    }

    revalidatePath("/dashboard/admin/teachers");
    revalidatePath(`/dashboard/admin/teachers/${teacherId}`);
    return { success: true, teacherId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Map/Assign a teacher to a course subject and section.
 * Validates composite foreign key integrity:
 * (institution_id, course_id, semester_id, subject_id) -> subjects
 * (institution_id, course_id, semester_id, section_id) -> sections
 */
export async function assignTeacherSubjectAction(
  prevState: unknown,
  formData: FormData
): Promise<TeacherActionResponse> {
  try {
    const caller = await requireRole(["admin", "principal", "hod"]);

    const rawData = {
      teacherId: formData.get("teacherId"),
      courseId: formData.get("courseId"),
      semesterId: formData.get("semesterId"),
      subjectId: formData.get("subjectId"),
      sectionId: formData.get("sectionId"),
    };

    const parseResult = assignTeacherSubjectSchema.safeParse(rawData);
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

    // Verify teacher belongs to caller's institution
    const { data: teacher, error: teacherError } = await adminSupabase
      .from("teachers")
      .select("id, department_id, institution_id")
      .eq("id", input.teacherId)
      .eq("institution_id", caller.institutionId)
      .single();

    if (teacherError || !teacher) {
      return { success: false, error: "Teacher does not belong to your institution." };
    }

    // Insert allocation record
    const { data: allocation, error: insertError } = await adminSupabase
      .from("teacher_subjects")
      .insert({
        institution_id: caller.institutionId,
        teacher_id: input.teacherId,
        course_id: input.courseId,
        semester_id: input.semesterId,
        subject_id: input.subjectId,
        section_id: input.sectionId,
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return {
          success: false,
          error: "This teacher is already assigned to this subject and section.",
        };
      }
      return {
        success: false,
        error: `Failed to allocate subject: ${insertError.message}`,
      };
    }

    revalidatePath(`/dashboard/admin/teachers/${input.teacherId}`);
    return { success: true, teacherId: input.teacherId, allocationId: allocation?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}

/**
 * Remove an allocated subject assignment from a teacher.
 */
export async function removeTeacherSubjectAction(
  allocationId: string,
  teacherId: string
): Promise<TeacherActionResponse> {
  try {
    const caller = await requireRole(["admin", "principal", "hod"]);
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
      .from("teacher_subjects")
      .delete()
      .eq("id", allocationId)
      .eq("institution_id", caller.institutionId);

    if (error) {
      return { success: false, error: `Failed to remove subject allocation: ${error.message}` };
    }

    revalidatePath(`/dashboard/admin/teachers/${teacherId}`);
    return { success: true, teacherId, allocationId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return { success: false, error: message };
  }
}
