import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/server";
import { StudentFilters, StudentListItem, PaginatedResult } from "./types";

/**
 * Server-side student query engine.
 * Applies tenant isolation, user role scope, pagination, and multi-field filters.
 */
export async function getStudents(filters: StudentFilters = {}): Promise<PaginatedResult<StudentListItem>> {
  const user = await requireAuth();
  const supabase = await createClient();

  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize || 10));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build query scoped strictly to authenticated user's institution
  let query = supabase
    .from("students")
    .select(`
      id,
      institution_id,
      roll_number,
      admission_number,
      department_id,
      course_id,
      semester_id,
      section_id,
      is_dropped,
      created_at,
      updated_at,
      profiles:id (
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
    `, { count: "exact" })
    .eq("institution_id", user.institutionId);

  // Apply Department Filter
  if (filters.departmentId) {
    query = query.eq("department_id", filters.departmentId);
  }

  // Apply Course Filter
  if (filters.courseId) {
    query = query.eq("course_id", filters.courseId);
  }

  // Apply Semester Filter
  if (filters.semesterId) {
    query = query.eq("semester_id", filters.semesterId);
  }

  // Apply Section Filter
  if (filters.sectionId) {
    query = query.eq("section_id", filters.sectionId);
  }

  // Apply Status / Dropped Filter
  if (filters.status === "dropped") {
    query = query.eq("is_dropped", true);
  } else if (filters.status === "active") {
    query = query.eq("is_dropped", false);
  }

  // Apply Search (Roll Number or Admission Number)
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`roll_number.ilike.${term},admission_number.ilike.${term}`);
  }

  // Sort and Paginate
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Failed to query students: ${error.message}`);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: (data as unknown as StudentListItem[]) || [],
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Fetch detailed student profile including academic and enrollment information.
 */
export async function getStudentById(studentId: string): Promise<StudentListItem | null> {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      institution_id,
      roll_number,
      admission_number,
      department_id,
      course_id,
      semester_id,
      section_id,
      is_dropped,
      created_at,
      updated_at,
      profiles:id (
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
    `)
    .eq("id", studentId)
    .eq("institution_id", user.institutionId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as unknown as StudentListItem;
}
