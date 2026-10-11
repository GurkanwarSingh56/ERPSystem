import { z } from "zod";

export interface StudentListItem {
  id: string;
  institution_id: string;
  roll_number: string;
  admission_number: string;
  department_id: string;
  course_id: string;
  semester_id: string;
  section_id: string;
  is_dropped: boolean;
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

export interface StudentFilters {
  search?: string;
  departmentId?: string;
  courseId?: string;
  semesterId?: string;
  sectionId?: string;
  status?: string; // 'active' | 'inactive' | 'dropped'
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

export const createStudentSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Valid email address is required"),
  phone: z.string().optional().nullable(),
  rollNumber: z.string().min(1, "Roll number is required"),
  admissionNumber: z.string().min(1, "Admission number is required"),
  departmentId: z.string().uuid("Department selection is required"),
  courseId: z.string().uuid("Course selection is required"),
  semesterId: z.string().uuid("Semester selection is required"),
  sectionId: z.string().uuid("Section selection is required"),
  password: z.string().min(8, "Temporary password must be at least 8 characters"),
});

export const updateStudentSchema = z.object({
  studentId: z.string().uuid("Student ID is required"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().optional().nullable(),
  rollNumber: z.string().min(1, "Roll number is required"),
  isDropped: z.boolean().optional(),
});
