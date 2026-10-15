import { createAdminClient } from "@/lib/supabase/admin";
import { ImportEntity, ENTITY_DEFINITIONS } from "./entities";
import { parseCsv } from "./parser";

export interface RowValidationResult {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PreviewValidationResult {
  entity: ImportEntity;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: RowValidationResult[];
  missingDependencies: string[];
}

export async function validateCsvData(
  entity: ImportEntity,
  csvText: string,
  institutionId: string
): Promise<PreviewValidationResult> {
  const parsed = parseCsv(csvText);
  const def = ENTITY_DEFINITIONS[entity];
  const adminSupabase = createAdminClient();

  const missingDependencies: string[] = [];
  const rows: RowValidationResult[] = [];

  // Check required headers
  const missingHeaders = def.requiredHeaders.filter((h) => !parsed.headers.includes(h.toLowerCase()));
  if (missingHeaders.length > 0) {
    return {
      entity,
      totalRows: parsed.rows.length,
      validRowsCount: 0,
      invalidRowsCount: parsed.rows.length,
      rows: parsed.rows.map((r, idx) => ({
        rowNumber: idx + 2,
        data: r,
        isValid: false,
        errors: [`Missing required header columns: ${missingHeaders.join(", ")}`],
        warnings: [],
      })),
      missingDependencies: [`CSV header missing required columns: ${missingHeaders.join(", ")}`],
    };
  }

  // Pre-load lookup caches for this institution to validate relations
  const [
    deptRes,
    coursesRes,
    semestersRes,
    sectionsRes,
    subjectsRes,
    teachersRes,
    studentsRes,
  ] = await Promise.all([
    adminSupabase.from("departments").select("id, code, name").eq("institution_id", institutionId),
    adminSupabase.from("courses").select("id, code, name, department_id").eq("institution_id", institutionId),
    adminSupabase.from("semesters").select("id, semester_number, course_id").eq("institution_id", institutionId),
    adminSupabase.from("sections").select("id, name, semester_id, course_id").eq("institution_id", institutionId),
    adminSupabase.from("subjects").select("id, code, name, course_id, semester_id").eq("institution_id", institutionId),
    adminSupabase.from("teachers").select("id, employee_id").eq("institution_id", institutionId),
    adminSupabase.from("students").select("id, roll_number, admission_number").eq("institution_id", institutionId),
  ]);

  const deptsByCode = new Map((deptRes.data || []).map((d) => [d.code.trim().toUpperCase(), d]));
  const coursesByCode = new Map((coursesRes.data || []).map((c) => [c.code.trim().toUpperCase(), c]));
  
  // composite: courseId_semNumber
  const semestersByKey = new Map(
    (semestersRes.data || []).map((s) => [`${s.course_id}_${s.semester_number}`, s])
  );

  // composite: courseId_semId_secName
  const sectionsByKey = new Map(
    (sectionsRes.data || []).map((sec) => [
      `${sec.course_id}_${sec.semester_id}_${sec.name.trim().toLowerCase()}`,
      sec,
    ])
  );

  const subjectsByCode = new Map((subjectsRes.data || []).map((sub) => [sub.code.trim().toUpperCase(), sub]));
  const teachersByEmpId = new Map((teachersRes.data || []).map((t) => [t.employee_id.trim().toUpperCase(), t]));
  const studentsByRoll = new Set((studentsRes.data || []).map((st) => st.roll_number.trim().toUpperCase()));
  const studentsByAdmission = new Set((studentsRes.data || []).map((st) => st.admission_number.trim().toUpperCase()));

  // In-file duplicate trackers
  const fileSeenKeys = new Set<string>();

  for (let idx = 0; idx < parsed.rows.length; idx++) {
    const raw = parsed.rows[idx];
    const rowNumber = idx + 2; // header is row 1
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    // 1. Basic required fields check
    for (const reqHdr of def.requiredHeaders) {
      const val = raw[reqHdr.toLowerCase()]?.trim();
      if (!val) {
        rowErrors.push(`Column '${reqHdr}' is required.`);
      }
    }

    // 2. Entity-specific business logic & foreign key validation
    if (entity === "departments") {
      const code = raw.code?.trim().toUpperCase();
      if (code) {
        if (deptsByCode.has(code)) {
          rowErrors.push(`Department code '${code}' already exists in your institution.`);
        }
        if (fileSeenKeys.has(code)) {
          rowErrors.push(`Duplicate department code '${code}' within CSV file.`);
        }
        fileSeenKeys.add(code);
      }
    } else if (entity === "courses") {
      const deptCode = raw.department_code?.trim().toUpperCase();
      const code = raw.code?.trim().toUpperCase();
      const duration = parseInt(raw.duration_years || "", 10);

      if (deptCode && !deptsByCode.has(deptCode)) {
        rowErrors.push(`Parent department code '${deptCode}' not found. Please import or create department first.`);
      }
      if (code) {
        if (coursesByCode.has(code)) {
          rowErrors.push(`Course code '${code}' already exists in your institution.`);
        }
        if (fileSeenKeys.has(code)) {
          rowErrors.push(`Duplicate course code '${code}' within CSV file.`);
        }
        fileSeenKeys.add(code);
      }
      if (isNaN(duration) || duration < 1 || duration > 6) {
        rowErrors.push(`Duration years must be an integer between 1 and 6.`);
      }
    } else if (entity === "semesters") {
      const courseCode = raw.course_code?.trim().toUpperCase();
      const semNum = parseInt(raw.semester_number || "", 10);

      const course = courseCode ? coursesByCode.get(courseCode) : null;
      if (courseCode && !course) {
        rowErrors.push(`Course code '${courseCode}' not found.`);
      }
      if (isNaN(semNum) || semNum < 1 || semNum > 12) {
        rowErrors.push(`Semester number must be an integer between 1 and 12.`);
      } else if (course) {
        const key = `${course.id}_${semNum}`;
        if (semestersByKey.has(key)) {
          rowErrors.push(`Semester ${semNum} for course '${courseCode}' already exists.`);
        }
        if (fileSeenKeys.has(key)) {
          rowErrors.push(`Duplicate semester ${semNum} for course '${courseCode}' within CSV.`);
        }
        fileSeenKeys.add(key);
      }
    } else if (entity === "sections") {
      const courseCode = raw.course_code?.trim().toUpperCase();
      const semNum = parseInt(raw.semester_number || "", 10);
      const name = raw.name?.trim();

      const course = courseCode ? coursesByCode.get(courseCode) : null;
      if (courseCode && !course) {
        rowErrors.push(`Course code '${courseCode}' not found.`);
      }
      const sem = course && !isNaN(semNum) ? semestersByKey.get(`${course.id}_${semNum}`) : null;
      if (!sem && course && !isNaN(semNum)) {
        rowErrors.push(`Semester ${semNum} for course '${courseCode}' not found.`);
      }

      if (course && sem && name) {
        const key = `${course.id}_${sem.id}_${name.toLowerCase()}`;
        if (sectionsByKey.has(key)) {
          rowErrors.push(`Section '${name}' already exists in Semester ${semNum} of '${courseCode}'.`);
        }
        if (fileSeenKeys.has(key)) {
          rowErrors.push(`Duplicate section '${name}' within CSV for this semester.`);
        }
        fileSeenKeys.add(key);
      }
    } else if (entity === "subjects") {
      const courseCode = raw.course_code?.trim().toUpperCase();
      const semNum = parseInt(raw.semester_number || "", 10);
      const code = raw.code?.trim().toUpperCase();
      const type = raw.type?.trim().toLowerCase();

      const course = courseCode ? coursesByCode.get(courseCode) : null;
      if (courseCode && !course) {
        rowErrors.push(`Course code '${courseCode}' not found.`);
      }
      const sem = course && !isNaN(semNum) ? semestersByKey.get(`${course.id}_${semNum}`) : null;
      if (!sem && course && !isNaN(semNum)) {
        rowErrors.push(`Semester ${semNum} for course '${courseCode}' not found.`);
      }

      if (code) {
        if (subjectsByCode.has(code)) {
          rowErrors.push(`Subject code '${code}' already exists in your institution.`);
        }
        if (fileSeenKeys.has(code)) {
          rowErrors.push(`Duplicate subject code '${code}' within CSV.`);
        }
        fileSeenKeys.add(code);
      }

      if (type && !["theory", "practical", "both"].includes(type)) {
        rowErrors.push(`Type must be 'theory', 'practical', or 'both'. Got '${type}'.`);
      }
    } else if (entity === "teachers") {
      const empId = raw.employee_id?.trim().toUpperCase();
      const deptCode = raw.department_code?.trim().toUpperCase();
      const email = raw.email?.trim().toLowerCase();

      if (empId) {
        if (teachersByEmpId.has(empId)) {
          rowErrors.push(`Employee ID '${empId}' already exists in your institution.`);
        }
        if (fileSeenKeys.has(empId)) {
          rowErrors.push(`Duplicate employee ID '${empId}' within CSV.`);
        }
        fileSeenKeys.add(empId);
      }
      if (deptCode && !deptsByCode.has(deptCode)) {
        rowErrors.push(`Department code '${deptCode}' not found.`);
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rowErrors.push(`Invalid email address format: '${email}'.`);
      }
    } else if (entity === "students") {
      const roll = raw.roll_number?.trim().toUpperCase();
      const admission = raw.admission_number?.trim().toUpperCase();
      const courseCode = raw.course_code?.trim().toUpperCase();
      const semNum = parseInt(raw.semester_number || "", 10);
      const secName = raw.section_name?.trim();
      const email = raw.email?.trim().toLowerCase();

      if (roll) {
        if (studentsByRoll.has(roll)) {
          rowErrors.push(`Roll number '${roll}' already exists in your institution.`);
        }
        if (fileSeenKeys.has(`roll_${roll}`)) {
          rowErrors.push(`Duplicate roll number '${roll}' within CSV.`);
        }
        fileSeenKeys.add(`roll_${roll}`);
      }

      if (admission) {
        if (studentsByAdmission.has(admission)) {
          rowErrors.push(`Admission number '${admission}' already exists in your institution.`);
        }
        if (fileSeenKeys.has(`adm_${admission}`)) {
          rowErrors.push(`Duplicate admission number '${admission}' within CSV.`);
        }
        fileSeenKeys.add(`adm_${admission}`);
      }

      const course = courseCode ? coursesByCode.get(courseCode) : null;
      if (courseCode && !course) {
        rowErrors.push(`Course code '${courseCode}' not found.`);
      }
      const sem = course && !isNaN(semNum) ? semestersByKey.get(`${course.id}_${semNum}`) : null;
      if (!sem && course && !isNaN(semNum)) {
        rowErrors.push(`Semester ${semNum} for course '${courseCode}' not found.`);
      }
      const sec = course && sem && secName ? sectionsByKey.get(`${course.id}_${sem.id}_${secName.toLowerCase()}`) : null;
      if (!sec && course && sem && secName) {
        rowErrors.push(`Section '${secName}' not found for ${courseCode} Semester ${semNum}.`);
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rowErrors.push(`Invalid email address format: '${email}'.`);
      }
    } else if (entity === "teacher_subjects") {
      const empId = raw.employee_id?.trim().toUpperCase();
      const subCode = raw.subject_code?.trim().toUpperCase();
      const courseCode = raw.course_code?.trim().toUpperCase();
      const semNum = parseInt(raw.semester_number || "", 10);
      const secName = raw.section_name?.trim();

      const teacher = empId ? teachersByEmpId.get(empId) : null;
      if (empId && !teacher) {
        rowErrors.push(`Teacher with employee ID '${empId}' not found.`);
      }

      const subject = subCode ? subjectsByCode.get(subCode) : null;
      if (subCode && !subject) {
        rowErrors.push(`Subject code '${subCode}' not found.`);
      }

      const course = courseCode ? coursesByCode.get(courseCode) : null;
      if (courseCode && !course) {
        rowErrors.push(`Course code '${courseCode}' not found.`);
      }

      const sem = course && !isNaN(semNum) ? semestersByKey.get(`${course.id}_${semNum}`) : null;
      if (!sem && course && !isNaN(semNum)) {
        rowErrors.push(`Semester ${semNum} for course '${courseCode}' not found.`);
      }

      const sec = course && sem && secName ? sectionsByKey.get(`${course.id}_${sem.id}_${secName.toLowerCase()}`) : null;
      if (!sec && course && sem && secName) {
        rowErrors.push(`Section '${secName}' not found for ${courseCode} Semester ${semNum}.`);
      }

      if (teacher && subject && sec) {
        const key = `${teacher.id}_${subject.id}_${sec.id}`;
        if (fileSeenKeys.has(key)) {
          rowErrors.push(`Duplicate teacher-subject-section allocation within CSV.`);
        }
        fileSeenKeys.add(key);
      }
    }

    const isValid = rowErrors.length === 0;
    rows.push({
      rowNumber,
      data: raw,
      isValid,
      errors: rowErrors,
      warnings: rowWarnings,
    });
  }

  const validRowsCount = rows.filter((r) => r.isValid).length;
  const invalidRowsCount = rows.length - validRowsCount;

  return {
    entity,
    totalRows: rows.length,
    validRowsCount,
    invalidRowsCount,
    rows,
    missingDependencies,
  };
}
