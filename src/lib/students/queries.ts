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
      profiles!inner (
        id,
        email,
        full_name,
        phone,
        status,
        avatar_url
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
    console.error("Failed to query students:", error);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const rawStudents = (data || []) as any[];

  // Hydrate academic entities if students exist
  if (rawStudents.length > 0) {
    const deptIds = [...new Set(rawStudents.map((s) => s.department_id).filter(Boolean))];
    const courseIds = [...new Set(rawStudents.map((s) => s.course_id).filter(Boolean))];
    const semIds = [...new Set(rawStudents.map((s) => s.semester_id).filter(Boolean))];
    const secIds = [...new Set(rawStudents.map((s) => s.section_id).filter(Boolean))];

    const [deptsRes, coursesRes, semsRes, secsRes] = await Promise.all([
      deptIds.length > 0
        ? supabase.from("departments").select("id, name, code").in("id", deptIds)
        : Promise.resolve({ data: [] }),
      courseIds.length > 0
        ? supabase.from("courses").select("id, name, code").in("id", courseIds)
        : Promise.resolve({ data: [] }),
      semIds.length > 0
        ? supabase.from("semesters").select("id, semester_number").in("id", semIds)
        : Promise.resolve({ data: [] }),
      secIds.length > 0
        ? supabase.from("sections").select("id, name").in("id", secIds)
        : Promise.resolve({ data: [] }),
    ]);

    const deptMap = new Map((deptsRes.data || []).map((d: any) => [d.id, d]));
    const courseMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c]));
    const semMap = new Map((semsRes.data || []).map((s: any) => [s.id, s]));
    const secMap = new Map((secsRes.data || []).map((sec: any) => [sec.id, sec]));

    for (const student of rawStudents) {
      student.departments = deptMap.get(student.department_id) || undefined;
      student.courses = courseMap.get(student.course_id) || undefined;
      student.semesters = semMap.get(student.semester_id) || undefined;
      student.sections = secMap.get(student.section_id) || undefined;
    }
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: rawStudents as StudentListItem[],
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
      profiles!inner (
        id,
        email,
        full_name,
        phone,
        status,
        avatar_url
      )
    `)
    .eq("id", studentId)
    .eq("institution_id", user.institutionId)
    .single();

  if (error || !data) {
    return null;
  }

  const student = data as any;
  const [deptRes, courseRes, semRes, secRes] = await Promise.all([
    supabase.from("departments").select("id, name, code").eq("id", student.department_id).maybeSingle(),
    supabase.from("courses").select("id, name, code").eq("id", student.course_id).maybeSingle(),
    supabase.from("semesters").select("id, semester_number").eq("id", student.semester_id).maybeSingle(),
    supabase.from("sections").select("id, name").eq("id", student.section_id).maybeSingle(),
  ]);

  student.departments = deptRes.data || undefined;
  student.courses = courseRes.data || undefined;
  student.semesters = semRes.data || undefined;
  student.sections = secRes.data || undefined;

  return student as StudentListItem;
}
