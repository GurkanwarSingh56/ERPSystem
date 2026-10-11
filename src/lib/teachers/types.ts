import { z } from "zod";

export interface TeacherListItem {
  id: string;
  institution_id: string;
  employee_id: string;
  department_id: string;
  designation: string;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    status: string;
    avatar_url: string | null;
  };
  departments?: {
    id: string;
    name: string;
    code: string;
  };
  teacher_subjects?: TeacherSubjectAllocation[];
}

export interface TeacherSubjectAllocation {
  id: string;
  institution_id: string;
  teacher_id: string;
  course_id: string;
  semester_id: string;
  subject_id: string;
  section_id: string;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  courses?: {
    id: string;
    name: string;
    code: string;
  };
  semesters?: {
    id: string;
    semester_number: number;
  };
  sections?: {
    id: string;
    name: string;
  };
}

export interface TeacherFilters {
  search?: string;
  departmentId?: string;
  status?: string; // 'active' | 'inactive' | 'suspended'
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const createTeacherSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Valid email address is required"),
  phone: z.string().optional().nullable(),
  employeeId: z.string().min(1, "Employee ID is required"),
  departmentId: z.string().uuid("Department selection is required"),
  designation: z.string().min(2, "Designation is required"),
  password: z.string().min(8, "Temporary password must be at least 8 characters"),
});

export const updateTeacherSchema = z.object({
  teacherId: z.string().uuid("Teacher ID is required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().optional().nullable(),
  departmentId: z.string().uuid("Department selection is required"),
  designation: z.string().min(2, "Designation is required"),
});

export const assignTeacherSubjectSchema = z.object({
  teacherId: z.string().uuid("Teacher ID is required"),
  courseId: z.string().uuid("Course selection is required"),
  semesterId: z.string().uuid("Semester selection is required"),
  subjectId: z.string().uuid("Subject selection is required"),
  sectionId: z.string().uuid("Section selection is required"),
});

export const removeTeacherSubjectSchema = z.object({
  allocationId: z.string().uuid("Allocation ID is required"),
  teacherId: z.string().uuid("Teacher ID is required"),
});
