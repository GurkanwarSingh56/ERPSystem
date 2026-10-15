import { generateCsvTemplate } from "./parser";

export type ImportEntity =
  | "departments"
  | "courses"
  | "semesters"
  | "sections"
  | "subjects"
  | "teachers"
  | "students"
  | "teacher_subjects";

export interface EntityDefinition {
  entity: ImportEntity;
  title: string;
  description: string;
  dependencies: ImportEntity[];
  requiredHeaders: string[];
  optionalHeaders: string[];
  exampleRow: Record<string, string>;
}

export const ENTITY_DEFINITIONS: Record<ImportEntity, EntityDefinition> = {
  departments: {
    entity: "departments",
    title: "Departments",
    description: "Academic faculty departments and branches (e.g. Computer Science, Mechanical).",
    dependencies: [],
    requiredHeaders: ["code", "name"],
    optionalHeaders: [],
    exampleRow: {
      code: "CSE",
      name: "Computer Science & Engineering",
    },
  },
  courses: {
    entity: "courses",
    title: "Courses / Programs",
    description: "Approved degree programs linked to a department.",
    dependencies: ["departments"],
    requiredHeaders: ["department_code", "code", "name", "duration_years"],
    optionalHeaders: [],
    exampleRow: {
      department_code: "CSE",
      code: "BTECH-CSE",
      name: "Bachelor of Technology in CS",
      duration_years: "4",
    },
  },
  semesters: {
    entity: "semesters",
    title: "Semesters",
    description: "Course semester cohorts (numbers 1 to 12).",
    dependencies: ["courses"],
    requiredHeaders: ["course_code", "semester_number"],
    optionalHeaders: [],
    exampleRow: {
      course_code: "BTECH-CSE",
      semester_number: "1",
    },
  },
  sections: {
    entity: "sections",
    title: "Class Sections",
    description: "Class cohorts within a course and semester (e.g. Section A, Section B).",
    dependencies: ["semesters"],
    requiredHeaders: ["course_code", "semester_number", "name"],
    optionalHeaders: [],
    exampleRow: {
      course_code: "BTECH-CSE",
      semester_number: "1",
      name: "Section A",
    },
  },
  subjects: {
    entity: "subjects",
    title: "Curricular Subjects",
    description: "Academic subjects with codes, types, and assessment max marks.",
    dependencies: ["semesters"],
    requiredHeaders: ["course_code", "semester_number", "code", "name", "type"],
    optionalHeaders: [
      "max_internal_marks",
      "max_midterm_marks",
      "max_final_marks",
      "max_practical_marks",
    ],
    exampleRow: {
      course_code: "BTECH-CSE",
      semester_number: "1",
      code: "CS101",
      name: "Introduction to Programming",
      type: "theory",
      max_internal_marks: "30",
      max_midterm_marks: "20",
      max_final_marks: "50",
      max_practical_marks: "0",
    },
  },
  teachers: {
    entity: "teachers",
    title: "Faculty & Teachers",
    description: "Faculty accounts, employee IDs, and designations.",
    dependencies: ["departments"],
    requiredHeaders: ["employee_id", "department_code", "full_name", "email", "designation"],
    optionalHeaders: ["phone"],
    exampleRow: {
      employee_id: "EMP-CS-101",
      department_code: "CSE",
      full_name: "Dr. Grace Hopper",
      email: "grace.hopper@college.local",
      designation: "Associate Professor",
      phone: "+1-555-0199",
    },
  },
  students: {
    entity: "students",
    title: "Student Roster",
    description: "Enrolled student profiles, roll numbers, admissions, and section mappings.",
    dependencies: ["sections"],
    requiredHeaders: [
      "roll_number",
      "admission_number",
      "course_code",
      "semester_number",
      "section_name",
      "full_name",
      "email",
    ],
    optionalHeaders: ["phone"],
    exampleRow: {
      roll_number: "2026-CSE-001",
      admission_number: "ADM-2026-001",
      course_code: "BTECH-CSE",
      semester_number: "1",
      section_name: "Section A",
      full_name: "Alice Smith",
      email: "alice.smith@college.local",
      phone: "+1-555-0123",
    },
  },
  teacher_subjects: {
    entity: "teacher_subjects",
    title: "Teaching Allocations",
    description: "Allocates a faculty member to teach a subject for a specific section.",
    dependencies: ["teachers", "subjects", "sections"],
    requiredHeaders: ["employee_id", "subject_code", "section_name", "course_code", "semester_number"],
    optionalHeaders: [],
    exampleRow: {
      employee_id: "EMP-CS-101",
      subject_code: "CS101",
      section_name: "Section A",
      course_code: "BTECH-CSE",
      semester_number: "1",
    },
  },
};

export const IMPORT_ORDER: ImportEntity[] = [
  "departments",
  "courses",
  "semesters",
  "sections",
  "subjects",
  "teachers",
  "students",
  "teacher_subjects",
];

export function getEntityTemplateContent(entity: ImportEntity): string {
  const def = ENTITY_DEFINITIONS[entity];
  const allHeaders = [...def.requiredHeaders, ...def.optionalHeaders];
  return generateCsvTemplate(allHeaders, def.exampleRow);
}
