import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);

interface Course {
  id: string;
  code: string;
  name: string;
}

interface Semester {
  id: string;
  semester_number: number;
  course_id: string;
}

interface Section {
  id: string;
  name: string;
  course_id: string;
  semester_id: string;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  course_id: string;
  semester_id: string;
  weekly_hours: number;
  type: string;
}

interface Allocation {
  id: string;
  teacher_id: string;
  subject_id: string;
  section_id: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface Teacher {
  id: string;
  employee_id: string;
}

async function runDiagnosis() {
  const { data: courses } = await supabase.from("courses").select("id, code, name");
  const { data: semesters } = await supabase.from("semesters").select("id, semester_number, course_id");
  const { data: sections } = await supabase.from("sections").select("id, name, course_id, semester_id");
  const { data: subjects } = await supabase.from("subjects").select("id, code, name, course_id, semester_id, weekly_hours, type");
  const { data: allocations } = await supabase.from("teacher_subjects").select("id, teacher_id, subject_id, section_id");
  const { data: profiles } = await supabase.from("profiles").select("id, full_name");
  const { data: teachers } = await supabase.from("teachers").select("id, employee_id");

  const courseMap = new Map((courses || []).map((c: Course) => [c.id, c]));
  const semesterMap = new Map((semesters || []).map((s: Semester) => [s.id, s]));
  const subjectMap = new Map((subjects || []).map((s: Subject) => [s.id, s]));
  const profileMap = new Map((profiles || []).map((p: Profile) => [p.id, p]));
  const teacherMap = new Map((teachers || []).map((t: Teacher) => [t.id, t]));

  // Sort sections by course code, semester number, section name
  const sortedSections = [...(sections || [])].sort((a: Section, b: Section) => {
    const cA = courseMap.get(a.course_id)?.code || "";
    const cB = courseMap.get(b.course_id)?.code || "";
    if (cA !== cB) return cA.localeCompare(cB);
    const sA = semesterMap.get(a.semester_id)?.semester_number || 0;
    const sB = semesterMap.get(b.semester_id)?.semester_number || 0;
    if (sA !== sB) return sA - sB;
    return a.name.localeCompare(b.name);
  });

  console.log("==========================================================================================");
  console.log("SECTION / SUBJECT / TEACHER RELATIONSHIP AUDIT REPORT");
  console.log("==========================================================================================");

  const reportRows: any[] = [];

  for (const sec of sortedSections) {
    const course = courseMap.get(sec.course_id);
    const semester = semesterMap.get(sec.semester_id);

    // Subjects belonging to this course & semester
    const curriculumSubjects = (subjects || []).filter(
      (sub: Subject) => sub.course_id === sec.course_id && sub.semester_id === sec.semester_id
    );

    // Allocations for this exact section ID
    const secAllocations = (allocations || []).filter((a: Allocation) => a.section_id === sec.id);

    // Check relationship mismatches:
    // 1. Does subject belong to different course or semester?
    // 2. Does teacher ID exist in teachers/profiles?
    // 3. Are there duplicate allocations for the same subject?
    const mismatches: string[] = [];
    const assignedSubjectIds = new Set<string>();

    for (const alloc of secAllocations) {
      const sub = subjectMap.get(alloc.subject_id);
      if (!sub) {
        mismatches.push(`Unknown Subject ID ${alloc.subject_id}`);
      } else {
        if (sub.course_id !== sec.course_id) {
          mismatches.push(`Subject ${sub.code} course mismatch (${sub.course_id} != sec ${sec.course_id})`);
        }
        if (sub.semester_id !== sec.semester_id) {
          mismatches.push(`Subject ${sub.code} sem mismatch (${sub.semester_id} != sec ${sec.semester_id})`);
        }
        if (assignedSubjectIds.has(alloc.subject_id)) {
          // Check if it is a duplicate or lab group
          const prof = profileMap.get(alloc.teacher_id);
          mismatches.push(`Duplicate alloc for ${sub.code} (${prof?.full_name || alloc.teacher_id})`);
        }
        assignedSubjectIds.add(alloc.subject_id);
      }

      const t = teacherMap.get(alloc.teacher_id);
      const p = profileMap.get(alloc.teacher_id);
      if (!t || !p) {
        mismatches.push(`Invalid teacher/profile ID ${alloc.teacher_id}`);
      }
    }

    // Subjects in curriculum without teachers for this section
    const unassignedSubjects = curriculumSubjects.filter(
      (sub: Subject) => !secAllocations.some((a: Allocation) => a.subject_id === sub.id)
    );

    reportRows.push({
      course: course?.code || "UNKNOWN",
      semester: `S${semester?.semester_number || "?"}`,
      section: sec.name,
      sectionId: sec.id,
      allocCount: secAllocations.length,
      unassignedCount: unassignedSubjects.length,
      unassignedCodes: unassignedSubjects.map((s: Subject) => s.code).join(", "),
      mismatches: mismatches.length > 0 ? mismatches.join("; ") : "None"
    });
  }

  // Print compact markdown table
  console.log("| Course | Semester | Section | Section ID | Allocation Count | Subjects Without Teachers | Relationship Mismatches |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of reportRows) {
    const unassignedStr = r.unassignedCount > 0 ? `${r.unassignedCount} (${r.unassignedCodes})` : "0";
    console.log(`| ${r.course} | ${r.semester} | ${r.section} | \`${r.sectionId}\` | ${r.allocCount} | ${unassignedStr} | ${r.mismatches} |`);
  }

  console.log("\n==========================================================================================");
  console.log("INVESTIGATION OF KEY CASES");
  console.log("==========================================================================================");

  // Deep dive into CSE S7 A
  const s7aSec = sortedSections.find((s: Section) => courseMap.get(s.course_id)?.code === "CSE" && semesterMap.get(s.semester_id)?.semester_number === 7 && s.name === "A");
  if (s7aSec) {
    console.log("\n--- CSE S7 A Allocations Detail ---");
    const s7aAllocs = (allocations || []).filter((a: Allocation) => a.section_id === s7aSec.id);
    for (const a of s7aAllocs) {
      const sub = subjectMap.get(a.subject_id);
      const prof = profileMap.get(a.teacher_id);
      console.log(`Alloc ID: ${a.id} | Subject: ${sub?.code} (${sub?.name}) [weekly_hours: ${sub?.weekly_hours}, type: ${sub?.type}] | Teacher: ${prof?.full_name} (${a.teacher_id})`);
    }
  }

  // Check Course / Curriculum coverage for AI/ML, CS/DS, IT
  console.log("\n--- Non-CSE Courses Curriculum Subjects in Database ---");
  for (const c of (courses || []).filter((c: Course) => c.code !== "CSE")) {
    const cSubs = (subjects || []).filter((s: Subject) => s.course_id === c.id);
    console.log(`Course ${c.code} (${c.id}) has ${cSubs.length} subjects in 'subjects' table.`);
  }

  // Check CSE S1 A and B unassigned subjects
  const s1aSec = sortedSections.find((s: Section) => courseMap.get(s.course_id)?.code === "CSE" && semesterMap.get(s.semester_id)?.semester_number === 1 && s.name === "A");
  const s1bSec = sortedSections.find((s: Section) => courseMap.get(s.course_id)?.code === "CSE" && semesterMap.get(s.semester_id)?.semester_number === 1 && s.name === "B");
  console.log(`\nCSE S1 Curriculum Subjects Total: ${(subjects || []).filter((s: Subject) => s.course_id === s1aSec?.course_id && s.semester_id === s1aSec?.semester_id).map((s: Subject) => `${s.code} (${s.weekly_hours}h)`).join(", ")}`);
}

runDiagnosis().catch(console.error);
