import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/server";
import { TeacherFilters, TeacherListItem, PaginatedResult } from "./types";

/**
 * Server-side faculty query engine.
 * Applies tenant isolation, user role scope, pagination, and multi-field filters.
 */
export async function getTeachers(filters: TeacherFilters = {}): Promise<PaginatedResult<TeacherListItem>> {
  const user = await requireAuth();
  const supabase = await createClient();

  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build query scoped strictly to authenticated user's institution
  let query = supabase
    .from("teachers")
    .select(`
      id,
      institution_id,
      employee_id,
      department_id,
      designation,
      created_at,
      updated_at,
      profiles!inner(
        id,
        email,
        full_name,
        phone,
        status,
        avatar_url
      ),
      departments:department_id (
        id,
        name,
        code
      )
    `, { count: "exact" })
    .eq("institution_id", user.institutionId);

  // Apply Department Filter
  if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }

  // Apply Status Filter
  if (filters.status && filters.status !== "all") {
    query = query.eq("profiles.status", filters.status);
  }

  // Apply Search (Employee ID or Teacher Name or Email)
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`employee_id.ilike.${term},profiles.full_name.ilike.${term},profiles.email.ilike.${term}`);
  }

  // Sort and Paginate
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Failed to query teachers: ${error.message}`);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: (data as unknown as TeacherListItem[]) || [],
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Fetch detailed teacher profile including departmental information and assigned curricular allocations.
 */
export async function getTeacherById(teacherId: string): Promise<TeacherListItem | null> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("teachers")
    .select(`
      id,
      institution_id,
      employee_id,
      department_id,
      designation,
      created_at,
      updated_at,
      profiles!inner(
        id,
        email,
        full_name,
        phone,
        status,
        avatar_url
      ),
      departments:department_id (
        id,
        name,
        code
      ),
      teacher_subjects (
        id,
        institution_id,
        teacher_id,
        course_id,
        semester_id,
        subject_id,
        section_id,
        created_at,
        subjects:subject_id (
          id,
          name,
          code,
          type
        ),
        courses:course_id (
          id,
          name,
          code
        ),
        semesters:semester_id (
          id,
          semester_number
        ),
        sections:section_id (
          id,
          name
        )
      )
    `)
    .eq("id", teacherId)
    .eq("institution_id", user.institutionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as unknown as TeacherListItem;
}
