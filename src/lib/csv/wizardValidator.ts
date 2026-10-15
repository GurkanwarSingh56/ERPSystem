import { createAdminClient } from "@/lib/supabase/admin";
import { WizardStepKey, WIZARD_STEPS } from "./wizardEntities";
import { parseCsv } from "./parser";

export interface WizardRowValidation {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  action: "create" | "update" | "skip";
}

export interface WizardPreviewResult {
  stepKey: WizardStepKey;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: WizardRowValidation[];
  missingDependencies: string[];
  detectedDepartmentsToCreate?: string[];
  detectedSectionsToCreate?: string[];
  workloadWarnings?: string[];
}

export interface WizardValidationOptions {
  updateExisting?: boolean; // explicit administrator choice
  academicYear?: string;
  courseCode?: string;
}

export async function validateWizardCsv(
  stepKey: WizardStepKey,
  csvText: string,
  institutionId: string,
  options: WizardValidationOptions = {}
): Promise<WizardPreviewResult> {
  const parsed = parseCsv(csvText);
  const def = WIZARD_STEPS[stepKey];
  const adminSupabase = createAdminClient();

  const rows: WizardRowValidation[] = [];
  const missingDependencies: string[] = [];
  const detectedDepartmentsToCreate = new Set<string>();
  const detectedSectionsToCreate = new Set<string>();
  const workloadWarnings: string[] = [];

  // 1. Header Validation
  const parsedHeaders = parsed.headers.map((h) => h.trim().toLowerCase());
  const missingHeaders = def.requiredHeaders.filter((req) => !parsedHeaders.includes(req.toLowerCase()));

  if (missingHeaders.length > 0) {
    return {
      stepKey,
      totalRows: parsed.rows.length,
      validRowsCount: 0,
      invalidRowsCount: parsed.rows.length,
      rows: parsed.rows.map((r, idx) => ({
        rowNumber: idx + 2,
        data: r,
        isValid: false,
        errors: [`Missing required header columns: ${missingHeaders.join(", ")}`],
        warnings: [],
        action: "skip",
      })),
      missingDependencies: [`CSV header missing required columns: ${missingHeaders.join(", ")}`],
    };
  }

  // 2. Fetch Reference Data for this Institution
  const [
    deptRes,
    coursesRes,
    semestersRes,
    sectionsRes,
    subjectsRes,
    teachersRes,
    studentsRes,
    teacherAllocRes,
  ] = await Promise.all([
    adminSupabase.from("departments").select("id, code, name").eq("institution_id", institutionId),
    adminSupabase.from("courses").select("id, code, name, department_id").eq("institution_id", institutionId),
    adminSupabase.from("semesters").select("id, semester_number, course_id").eq("institution_id", institutionId),
    adminSupabase.from("sections").select("id, name, semester_id, course_id").eq("institution_id", institutionId),
    adminSupabase.from("subjects").select("id, code, name, course_id, semester_id, type, weekly_hours").eq("institution_id", institutionId),
    adminSupabase.from("teachers").select("id, employee_id, min_load, max_load, department_id, profiles!inner(full_name, email)").eq("institution_id", institutionId),
    adminSupabase.from("students").select("id, roll_number, admission_number, section_id").eq("institution_id", institutionId),
    adminSupabase.from("teacher_subjects").select("id, teacher_id, subject_id, section_id, subjects(weekly_hours)").eq("institution_id", institutionId),
  ]);

  const deptsByCode = new Map((deptRes.data || []).map((d) => [d.code.trim().toUpperCase(), d]));
  const coursesByCode = new Map((coursesRes.data || []).map((c) => [c.code.trim().toUpperCase(), c]));
  
  // composite maps
  const semestersByCourseAndNum = new Map(
    (semestersRes.data || []).map((s) => [`${s.course_id}_${s.semester_number}`, s])
  );
  const sectionsByCourseSemAndName = new Map(
    (sectionsRes.data || []).map((sec) => [
      `${sec.course_id}_${sec.semester_id}_${sec.name.trim().toUpperCase()}`,
      sec,
    ])
  );
  const subjectsByInstCode = new Map(
    (subjectsRes.data || []).map((sub) => [sub.code.trim().toUpperCase(), sub])
  );
  const teachersByEmpId = new Map(
    (teachersRes.data || []).map((t) => [t.employee_id.trim().toUpperCase(), t])
  );
  const studentsByRoll = new Map(
    (studentsRes.data || []).map((s) => [s.roll_number.trim().toUpperCase(), s])
  );

  // In-file uniqueness trackers
  const seenFacultyIds = new Set<string>();
  const seenSubjectCodes = new Set<string>();
  const seenStudentRolls = new Set<string>();
  const seenAllocations = new Set<string>();

  // Map of teacher allocated hours for load checking
  const teacherLoadMap = new Map<string, number>();
  (teacherAllocRes.data || []).forEach((alloc: any) => {
    const tId = alloc.teacher_id;
    const hours = alloc.subjects?.weekly_hours || 4;
    teacherLoadMap.set(tId, (teacherLoadMap.get(tId) || 0) + hours);
  });

  // STEP SPECIFIC VALIDATION
  for (let i = 0; i < parsed.rows.length; i++) {
    const raw = parsed.rows[i];
    const rowNum = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    let action: "create" | "update" | "skip" = "create";

    if (stepKey === "step1_faculty") {
      const facId = (raw.faculty_id || "").trim();
      const name = (raw.name || "").trim();
      const deptCode = (raw.dept_code || "").trim().toUpperCase();
      const designation = (raw.designation || "").trim();
      const minLoadStr = (raw.min_load || "").trim();
      const maxLoadStr = (raw.max_load || "").trim();

      if (!facId) errors.push("faculty_id is required.");
      if (!name) errors.push("name is required.");
      if (!deptCode) errors.push("dept_code is required.");
      if (!designation) errors.push("designation is required.");

      const minLoad = parseInt(minLoadStr, 10);
      const maxLoad = parseInt(maxLoadStr, 10);

      if (isNaN(minLoad) || minLoad < 0) {
        errors.push(`min_load must be an integer >= 0 (got '${minLoadStr}').`);
      }
      if (isNaN(maxLoad) || maxLoad <= 0) {
        errors.push(`max_load must be an integer > 0 (got '${maxLoadStr}').`);
      }
      if (!isNaN(minLoad) && !isNaN(maxLoad) && minLoad > maxLoad) {
        errors.push(`min_load (${minLoad}) cannot be greater than max_load (${maxLoad}).`);
      }

      // In-file duplicate check
      const upperFacId = facId.toUpperCase();
      if (upperFacId) {
        if (seenFacultyIds.has(upperFacId)) {
          errors.push(`Duplicate faculty_id '${facId}' found within CSV file.`);
        } else {
          seenFacultyIds.add(upperFacId);
        }
      }

      // Check existing database record
      const existingTeacher = teachersByEmpId.get(upperFacId);
      if (existingTeacher) {
        if (options.updateExisting) {
          action = "update";
          warnings.push(`Faculty '${facId}' exists; will update designation & load bounds.`);
        } else {
          errors.push(`Faculty with ID '${facId}' already exists in your institution. To update, select 'Update Existing Records' mode.`);
          action = "skip";
        }
      }

      // Check department auto-creation requirement
      if (deptCode && !deptsByCode.has(deptCode)) {
        detectedDepartmentsToCreate.add(deptCode);
        warnings.push(`Department '${deptCode}' does not exist; will be automatically created.`);
      }
    } else if (stepKey === "step2_curriculum") {
      const subjectCode = (raw.subject_code || "").trim();
      const subjectName = (raw.subject_name || "").trim();
      const deptBranch = (raw.dept_branch || "").trim().toUpperCase();
      const semStr = (raw.sem || "").trim();
      const typeStr = (raw.type || "").trim();
      const weeklyHoursStr = (raw.weekly_hours || "").trim();

      if (!subjectCode) errors.push("subject_code is required.");
      if (!subjectName) errors.push("subject_name is required.");
      if (!deptBranch) errors.push("dept_branch is required.");
      if (!semStr) errors.push("sem is required.");
      if (!typeStr) errors.push("type is required.");
      if (!weeklyHoursStr) errors.push("weekly_hours is required.");

      const semNum = parseInt(semStr, 10);
      if (isNaN(semNum) || semNum < 1 || semNum > 12) {
        errors.push(`sem must be an integer between 1 and 12 (got '${semStr}').`);
      }

      const weeklyHours = parseInt(weeklyHoursStr, 10);
      if (isNaN(weeklyHours) || weeklyHours <= 0) {
        errors.push(`weekly_hours must be an integer > 0 (got '${weeklyHoursStr}').`);
      }

      const normalizedType = typeStr.toLowerCase();
      if (!["theory", "lab", "practical", "both"].includes(normalizedType)) {
        errors.push(`type '${typeStr}' is invalid. Supported: Theory, Lab, Practical, Both.`);
      }

      // In-file duplicate check
      const upperCode = subjectCode.toUpperCase();
      if (upperCode) {
        if (seenSubjectCodes.has(upperCode)) {
          errors.push(`Duplicate subject_code '${subjectCode}' found within CSV file.`);
        } else {
          seenSubjectCodes.add(upperCode);
        }
      }

      // Check DB duplicate
      if (upperCode && subjectsByInstCode.has(upperCode)) {
        if (options.updateExisting) {
          action = "update";
          warnings.push(`Subject '${subjectCode}' exists; will update name and weekly hours.`);
        } else {
          errors.push(`Subject with code '${subjectCode}' already exists in your institution.`);
          action = "skip";
        }
      }

      // Verify department mapping
      if (deptBranch && !deptsByCode.has(deptBranch)) {
        errors.push(`Department/Branch '${deptBranch}' does not exist. Please import Step 1 Faculty Master first or create the department.`);
      }
    } else if (stepKey === "step3_students") {
      const rollNo = (raw.roll_no || "").trim();
      const name = (raw.name || "").trim();
      const branch = (raw.branch || "").trim().toUpperCase();
      const semStr = (raw.sem || "").trim();
      const section = (raw.section || "").trim().toUpperCase();

      if (!rollNo) errors.push("roll_no is required.");
      if (!name) errors.push("name is required.");
      if (!branch) errors.push("branch is required.");
      if (!semStr) errors.push("sem is required.");
      if (!section) errors.push("section is required.");

      const semNum = parseInt(semStr, 10);
      if (isNaN(semNum) || semNum < 1 || semNum > 12) {
        errors.push(`sem must be an integer between 1 and 12 (got '${semStr}').`);
      }

      // In-file duplicate check
      const upperRoll = rollNo.toUpperCase();
      if (upperRoll) {
        if (seenStudentRolls.has(upperRoll)) {
          errors.push(`Duplicate student roll_no '${rollNo}' found within CSV file.`);
        } else {
          seenStudentRolls.add(upperRoll);
        }
      }

      // Check DB duplicate
      if (upperRoll && studentsByRoll.has(upperRoll)) {
        if (options.updateExisting) {
          action = "update";
          warnings.push(`Student '${rollNo}' exists; will update cohort section allocation.`);
        } else {
          errors.push(`Student with roll_no '${rollNo}' already exists in your institution.`);
          action = "skip";
        }
      }

      // Verify Branch exists
      if (branch && !deptsByCode.has(branch)) {
        errors.push(`Branch '${branch}' does not exist. Ensure department was created in Step 1.`);
      }

      // Section cohort check (e.g. CSE-5-A)
      if (branch && !isNaN(semNum) && section) {
        const cohortIdentifier = `${branch}-${semNum}-${section}`;
        detectedSectionsToCreate.add(cohortIdentifier);
      }
    } else if (stepKey === "step4_allocations") {
      const facId = (raw.faculty_id || "").trim().toUpperCase();
      const subjectCode = (raw.subject_code || "").trim().toUpperCase();
      const branch = (raw.branch || "").trim().toUpperCase();
      const semStr = (raw.sem || "").trim();
      const section = (raw.section || "").trim().toUpperCase();

      if (!facId) errors.push("faculty_id is required.");
      if (!subjectCode) errors.push("subject_code is required.");
      if (!branch) errors.push("branch is required.");
      if (!semStr) errors.push("sem is required.");
      if (!section) errors.push("section is required.");

      const semNum = parseInt(semStr, 10);
      if (isNaN(semNum) || semNum < 1 || semNum > 12) {
        errors.push(`sem must be an integer between 1 and 12 (got '${semStr}').`);
      }

      // Foreign key checks
      const teacher = teachersByEmpId.get(facId);
      if (facId && !teacher) {
        errors.push(`Faculty '${facId}' not found in institution. Ensure Faculty Master was imported in Step 1.`);
      }

      const subject = subjectsByInstCode.get(subjectCode);
      if (subjectCode && !subject) {
        errors.push(`Subject '${subjectCode}' not found. Ensure Curriculum Catalog was imported in Step 2.`);
      }

      if (branch && !deptsByCode.has(branch)) {
        errors.push(`Branch '${branch}' does not exist.`);
      }

      // Allocation uniqueness check
      const allocKey = `${facId}_${subjectCode}_${branch}_${semStr}_${section}`;
      if (seenAllocations.has(allocKey)) {
        errors.push(`Duplicate teaching allocation for Faculty '${facId}', Subject '${subjectCode}', and Section '${section}'.`);
      } else {
        seenAllocations.add(allocKey);
      }

      // Workload accumulation and maximum load check
      if (teacher && subject) {
        const subHours = subject.weekly_hours || 4;
        const currentLoad = (teacherLoadMap.get(teacher.id) || 0) + subHours;
        teacherLoadMap.set(teacher.id, currentLoad);

        if (teacher.max_load && currentLoad > teacher.max_load) {
          warnings.push(`Faculty '${facId}' workload (${currentLoad} hrs) exceeds maximum load limit (${teacher.max_load} hrs).`);
        }
      }
    }

    const isValid = errors.length === 0;
    rows.push({
      rowNumber: rowNum,
      data: raw,
      isValid,
      errors,
      warnings,
      action: isValid ? action : "skip",
    });
  }

  // Calculate post-step workload warnings for teachers falling short of min_load in Step 4
  if (stepKey === "step4_allocations") {
    teachersByEmpId.forEach((t) => {
      const allocated = teacherLoadMap.get(t.id) || 0;
      if (t.min_load && allocated < t.min_load) {
        workloadWarnings.push(
          `Faculty ${t.employee_id} (${(t.profiles as any)?.full_name || 'Staff'}) has ${allocated} allocated weekly hours, which is below the minimum load (${t.min_load} hrs).`
        );
      }
    });
  }

  const validRowsCount = rows.filter((r) => r.isValid).length;
  const invalidRowsCount = rows.length - validRowsCount;

  return {
    stepKey,
    totalRows: rows.length,
    validRowsCount,
    invalidRowsCount,
    rows,
    missingDependencies,
    detectedDepartmentsToCreate: Array.from(detectedDepartmentsToCreate),
    detectedSectionsToCreate: Array.from(detectedSectionsToCreate),
    workloadWarnings,
  };
}
