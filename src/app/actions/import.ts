"use server";

import { requireRole } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ImportEntity, ENTITY_DEFINITIONS } from "@/lib/csv/entities";
import { validateCsvData, PreviewValidationResult } from "@/lib/csv/validator";
import { WizardStepKey } from "@/lib/csv/wizardEntities";
import { validateWizardCsv, WizardPreviewResult, WizardValidationOptions } from "@/lib/csv/wizardValidator";
import { revalidatePath } from "next/cache";

export type ImportActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export interface CommitImportSummary {
  entity?: ImportEntity;
  stepKey?: WizardStepKey;
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: { row: number; message: string }[];
  workloadWarnings?: string[];
}

/**
 * Validates a standard CSV string in dry-run mode (Phase 12 legacy compatible).
 */
export async function previewCsvImportAction(
  entity: ImportEntity,
  csvText: string
): Promise<ImportActionResponse<PreviewValidationResult>> {
  try {
    const caller = await requireRole(["admin", "principal"]);
    const preview = await validateCsvData(entity, csvText, caller.institutionId);
    return { success: true, data: preview };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to parse CSV preview." };
  }
}

/**
 * Validates a CSV string in dry-run mode for the 4-step wizard.
 */
export async function previewWizardImportAction(
  stepKey: WizardStepKey,
  csvText: string,
  options: WizardValidationOptions = {}
): Promise<ImportActionResponse<WizardPreviewResult>> {
  try {
    const caller = await requireRole(["admin", "principal"]);
    const preview = await validateWizardCsv(stepKey, csvText, caller.institutionId, options);
    return { success: true, data: preview };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to validate wizard CSV preview." };
  }
}

/**
 * Commits a 4-step wizard CSV batch with explicit admin update mode,
 * auto-creation of missing departments/sections, and workload checks.
 */
export async function commitWizardImportAction(
  stepKey: WizardStepKey,
  csvText: string,
  options: WizardValidationOptions = {}
): Promise<ImportActionResponse<CommitImportSummary>> {
  try {
    const caller = await requireRole(["admin", "principal"]);
    const adminSupabase = createAdminClient();
    const institutionId = caller.institutionId;

    // 1. Run server-side validation
    const preview = await validateWizardCsv(stepKey, csvText, institutionId, options);

    const summary: CommitImportSummary = {
      stepKey,
      totalProcessed: preview.totalRows,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: preview.invalidRowsCount,
      errors: [],
      workloadWarnings: preview.workloadWarnings || [],
    };

    // Gather row-level validation errors
    preview.rows.forEach((r) => {
      if (!r.isValid) {
        summary.errors.push({ row: r.rowNumber, message: r.errors.join("; ") });
      }
    });

    const validRows = preview.rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      return { success: true, data: summary };
    }

    // Reference lookups
    const [deptRes, coursesRes, semestersRes, sectionsRes, subjectsRes, teachersRes, studentsRes] =
      await Promise.all([
        adminSupabase.from("departments").select("id, code, name").eq("institution_id", institutionId),
        adminSupabase.from("courses").select("id, code, name, department_id").eq("institution_id", institutionId),
        adminSupabase.from("semesters").select("id, semester_number, course_id").eq("institution_id", institutionId),
        adminSupabase.from("sections").select("id, name, semester_id, course_id").eq("institution_id", institutionId),
        adminSupabase.from("subjects").select("id, code, name, course_id, semester_id, type, weekly_hours").eq("institution_id", institutionId),
        adminSupabase.from("teachers").select("id, employee_id, min_load, max_load, department_id").eq("institution_id", institutionId),
        adminSupabase.from("students").select("id, roll_number, admission_number").eq("institution_id", institutionId),
      ]);

    const deptsByCode = new Map((deptRes.data || []).map((d) => [d.code.trim().toUpperCase(), d]));
    const coursesByCode = new Map((coursesRes.data || []).map((c) => [c.code.trim().toUpperCase(), c]));
    const teachersByEmpId = new Map((teachersRes.data || []).map((t) => [t.employee_id.trim().toUpperCase(), t]));
    const subjectsByCode = new Map((subjectsRes.data || []).map((s) => [s.code.trim().toUpperCase(), s]));

    // Composite maps
    const semestersByCourseAndNum = new Map(
      (semestersRes.data || []).map((s) => [`${s.course_id}_${s.semester_number}`, s])
    );
    const sectionsByCourseSemName = new Map(
      (sectionsRes.data || []).map((sec) => [
        `${sec.course_id}_${sec.semester_id}_${sec.name.trim().toUpperCase()}`,
        sec,
      ])
    );

    // ==========================================
    // STEP 1: FACULTY MASTER
    // ==========================================
    if (stepKey === "step1_faculty") {
      // 1a. Auto-create missing departments safely
      if (preview.detectedDepartmentsToCreate && preview.detectedDepartmentsToCreate.length > 0) {
        for (const deptCode of preview.detectedDepartmentsToCreate) {
          const normCode = deptCode.trim().toUpperCase();
          if (!deptsByCode.has(normCode)) {
            const { data: newDept, error: deptErr } = await adminSupabase
              .from("departments")
              .insert({
                institution_id: institutionId,
                code: normCode,
                name: `Department of ${normCode}`,
              })
              .select("id, code, name")
              .single();

            if (!deptErr && newDept) {
              deptsByCode.set(normCode, newDept);
            }
          }
        }
      }

      // 1b. Process Faculty Rows
      for (const r of validRows) {
        try {
          const facId = r.data.faculty_id.trim().toUpperCase();
          const name = r.data.name.trim();
          const deptCode = r.data.dept_code.trim().toUpperCase();
          const designation = r.data.designation.trim();
          const minLoad = parseInt(r.data.min_load.trim(), 10);
          const maxLoad = parseInt(r.data.max_load.trim(), 10);
          const email = (r.data.email || `${facId.toLowerCase()}@college.local`).trim().toLowerCase();
          const phone = r.data.phone?.trim() || null;

          const dept = deptsByCode.get(deptCode);
          if (!dept) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: `Could not resolve or create department '${deptCode}'.` });
            continue;
          }

          const existingTeacher = teachersByEmpId.get(facId);

          if (existingTeacher) {
            if (options.updateExisting) {
              // Update existing teacher record
              await adminSupabase
                .from("teachers")
                .update({
                  designation,
                  min_load: minLoad,
                  max_load: maxLoad,
                  department_id: dept.id,
                })
                .eq("id", existingTeacher.id)
                .eq("institution_id", institutionId);

              // Update profile display details
              await adminSupabase
                .from("profiles")
                .update({
                  full_name: name,
                  phone,
                })
                .eq("id", existingTeacher.id)
                .eq("institution_id", institutionId);

              summary.updatedCount++;
            } else {
              summary.skippedCount++;
            }
          } else {
            // Create user auth, profile, and teacher
            const tempPassword = `Faculty${Math.random().toString(36).substring(2, 8)}!2026`;
            const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { full_name: name },
            });

            if (authErr || !authUser?.user) {
              summary.failedCount++;
              summary.errors.push({ row: r.rowNumber, message: authErr?.message || "Auth user creation failed." });
              continue;
            }

            const userId = authUser.user.id;
            await adminSupabase.from("profiles").insert({
              id: userId,
              institution_id: institutionId,
              email,
              full_name: name,
              role: "teacher",
              phone,
              status: "active",
            });

            const { data: newTeacher, error: teacherErr } = await adminSupabase
              .from("teachers")
              .insert({
                id: userId,
                institution_id: institutionId,
                employee_id: facId,
                department_id: dept.id,
                designation,
                min_load: minLoad,
                max_load: maxLoad,
              })
              .select("id, employee_id, min_load, max_load, department_id")
              .single();

            if (teacherErr) {
              summary.failedCount++;
              summary.errors.push({ row: r.rowNumber, message: teacherErr.message });
              continue;
            }

            teachersByEmpId.set(facId, newTeacher);
            summary.createdCount++;
          }
        } catch (itemErr: any) {
          summary.failedCount++;
          summary.errors.push({ row: r.rowNumber, message: itemErr.message });
        }
      }
    }

    // ==========================================
    // STEP 2: CURRICULUM & SUBJECT CATALOG
    // ==========================================
    else if (stepKey === "step2_curriculum") {
      for (const r of validRows) {
        try {
          const subjectCode = r.data.subject_code.trim().toUpperCase();
          const subjectName = r.data.subject_name.trim();
          const deptBranch = r.data.dept_branch.trim().toUpperCase();
          const semNum = parseInt(r.data.sem.trim(), 10);
          const rawType = r.data.type.trim().toLowerCase();
          const type = (rawType === "lab" || rawType === "practical") ? "practical" : "theory";
          const weeklyHours = parseInt(r.data.weekly_hours.trim(), 10);

          // 2a. Resolve department
          let dept = deptsByCode.get(deptBranch);
          if (!dept) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: `Department '${deptBranch}' not found.` });
            continue;
          }

          // 2b. Resolve or auto-provision course for this department/branch
          let course = coursesByCode.get(deptBranch) || coursesByCode.get(`BTECH-${deptBranch}`);
          if (!course) {
            const courseCode = deptBranch;
            const courseName = `Bachelor of Technology in ${dept.name.replace("Department of ", "")}`;
            const { data: newCourse, error: cErr } = await adminSupabase
              .from("courses")
              .insert({
                institution_id: institutionId,
                department_id: dept.id,
                code: courseCode,
                name: courseName,
                duration_years: 4,
              })
              .select("id, code, name, department_id")
              .single();

            if (cErr || !newCourse) {
              summary.failedCount++;
              summary.errors.push({ row: r.rowNumber, message: cErr?.message || `Could not create course for '${deptBranch}'.` });
              continue;
            }
            course = newCourse;
            coursesByCode.set(courseCode, course);
          }

          // 2c. Resolve or auto-provision semester
          let semester = semestersByCourseAndNum.get(`${course.id}_${semNum}`);
          if (!semester) {
            const { data: newSem, error: semErr } = await adminSupabase
              .from("semesters")
              .insert({
                institution_id: institutionId,
                course_id: course.id,
                semester_number: semNum,
              })
              .select("id, semester_number, course_id")
              .single();

            if (semErr || !newSem) {
              summary.failedCount++;
              summary.errors.push({ row: r.rowNumber, message: semErr?.message || `Could not create Semester ${semNum}.` });
              continue;
            }
            semester = newSem;
            semestersByCourseAndNum.set(`${course.id}_${semNum}`, semester);
          }

          // 2d. Insert or Update Subject
          const existingSub = subjectsByCode.get(subjectCode);
          if (existingSub) {
            if (options.updateExisting) {
              await adminSupabase
                .from("subjects")
                .update({
                  name: subjectName,
                  type,
                  weekly_hours: weeklyHours,
                })
                .eq("id", existingSub.id)
                .eq("institution_id", institutionId);

              summary.updatedCount++;
            } else {
              summary.skippedCount++;
            }
          } else {
            const { data: newSub, error: subErr } = await adminSupabase
              .from("subjects")
              .insert({
                institution_id: institutionId,
                course_id: course.id,
                semester_id: semester.id,
                code: subjectCode,
                name: subjectName,
                type,
                weekly_hours: weeklyHours,
                max_internal_marks: 30,
                max_midterm_marks: 20,
                max_final_marks: 50,
                max_practical_marks: type === "practical" ? 50 : 0,
              })
              .select("id, code, name, course_id, semester_id, type, weekly_hours")
              .single();

            if (subErr || !newSub) {
              summary.failedCount++;
              summary.errors.push({ row: r.rowNumber, message: subErr?.message || `Failed to insert subject ${subjectCode}.` });
              continue;
            }

            subjectsByCode.set(subjectCode, newSub);
            summary.createdCount++;
          }
        } catch (itemErr: any) {
          summary.failedCount++;
          summary.errors.push({ row: r.rowNumber, message: itemErr.message });
        }
      }
    }

    // ==========================================
    // STEP 3: STUDENT ROSTER
    // ==========================================
    else if (stepKey === "step3_students") {
      for (const r of validRows) {
        try {
          const rollNo = r.data.roll_no.trim().toUpperCase();
          const name = r.data.name.trim();
          const branch = r.data.branch.trim().toUpperCase();
          const semNum = parseInt(r.data.sem.trim(), 10);
          const secName = r.data.section.trim().toUpperCase();
          const email = (r.data.email || `${rollNo.toLowerCase()}@student.college.local`).trim().toLowerCase();

          // 3a. Resolve department & course
          const dept = deptsByCode.get(branch);
          let course = coursesByCode.get(branch) || coursesByCode.get(`BTECH-${branch}`);
          if (!dept || !course) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: `Branch / Course '${branch}' not found.` });
            continue;
          }

          // 3b. Resolve semester
          let semester = semestersByCourseAndNum.get(`${course.id}_${semNum}`);
          if (!semester) {
            const { data: newSem } = await adminSupabase
              .from("semesters")
              .insert({
                institution_id: institutionId,
                course_id: course.id,
                semester_number: semNum,
              })
              .select("id, semester_number, course_id")
              .single();
            if (newSem) {
              semester = newSem;
              semestersByCourseAndNum.set(`${course.id}_${semNum}`, semester);
            }
          }

          if (!semester) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: `Semester ${semNum} not found for course '${branch}'.` });
            continue;
          }

          // 3c. Resolve or auto-create section (e.g. "Section A" or "A")
          const normalizedSectionName = secName.startsWith("SECTION") ? secName : `Section ${secName}`;
          let section =
            sectionsByCourseSemName.get(`${course.id}_${semester.id}_${secName}`) ||
            sectionsByCourseSemName.get(`${course.id}_${semester.id}_${normalizedSectionName.toUpperCase()}`);

          if (!section) {
            const { data: newSec, error: secErr } = await adminSupabase
              .from("sections")
              .insert({
                institution_id: institutionId,
                course_id: course.id,
                semester_id: semester.id,
                name: normalizedSectionName,
              })
              .select("id, name, semester_id, course_id")
              .single();

            if (secErr || !newSec) {
              summary.failedCount++;
              summary.errors.push({ row: r.rowNumber, message: secErr?.message || `Failed to auto-create section ${secName}.` });
              continue;
            }
            section = newSec;
            sectionsByCourseSemName.set(`${course.id}_${semester.id}_${secName}`, section);
            sectionsByCourseSemName.set(`${course.id}_${semester.id}_${normalizedSectionName.toUpperCase()}`, section);
          }

          // 3d. Check existing student
          const existingStudent = (studentsRes.data || []).find(
            (s: any) => s.roll_number.trim().toUpperCase() === rollNo
          );

          if (existingStudent) {
            if (options.updateExisting) {
              await adminSupabase
                .from("students")
                .update({
                  department_id: dept.id,
                  course_id: course.id,
                  semester_id: semester.id,
                  section_id: section.id,
                })
                .eq("id", existingStudent.id)
                .eq("institution_id", institutionId);

              await adminSupabase
                .from("profiles")
                .update({ full_name: name })
                .eq("id", existingStudent.id)
                .eq("institution_id", institutionId);

              summary.updatedCount++;
            } else {
              summary.skippedCount++;
            }
          } else {
            // Provision user auth, profile, and student
            const tempPassword = `Student${Math.random().toString(36).substring(2, 8)}!2026`;
            const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { full_name: name },
            });

            if (authErr || !authUser?.user) {
              summary.failedCount++;
              summary.errors.push({ row: r.rowNumber, message: authErr?.message || "Auth student creation failed." });
              continue;
            }

            const userId = authUser.user.id;
            await adminSupabase.from("profiles").insert({
              id: userId,
              institution_id: institutionId,
              email,
              full_name: name,
              role: "student",
              status: "active",
            });

            await adminSupabase.from("students").insert({
              id: userId,
              institution_id: institutionId,
              roll_number: rollNo,
              admission_number: `ADM-${rollNo}`,
              department_id: dept.id,
              course_id: course.id,
              semester_id: semester.id,
              section_id: section.id,
            });

            summary.createdCount++;
          }
        } catch (itemErr: any) {
          summary.failedCount++;
          summary.errors.push({ row: r.rowNumber, message: itemErr.message });
        }
      }
    }

    // ==========================================
    // STEP 4: TEACHING ALLOCATION MATRIX
    // ==========================================
    else if (stepKey === "step4_allocations") {
      for (const r of validRows) {
        try {
          const facId = r.data.faculty_id.trim().toUpperCase();
          const subjectCode = r.data.subject_code.trim().toUpperCase();
          const branch = r.data.branch.trim().toUpperCase();
          const semNum = parseInt(r.data.sem.trim(), 10);
          const secName = r.data.section.trim().toUpperCase();

          const teacher = teachersByEmpId.get(facId);
          const subject = subjectsByCode.get(subjectCode);
          let course = coursesByCode.get(branch) || coursesByCode.get(`BTECH-${branch}`);

          if (!teacher || !subject || !course) {
            summary.failedCount++;
            summary.errors.push({
              row: r.rowNumber,
              message: `Reference lookup failed: Teacher '${facId}', Subject '${subjectCode}', Course '${branch}'.`,
            });
            continue;
          }

          const semester = semestersByCourseAndNum.get(`${course.id}_${semNum}`);
          if (!semester) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: `Semester ${semNum} not found for course '${branch}'.` });
            continue;
          }

          const normalizedSectionName = secName.startsWith("SECTION") ? secName : `Section ${secName}`;
          const section =
            sectionsByCourseSemName.get(`${course.id}_${semester.id}_${secName}`) ||
            sectionsByCourseSemName.get(`${course.id}_${semester.id}_${normalizedSectionName.toUpperCase()}`);

          if (!section) {
            summary.failedCount++;
            summary.errors.push({
              row: r.rowNumber,
              message: `Section '${secName}' not found. Please import Step 3 Student Roster first.`,
            });
            continue;
          }

          // Check for existing allocation
          const { data: existingAlloc } = await adminSupabase
            .from("teacher_subjects")
            .select("id")
            .eq("institution_id", institutionId)
            .eq("teacher_id", teacher.id)
            .eq("subject_id", subject.id)
            .eq("section_id", section.id)
            .maybeSingle();

          if (existingAlloc) {
            summary.skippedCount++;
            continue;
          }

          // Insert verified allocation
          const { error: allocErr } = await adminSupabase.from("teacher_subjects").insert({
            institution_id: institutionId,
            teacher_id: teacher.id,
            course_id: course.id,
            semester_id: semester.id,
            subject_id: subject.id,
            section_id: section.id,
          });

          if (allocErr) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: allocErr.message });
          } else {
            summary.createdCount++;
          }
        } catch (itemErr: any) {
          summary.failedCount++;
          summary.errors.push({ row: r.rowNumber, message: itemErr.message });
        }
      }
    }

    revalidatePath("/dashboard/admin/academic");
    revalidatePath("/dashboard/admin/teachers");
    revalidatePath("/dashboard/admin/students");
    revalidatePath("/dashboard/admin/timetable");
    revalidatePath("/dashboard/admin/data-import");

    return { success: true, data: summary };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to commit wizard import." };
  }
}

/**
 * Commits a validated CSV batch to the database within the authenticated administrator's institution (Legacy Phase 12).
 */
export async function commitCsvImportAction(
  entity: ImportEntity,
  csvText: string
): Promise<ImportActionResponse<CommitImportSummary>> {
  try {
    const caller = await requireRole(["admin", "principal"]);
    const adminSupabase = createAdminClient();
    const institutionId = caller.institutionId;

    const preview = await validateCsvData(entity, csvText, institutionId);

    const summary: CommitImportSummary = {
      entity,
      totalProcessed: preview.totalRows,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: preview.invalidRowsCount,
      errors: [],
    };

    preview.rows.forEach((r) => {
      if (!r.isValid) {
        summary.errors.push({ row: r.rowNumber, message: r.errors.join("; ") });
      }
    });

    const validRows = preview.rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      return { success: true, data: summary };
    }

    const [deptRes, coursesRes, semestersRes, sectionsRes] = await Promise.all([
      adminSupabase.from("departments").select("id, code, name").eq("institution_id", institutionId),
      adminSupabase.from("courses").select("id, code, name, department_id").eq("institution_id", institutionId),
      adminSupabase.from("semesters").select("id, semester_number, course_id").eq("institution_id", institutionId),
      adminSupabase.from("sections").select("id, name, semester_id, course_id").eq("institution_id", institutionId),
    ]);

    const deptsByCode = new Map((deptRes.data || []).map((d) => [d.code.trim().toUpperCase(), d]));
    const coursesByCode = new Map((coursesRes.data || []).map((c) => [c.code.trim().toUpperCase(), c]));
    const semestersByKey = new Map((semestersRes.data || []).map((s) => [`${s.course_id}_${s.semester_number}`, s]));
    const sectionsByKey = new Map(
      (sectionsRes.data || []).map((sec) => [`${sec.course_id}_${sec.semester_id}_${sec.name.trim().toLowerCase()}`, sec])
    );

    if (entity === "departments") {
      const inserts = validRows.map((r) => ({
        institution_id: institutionId,
        code: r.data.code.trim().toUpperCase(),
        name: r.data.name.trim(),
      }));

      const { data, error } = await adminSupabase.from("departments").insert(inserts).select("id");
      if (error) throw error;
      summary.createdCount = data?.length || inserts.length;
    } else if (entity === "courses") {
      const inserts = validRows.map((r) => {
        const dept = deptsByCode.get(r.data.department_code.trim().toUpperCase())!;
        return {
          institution_id: institutionId,
          department_id: dept.id,
          code: r.data.code.trim().toUpperCase(),
          name: r.data.name.trim(),
          duration_years: parseInt(r.data.duration_years || "4", 10),
        };
      });

      const { data, error } = await adminSupabase.from("courses").insert(inserts).select("id");
      if (error) throw error;
      summary.createdCount = data?.length || inserts.length;
    } else if (entity === "semesters") {
      const inserts = validRows.map((r) => {
        const course = coursesByCode.get(r.data.course_code.trim().toUpperCase())!;
        return {
          institution_id: institutionId,
          course_id: course.id,
          semester_number: parseInt(r.data.semester_number.trim(), 10),
        };
      });

      const { data, error } = await adminSupabase.from("semesters").insert(inserts).select("id");
      if (error) throw error;
      summary.createdCount = data?.length || inserts.length;
    } else if (entity === "sections") {
      const inserts = validRows.map((r) => {
        const course = coursesByCode.get(r.data.course_code.trim().toUpperCase())!;
        const semNum = parseInt(r.data.semester_number.trim(), 10);
        const sem = semestersByKey.get(`${course.id}_${semNum}`)!;
        return {
          institution_id: institutionId,
          course_id: course.id,
          semester_id: sem.id,
          name: r.data.name.trim(),
        };
      });

      const { data, error } = await adminSupabase.from("sections").insert(inserts).select("id");
      if (error) throw error;
      summary.createdCount = data?.length || inserts.length;
    } else if (entity === "subjects") {
      const inserts = validRows.map((r) => {
        const course = coursesByCode.get(r.data.course_code.trim().toUpperCase())!;
        const semNum = parseInt(r.data.semester_number.trim(), 10);
        const sem = semestersByKey.get(`${course.id}_${semNum}`)!;
        const rawType = r.data.type.trim().toLowerCase();
        const type = (rawType === "lab" || rawType === "practical") ? "practical" : "theory";
        return {
          institution_id: institutionId,
          course_id: course.id,
          semester_id: sem.id,
          code: r.data.code.trim().toUpperCase(),
          name: r.data.name.trim(),
          type,
          weekly_hours: parseInt(r.data.weekly_hours || "4", 10),
          max_internal_marks: 30,
          max_midterm_marks: 20,
          max_final_marks: 50,
          max_practical_marks: type === "practical" ? 50 : 0,
        };
      });

      const { data, error } = await adminSupabase.from("subjects").insert(inserts).select("id");
      if (error) throw error;
      summary.createdCount = data?.length || inserts.length;
    } else if (entity === "teachers") {
      for (const r of validRows) {
        try {
          const dept = deptsByCode.get(r.data.department_code.trim().toUpperCase())!;
          const tempPassword = `Teacher${Math.random().toString(36).substring(2, 8)}!2026`;

          const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
            email: r.data.email.trim().toLowerCase(),
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: r.data.full_name.trim() },
          });

          if (authErr || !authUser.user) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: authErr?.message || "Auth user creation failed." });
            continue;
          }

          const userId = authUser.user.id;
          await adminSupabase.from("profiles").insert({
            id: userId,
            institution_id: institutionId,
            email: r.data.email.trim().toLowerCase(),
            full_name: r.data.full_name.trim(),
            role: "teacher",
            phone: r.data.phone?.trim() || null,
            status: "active",
          });

          await adminSupabase.from("teachers").insert({
            id: userId,
            institution_id: institutionId,
            employee_id: r.data.employee_id.trim().toUpperCase(),
            department_id: dept.id,
            designation: r.data.designation?.trim() || "Assistant Professor",
            min_load: 12,
            max_load: 18,
          });

          summary.createdCount++;
        } catch (itemErr: any) {
          summary.failedCount++;
          summary.errors.push({ row: r.rowNumber, message: itemErr.message });
        }
      }
    } else if (entity === "students") {
      for (const r of validRows) {
        try {
          const course = coursesByCode.get(r.data.course_code.trim().toUpperCase())!;
          const semNum = parseInt(r.data.semester_number.trim(), 10);
          const sem = semestersByKey.get(`${course.id}_${semNum}`)!;
          const sec = sectionsByKey.get(`${course.id}_${sem.id}_${r.data.section_name.trim().toLowerCase()}`)!;
          const tempPassword = `Student${Math.random().toString(36).substring(2, 8)}!2026`;

          const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
            email: r.data.email.trim().toLowerCase(),
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: r.data.full_name.trim() },
          });

          if (authErr || !authUser.user) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: authErr?.message || "Auth user creation failed." });
            continue;
          }

          const userId = authUser.user.id;
          await adminSupabase.from("profiles").insert({
            id: userId,
            institution_id: institutionId,
            email: r.data.email.trim().toLowerCase(),
            full_name: r.data.full_name.trim(),
            role: "student",
            status: "active",
          });

          await adminSupabase.from("students").insert({
            id: userId,
            institution_id: institutionId,
            roll_number: r.data.roll_number.trim().toUpperCase(),
            admission_number: r.data.admission_number.trim().toUpperCase(),
            department_id: course.department_id,
            course_id: course.id,
            semester_id: sem.id,
            section_id: sec.id,
          });

          summary.createdCount++;
        } catch (itemErr: any) {
          summary.failedCount++;
          summary.errors.push({ row: r.rowNumber, message: itemErr.message });
        }
      }
    } else if (entity === "teacher_subjects") {
      const { data: teachers } = await adminSupabase
        .from("teachers")
        .select("id, employee_id")
        .eq("institution_id", institutionId);
      const { data: subjects } = await adminSupabase
        .from("subjects")
        .select("id, code")
        .eq("institution_id", institutionId);

      const teachersByEmp = new Map((teachers || []).map((t) => [t.employee_id.trim().toUpperCase(), t]));
      const subjectsByCodeMap = new Map((subjects || []).map((s) => [s.code.trim().toUpperCase(), s]));

      for (const r of validRows) {
        try {
          const teacher = teachersByEmp.get(r.data.employee_id.trim().toUpperCase())!;
          const subject = subjectsByCodeMap.get(r.data.subject_code.trim().toUpperCase())!;
          const course = coursesByCode.get(r.data.course_code.trim().toUpperCase())!;
          const semNum = parseInt(r.data.semester_number.trim(), 10);
          const sem = semestersByKey.get(`${course.id}_${semNum}`)!;
          const sec = sectionsByKey.get(`${course.id}_${sem.id}_${r.data.section_name.trim().toLowerCase()}`)!;

          const { error: insErr } = await adminSupabase.from("teacher_subjects").insert({
            institution_id: institutionId,
            teacher_id: teacher.id,
            course_id: course.id,
            semester_id: sem.id,
            subject_id: subject.id,
            section_id: sec.id,
          });

          if (insErr) {
            summary.failedCount++;
            summary.errors.push({ row: r.rowNumber, message: insErr.message });
          } else {
            summary.createdCount++;
          }
        } catch (err: any) {
          summary.failedCount++;
          summary.errors.push({ row: r.rowNumber, message: err.message });
        }
      }
    }

    revalidatePath("/dashboard/admin/academic");
    revalidatePath("/dashboard/admin/teachers");
    revalidatePath("/dashboard/admin/students");
    revalidatePath("/dashboard/admin/timetable");
    revalidatePath("/dashboard/admin/data-import");

    return { success: true, data: summary };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to commit CSV import." };
  }
}

/**
 * Manual Single-Record Creation Server Action for academic entities.
 */
export async function createAcademicEntityManualAction(
  entity: "department" | "course" | "semester" | "section" | "subject",
  payload: Record<string, any>
): Promise<ImportActionResponse<{ id: string }>> {
  try {
    const caller = await requireRole(["admin", "principal"]);
    const adminSupabase = createAdminClient();
    const institutionId = caller.institutionId;

    if (entity === "department") {
      const code = payload.code?.trim().toUpperCase();
      const name = payload.name?.trim();
      if (!code || !name) return { success: false, error: "Code and Name are required." };

      const { data, error } = await adminSupabase
        .from("departments")
        .insert({ institution_id: institutionId, code, name })
        .select("id")
        .single();
      if (error) throw error;
      return { success: true, data: { id: data.id } };
    } else if (entity === "course") {
      const { departmentId, code, name, durationYears } = payload;
      if (!departmentId || !code || !name) return { success: false, error: "All course fields are required." };

      const { data, error } = await adminSupabase
        .from("courses")
        .insert({
          institution_id: institutionId,
          department_id: departmentId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          duration_years: parseInt(durationYears, 10) || 4,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { success: true, data: { id: data.id } };
    } else if (entity === "semester") {
      const { courseId, semesterNumber } = payload;
      const semNum = parseInt(semesterNumber, 10);
      if (!courseId || isNaN(semNum)) return { success: false, error: "Course and Semester Number are required." };

      const { data, error } = await adminSupabase
        .from("semesters")
        .insert({
          institution_id: institutionId,
          course_id: courseId,
          semester_number: semNum,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { success: true, data: { id: data.id } };
    } else if (entity === "section") {
      const { courseId, semesterId, name } = payload;
      if (!courseId || !semesterId || !name) return { success: false, error: "Course, Semester, and Name are required." };

      const { data, error } = await adminSupabase
        .from("sections")
        .insert({
          institution_id: institutionId,
          course_id: courseId,
          semester_id: semesterId,
          name: name.trim(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return { success: true, data: { id: data.id } };
    } else if (entity === "subject") {
      const { courseId, semesterId, code, name, type, weeklyHours } = payload;
      if (!courseId || !semesterId || !code || !name || !type) {
        return { success: false, error: "All required subject fields must be filled." };
      }

      const { data, error } = await adminSupabase
        .from("subjects")
        .insert({
          institution_id: institutionId,
          course_id: courseId,
          semester_id: semesterId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          type: type.toLowerCase(),
          weekly_hours: parseInt(weeklyHours || "4", 10),
          max_internal_marks: 30,
          max_midterm_marks: 20,
          max_final_marks: 50,
          max_practical_marks: type === "practical" ? 50 : 0,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { success: true, data: { id: data.id } };
    }

    return { success: false, error: "Unsupported entity." };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to create record." };
  }
}
