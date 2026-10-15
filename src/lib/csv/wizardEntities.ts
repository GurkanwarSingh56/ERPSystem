import { generateCsvTemplate } from "./parser";

export type WizardStepKey = "step1_faculty" | "step2_curriculum" | "step3_students" | "step4_allocations";

export interface WizardStepDefinition {
  step: number;
  key: WizardStepKey;
  title: string;
  subtitle: string;
  description: string;
  requiredHeaders: string[];
  optionalHeaders: string[];
  exampleRow: Record<string, string>;
  dependencies: string[];
}

export const WIZARD_STEPS: Record<WizardStepKey, WizardStepDefinition> = {
  step1_faculty: {
    step: 1,
    key: "step1_faculty",
    title: "Faculty Master",
    subtitle: "Faculty profiles, designation, teaching-load bounds & auto-department creation",
    description: "Onboard teaching faculty with minimum and maximum weekly teaching loads. Missing departments are safely auto-created.",
    requiredHeaders: ["faculty_id", "name", "dept_code", "designation", "min_load", "max_load"],
    optionalHeaders: ["email", "phone"],
    exampleRow: {
      faculty_id: "FAC101",
      name: "Dr. Rajesh Kumar",
      dept_code: "CSE",
      designation: "Assistant Professor",
      min_load: "12",
      max_load: "18",
      email: "rajesh.kumar@college.local",
    },
    dependencies: [],
  },
  step2_curriculum: {
    step: 2,
    key: "step2_curriculum",
    title: "Curriculum & Subject Catalog",
    subtitle: "Subject codes, types, semesters & weekly teaching hours",
    description: "Define curricular subjects linked to departments/courses, semesters, and contact hours. Resolves or provisions unambiguous course/semester contexts.",
    requiredHeaders: ["subject_code", "subject_name", "dept_branch", "sem", "type", "weekly_hours"],
    optionalHeaders: ["academic_year"],
    exampleRow: {
      subject_code: "CS501",
      subject_name: "Database Systems",
      dept_branch: "CSE",
      sem: "5",
      type: "Theory",
      weekly_hours: "4",
      academic_year: "2026-2027",
    },
    dependencies: ["step1_faculty"],
  },
  step3_students: {
    step: 3,
    key: "step3_students",
    title: "Student Roster",
    subtitle: "Student roll numbers, names, section cohort mapping & auto-section provisioning",
    description: "Enroll students into sections (e.g. CSE-5-A). Missing section cohorts are created automatically without casing/whitespace duplicates.",
    requiredHeaders: ["roll_no", "name", "branch", "sem", "section"],
    optionalHeaders: ["email", "phone", "academic_year"],
    exampleRow: {
      roll_no: "24CSE042",
      name: "Aman Verma",
      branch: "CSE",
      sem: "5",
      section: "A",
      email: "aman.verma@college.local",
      academic_year: "2026-2027",
    },
    dependencies: ["step2_curriculum"],
  },
  step4_allocations: {
    step: 4,
    key: "step4_allocations",
    title: "Teaching Allocation Matrix",
    subtitle: "Faculty-to-subject & section assignment with load checks",
    description: "Assign faculty members to teach subjects for class sections. Enforces teacher maximum load limits and warns about minimum load shortfalls.",
    requiredHeaders: ["faculty_id", "subject_code", "branch", "sem", "section"],
    optionalHeaders: ["academic_year"],
    exampleRow: {
      faculty_id: "FAC101",
      subject_code: "CS501",
      branch: "CSE",
      sem: "5",
      section: "A",
      academic_year: "2026-2027",
    },
    dependencies: ["step1_faculty", "step2_curriculum", "step3_students"],
  },
};

export const WIZARD_STEPS_ORDER: WizardStepKey[] = [
  "step1_faculty",
  "step2_curriculum",
  "step3_students",
  "step4_allocations",
];

export function getWizardTemplateContent(stepKey: WizardStepKey): string {
  const def = WIZARD_STEPS[stepKey];
  const allHeaders = [...def.requiredHeaders, ...def.optionalHeaders];
  return generateCsvTemplate(allHeaders, def.exampleRow);
}
