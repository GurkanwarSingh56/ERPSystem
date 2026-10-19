import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);
const instId = "00000000-0000-0000-0000-000000000001";
const cseDeptId = "8fae898d-e3d5-419a-81c5-87a2e15bcc9c";

interface FacultyDef {
  name: string;
  email: string;
  employeeId: string;
  designation: string;
}

const NEW_FACULTY: FacultyDef[] = [
  { name: "Mr. Abhishek Singh", email: "abhishek.singh@college.local", employeeId: "FAC123", designation: "Assistant Professor" },
  { name: "Mr. Raman Kumar", email: "raman.kumar@college.local", employeeId: "FAC124", designation: "Assistant Professor" },
  { name: "Mr. Robin", email: "robin@college.local", employeeId: "FAC125", designation: "Assistant Professor" },
  { name: "Ms. Neeru Jambal", email: "neeru.jambal@college.local", employeeId: "FAC126", designation: "Assistant Professor" },
  { name: "Ms. Anureet", email: "anureet@college.local", employeeId: "FAC127", designation: "Assistant Professor" },
  { name: "Mr. Ram", email: "ram@college.local", employeeId: "FAC128", designation: "Assistant Professor" },
  { name: "Ms. Alka Rani", email: "alka.rani@college.local", employeeId: "FAC129", designation: "Assistant Professor" },
  { name: "Ms. Rupika", email: "rupika@college.local", employeeId: "FAC130", designation: "Assistant Professor" },
  { name: "Mr. Anil Thakur", email: "anil.thakur@college.local", employeeId: "FAC131", designation: "Assistant Professor" },
  { name: "Mr. Rahul", email: "rahul@college.local", employeeId: "FAC132", designation: "Assistant Professor" },
  { name: "Ms. Maninder Kaur", email: "maninder.kaur@college.local", employeeId: "FAC133", designation: "Assistant Professor" },
  { name: "Syed Mohsin", email: "syed.mohsin@college.local", employeeId: "FAC134", designation: "Assistant Professor" },
  { name: "Er. Deepika", email: "deepika@college.local", employeeId: "FAC135", designation: "Assistant Professor" },
  { name: "Institutional Faculty (Shared)", email: "institutional.faculty@college.local", employeeId: "FAC136", designation: "Institutional / Shared Placeholder" },
];

async function ensureFaculty() {
  const teacherIdMap = new Map<string, string>();

  // Fetch existing profiles and teachers
  const { data: profs } = await supabase.from("profiles").select("id, full_name, email");
  const { data: teachers } = await supabase.from("teachers").select("id, employee_id");

  for (const p of profs || []) {
    const t = teachers?.find(x => x.id === p.id);
    if (t) {
      teacherIdMap.set(p.full_name, p.id);
      // Also map normalized key
      const norm = p.full_name.toLowerCase().replace(/^(mr\.|ms\.|dr\.|er\.)\s*/, "").trim();
      teacherIdMap.set(norm, p.id);
    }
  }

  for (const f of NEW_FACULTY) {
    const norm = f.name.toLowerCase().replace(/^(mr\.|ms\.|dr\.|er\.)\s*/, "").trim();
    if (teacherIdMap.has(f.name) || teacherIdMap.has(norm)) {
      console.log(`Faculty ${f.name} already exists.`);
      continue;
    }

    console.log(`Creating faculty ${f.name} (${f.employeeId})...`);
    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: f.email,
      password: "LocalDevelopmentOnlyPassword123!",
      email_confirm: true,
      user_metadata: { full_name: f.name },
    });

    if (authError || !authData.user) {
      console.error(`Failed to create auth user for ${f.name}:`, authError);
      continue;
    }

    const userId = authData.user.id;

    // 2. Insert into profiles
    const { error: pErr } = await supabase.from("profiles").insert({
      id: userId,
      institution_id: instId,
      email: f.email,
      full_name: f.name,
      role: "teacher",
      status: "active",
    });
    if (pErr) {
      console.error(`Failed to insert profile for ${f.name}:`, pErr);
      continue;
    }

    // 3. Insert into teachers
    const { error: tErr } = await supabase.from("teachers").insert({
      id: userId,
      institution_id: instId,
      employee_id: f.employeeId,
      department_id: cseDeptId,
      designation: f.designation,
      min_load: 12,
      max_load: 20,
    });
    if (tErr) {
      console.error(`Failed to insert teacher for ${f.name}:`, tErr);
      continue;
    }

    teacherIdMap.set(f.name, userId);
    teacherIdMap.set(norm, userId);
    console.log(`Successfully created faculty ${f.name} -> ID: ${userId}`);
  }

  return teacherIdMap;
}

async function runImport() {
  console.log("================================================================================");
  console.log("PHASE 17 — IMPORT MISSING SUBJECTS & TEACHER ALLOCATIONS FROM OFFICIAL TIMETABLE");
  console.log("================================================================================\n");

  const teacherMap = await ensureFaculty();

  // Helper to resolve teacher ID
  function getTeacherId(name: string): string {
    const exact = teacherMap.get(name);
    if (exact) return exact;
    const norm = name.toLowerCase().replace(/^(mr\.|ms\.|dr\.|er\.)\s*/, "").trim();
    const resolved = teacherMap.get(norm);
    if (!resolved) {
      throw new Error(`Could not resolve teacher identity for "${name}"`);
    }
    return resolved;
  }

  const instTeacherId = getTeacherId("Institutional Faculty (Shared)");

  // 1. Resolve Courses
  const { data: courses } = await supabase.from("courses").select("id, code");
  const courseMap = new Map((courses || []).map((c: any) => [c.code, c.id]));
  const aimlCourseId = courseMap.get("AI/ML")!;
  const csdsCourseId = courseMap.get("CS/DS")!;
  const itCourseId = courseMap.get("IT")!;

  // 2. Resolve Semesters
  const { data: semesters } = await supabase.from("semesters").select("id, semester_number, course_id");
  function getSemId(courseId: string, semNum: number): string {
    const s = semesters?.find((x: any) => x.course_id === courseId && x.semester_number === semNum);
    if (!s) throw new Error(`Semester S${semNum} not found for course ${courseId}`);
    return s.id;
  }

  const aimlS1 = getSemId(aimlCourseId, 1);
  const csdsS1 = getSemId(csdsCourseId, 1);
  const csdsS3 = getSemId(csdsCourseId, 3);
  const csdsS5 = getSemId(csdsCourseId, 5);
  const itS1 = getSemId(itCourseId, 1);
  const itS3 = getSemId(itCourseId, 3);
  const itS5 = getSemId(itCourseId, 5);
  const itS7 = getSemId(itCourseId, 7);

  // 3. Resolve / Split Sections
  const { data: existingSections } = await supabase.from("sections").select("id, name, course_id, semester_id");
  
  // Section CS vs DS split
  let csS5SecId = "c6f2e418-3696-44a6-83d0-c92c356f6d40";
  let dsS5SecId = "";

  // Update Section A -> Section CS
  await supabase.from("sections").update({ name: "Section CS" }).eq("id", csS5SecId);
  console.log(`Updated CS/DS S5 Section A to "Section CS" (${csS5SecId})`);

  // Check if Section DS exists
  const existingDs = existingSections?.find((s: any) => s.course_id === csdsCourseId && s.semester_id === csdsS5 && s.name === "Section DS");
  if (existingDs) {
    dsS5SecId = existingDs.id;
    console.log(`Found existing Section DS (${dsS5SecId})`);
  } else {
    const { data: newSec, error: nsErr } = await supabase.from("sections").insert({
      institution_id: instId,
      course_id: csdsCourseId,
      semester_id: csdsS5,
      name: "Section DS",
    }).select().single();
    if (nsErr || !newSec) throw new Error(`Failed to create Section DS: ${nsErr?.message}`);
    dsS5SecId = newSec.id;
    console.log(`Created new Section DS (${dsS5SecId})`);
  }

  // Section ID dictionary
  const secMap = {
    aimlS1A: "8e972684-3e7e-4d1a-81a1-dd60102a75ea",
    aimlS1B: "ef89aee5-9f09-4a54-bcbb-c8a73185bece",
    csdsS1A: "b2c591d0-1ab2-4485-8b49-42fc94ddd178",
    csdsS3A: "0c49b870-edfd-4a25-8959-eb3ef49c0e86",
    csdsS5CS: csS5SecId,
    csdsS5DS: dsS5SecId,
    itS1A: "998c0f1c-1110-41fc-98b8-bfbe2491cd39",
    itS3A: "5d313147-2984-4e4e-875f-fe1ec70a7b7a",
    itS5A: "927917cb-4b6c-4995-b8d6-de9eda9d7438",
    itS7A: "d6f40b7a-052d-459a-b4bc-e5c4144ff302",
  };

  // 4. Define Subjects to Insert
  interface SubjectDef {
    courseId: string;
    semesterId: string;
    code: string;
    name: string;
    type: "theory" | "practical";
    weeklyHours: number;
  }

  const SUBJECT_DEFS: SubjectDef[] = [
    // --- AI/ML Semester 1 ---
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML101", name: "Programming in C", type: "theory", weeklyHours: 3 },
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML101P", name: "Programming in C Lab", type: "practical", weeklyHours: 2 },
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML102", name: "Web Development", type: "theory", weeklyHours: 3 },
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML102P", name: "Web Development Lab", type: "practical", weeklyHours: 2 },
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML103", name: "Indian Ethos & Management (IEM)", type: "theory", weeklyHours: 3 },
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML104", name: "Artificial Intelligence", type: "theory", weeklyHours: 3 },
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML105", name: "Applied Physics (AP)", type: "theory", weeklyHours: 3 },
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML106", name: "Human Values & Professional Ethics (HVPE)", type: "theory", weeklyHours: 2 },
    { courseId: aimlCourseId, semesterId: aimlS1, code: "AIML107", name: "Environmental Studies (ENP)", type: "theory", weeklyHours: 2 },

    // --- CS/DS Semester 1 ---
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS101", name: "Programming in C", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS101P", name: "Programming in C Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS102", name: "Web Development", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS102P", name: "Web Development Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS103", name: "Introduction to Cyber Security (ICS)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS104", name: "Introduction to Data Science (IDS)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS105", name: "Indian Ethos & Management (IEM)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS106", name: "Applied Physics (AP)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS107", name: "Human Values & Professional Ethics (HVPE)", type: "theory", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS1, code: "CSDS108", name: "Environmental Studies (ENP)", type: "theory", weeklyHours: 2 },

    // --- CS/DS Semester 3 ---
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS301", name: "Indian Economy & Policy (IEP)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS302", name: "Software Architecture & Quality Testing (SAQT)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS303", name: "Aptitude Training (APT)", type: "theory", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS304", name: "Java Programming", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS304P", name: "Java Programming Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS305", name: "Digital Communication (DC)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS305P", name: "Digital Communication Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS306", name: "Soft Skills (SS)", type: "theory", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS307", name: "Web Application Security (WAS)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS308", name: "Digital Logic (DL)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS309", name: "Environmental Science (EVS)", type: "theory", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS3, code: "CSDS310", name: "Open Source Technologies (OPS)", type: "theory", weeklyHours: 2 },

    // --- CS Semester 5 ---
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS501_CS", name: "Database Management Systems (DBMS)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS501P_CS", name: "DBMS Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS502_CS", name: "Artificial Intelligence (AI)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS502P_CS", name: "AI Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS503_CS", name: "Mathematics for Computing (MFC)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS504_CS", name: "Computer Networks (CN)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS504P_CS", name: "Computer Networks Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS505_CS", name: "Soft Skills (SS)", type: "theory", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS506_CS", name: "Python Programming", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS506P_CS", name: "Python Programming Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS507_CS", name: "Formal Languages & Automata Theory (FLAT)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "CS508_CS", name: "Aptitude Training (APT)", type: "theory", weeklyHours: 2 },

    // --- DS Semester 5 ---
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS501_DS", name: "Database Management Systems (DBMS)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS501P_DS", name: "DBMS Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS502_DS", name: "Artificial Intelligence (AI)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS502P_DS", name: "AI Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS503_DS", name: "Statistical Computing with R (SCTR)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS503P_DS", name: "SCTR Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS504_DS", name: "Formal Languages & Automata Theory (FLAT)", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS505_DS", name: "Soft Skills (SS)", type: "theory", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS506_DS", name: "Python Programming", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS506P_DS", name: "Python Programming Lab", type: "practical", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS507_DS", name: "Aptitude Training (APT)", type: "theory", weeklyHours: 2 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS508_DS", name: "Java Programming", type: "theory", weeklyHours: 3 },
    { courseId: csdsCourseId, semesterId: csdsS5, code: "DS508P_DS", name: "Java Programming Lab", type: "practical", weeklyHours: 2 },

    // --- IT Semester 3 ---
    { courseId: itCourseId, semesterId: itS3, code: "IT301", name: "Data Structures (DS)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS3, code: "IT301P", name: "Data Structures Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS3, code: "IT302", name: "Business Intelligence (BI)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS3, code: "IT303", name: "Java Programming", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS3, code: "IT303P", name: "Java Programming Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS3, code: "IT304", name: "Internet of Things (IOT)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS3, code: "IT305", name: "Digital Communication (DC)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS3, code: "IT305P", name: "Digital Communication Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS3, code: "IT306", name: "Indian Economy & Policy (IEP)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS3, code: "IT307", name: "Aptitude Training (APT)", type: "theory", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS3, code: "IT308", name: "Software Architecture & Quality Testing (SAQT)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS3, code: "IT309", name: "Soft Skills (SS)", type: "theory", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS3, code: "IT310", name: "Web Application Security (WAS)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS3, code: "IT311", name: "Environmental Science (EVS)", type: "theory", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS3, code: "IT312", name: "Open Source Technologies (OPS)", type: "theory", weeklyHours: 2 },

    // --- IT Semester 5 ---
    { courseId: itCourseId, semesterId: itS5, code: "IT501", name: "Java Programming", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS5, code: "IT501P", name: "Java Programming Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS5, code: "IT502", name: "Software Engineering (SE)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS5, code: "IT502P", name: "Software Engineering Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS5, code: "IT503", name: "Artificial Intelligence (AI)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS5, code: "IT503P", name: "Artificial Intelligence Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS5, code: "IT504", name: "Formal Languages & Automata Theory (FLAT)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS5, code: "IT505", name: "Aptitude Training (APT)", type: "theory", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS5, code: "IT506", name: "Soft Skills (SS)", type: "theory", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS5, code: "IT507", name: "Database Management Systems (DBMS)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS5, code: "IT507P", name: "Database Management Systems Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS5, code: "IT508", name: "Universal Human Values (UHV)", type: "theory", weeklyHours: 3 },

    // --- IT Semester 7 ---
    { courseId: itCourseId, semesterId: itS7, code: "IT701", name: "Aptitude Training (APT)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS7, code: "IT702", name: "Mobile and Cellular Networks (MCN)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS7, code: "IT703", name: "Software Project Management (SPM)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS7, code: "IT703P", name: "Software Project Management Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS7, code: "IT704", name: "Ad-hoc and Wireless Sensor Networks (AWSN)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS7, code: "IT704P", name: "Ad-hoc and Wireless Sensor Networks Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS7, code: "IT705", name: "Software Testing & Quality Assurance (STQA)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS7, code: "IT706", name: "Soft Skills (SS)", type: "theory", weeklyHours: 3 },
    { courseId: itCourseId, semesterId: itS7, code: "IT707P", name: "Project Lab", type: "practical", weeklyHours: 2 },
    { courseId: itCourseId, semesterId: itS7, code: "IT708", name: "Non-Conventional Energy Resources (NCER)", type: "theory", weeklyHours: 3 },

    // --- IT Semester 1 (Recorded evidence from Raman Kumar / IEM) ---
    { courseId: itCourseId, semesterId: itS1, code: "IT101", name: "Indian Ethos & Management (IEM)", type: "theory", weeklyHours: 3 },
  ];

  const subjectCodeToId = new Map<string, string>();
  const { data: existingSubjects } = await supabase.from("subjects").select("id, code");
  for (const es of existingSubjects || []) {
    subjectCodeToId.set(es.code, es.id);
  }

  for (const s of SUBJECT_DEFS) {
    if (subjectCodeToId.has(s.code)) {
      continue;
    }
    const { data: insSub, error: subErr } = await supabase.from("subjects").insert({
      institution_id: instId,
      course_id: s.courseId,
      semester_id: s.semesterId,
      code: s.code,
      name: s.name,
      type: s.type,
      weekly_hours: s.weeklyHours,
      max_internal_marks: 30,
      max_midterm_marks: 20,
      max_final_marks: 50,
    }).select().single();

    if (subErr || !insSub) {
      console.error(`Failed to insert subject ${s.code}:`, subErr);
    } else {
      subjectCodeToId.set(s.code, insSub.id);
    }
  }
  console.log(`Curriculum subjects ready. Total subjects in DB: ${subjectCodeToId.size}`);

  // 5. Build Explicit Teacher Allocations Mapping
  interface AllocationReq {
    sectionId: string;
    courseId: string;
    semesterId: string;
    subjectCode: string;
    teacherName: string;
  }

  const ALLOCATION_REQS: AllocationReq[] = [
    // --- AI/ML S1 Section A ---
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML101", teacherName: "Abhishek Singh" },
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML101P", teacherName: "Abhishek Singh" },
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML102", teacherName: "Renu Bala" },
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML102P", teacherName: "Renu Bala" },
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML103", teacherName: "Raman Kumar" },
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML104", teacherName: "Robin" },
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML105", teacherName: "Neeru Jambal" },
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML106", teacherName: "Institutional Faculty (Shared)" },
    { sectionId: secMap.aimlS1A, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML107", teacherName: "Institutional Faculty (Shared)" },

    // --- AI/ML S1 Section B ---
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML101", teacherName: "Abhishek Singh" },
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML101P", teacherName: "Abhishek Singh" },
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML102", teacherName: "Priya" },
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML102P", teacherName: "Priya" },
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML103", teacherName: "Raman Kumar" },
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML104", teacherName: "Robin" },
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML105", teacherName: "Neeru Jambal" },
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML106", teacherName: "Anureet" },
    { sectionId: secMap.aimlS1B, courseId: aimlCourseId, semesterId: aimlS1, subjectCode: "AIML107", teacherName: "Institutional Faculty (Shared)" },

    // --- CS/DS S1 Section A ---
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS101", teacherName: "Ram" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS101P", teacherName: "Ram" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS102", teacherName: "Akshit Ummat" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS102P", teacherName: "Akshit Ummat" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS103", teacherName: "Omkar" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS104", teacherName: "Karan" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS105", teacherName: "Raman Kumar" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS106", teacherName: "Neeru Jambal" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS107", teacherName: "Alka Rani" },
    { sectionId: secMap.csdsS1A, courseId: csdsCourseId, semesterId: csdsS1, subjectCode: "CSDS108", teacherName: "Institutional Faculty (Shared)" },

    // --- CS/DS S3 Section A ---
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS301", teacherName: "Inderjeet Singh" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS302", teacherName: "Rupika" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS303", teacherName: "Anil Thakur" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS304", teacherName: "Rahul" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS304P", teacherName: "Rahul" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS305", teacherName: "Ritu Rani" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS305P", teacherName: "Ritu Rani" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS306", teacherName: "Maninder Kaur" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS307", teacherName: "Abhishek Singh" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS308", teacherName: "Aditya Srivastava" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS309", teacherName: "Institutional Faculty (Shared)" },
    { sectionId: secMap.csdsS3A, courseId: csdsCourseId, semesterId: csdsS3, subjectCode: "CSDS310", teacherName: "Institutional Faculty (Shared)" },

    // --- CS S5 (Section CS) ---
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS501_CS", teacherName: "Robin" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS501P_CS", teacherName: "Robin" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS502_CS", teacherName: "Chandandeep Kaur" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS502P_CS", teacherName: "Chandandeep Kaur" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS503_CS", teacherName: "Rajveer Kaur" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS504_CS", teacherName: "Chetna Saini" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS504P_CS", teacherName: "Chetna Saini" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS505_CS", teacherName: "Megha" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS506_CS", teacherName: "Syed Mohsin" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS506P_CS", teacherName: "Syed Mohsin" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS507_CS", teacherName: "Sameer Dixit" },
    { sectionId: secMap.csdsS5CS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "CS508_CS", teacherName: "Anand Parkash" },

    // --- DS S5 (Section DS) ---
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS501_DS", teacherName: "Robin" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS501P_DS", teacherName: "Robin" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS502_DS", teacherName: "Chandandeep Kaur" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS502P_DS", teacherName: "Chandandeep Kaur" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS503_DS", teacherName: "Jastej Singh" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS503P_DS", teacherName: "Jastej Singh" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS504_DS", teacherName: "Sameer Dixit" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS505_DS", teacherName: "Megha" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS506_DS", teacherName: "Syed Mohsin" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS506P_DS", teacherName: "Syed Mohsin" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS507_DS", teacherName: "Anand Parkash" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS508_DS", teacherName: "Palak Puri" },
    { sectionId: secMap.csdsS5DS, courseId: csdsCourseId, semesterId: csdsS5, subjectCode: "DS508P_DS", teacherName: "Palak Puri" },

    // --- IT S3 Section A ---
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT301", teacherName: "Omkar" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT301P", teacherName: "Omkar" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT302", teacherName: "Syed Mohsin" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT303", teacherName: "Rahul" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT303P", teacherName: "Rahul" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT304", teacherName: "Omkar" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT305", teacherName: "Rupinder Kaur" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT305P", teacherName: "Rupinder Kaur" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT306", teacherName: "Deepika" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT307", teacherName: "Anand Parkash" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT308", teacherName: "Rupika" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT309", teacherName: "Megha" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT310", teacherName: "Abhishek Singh" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT311", teacherName: "Institutional Faculty (Shared)" },
    { sectionId: secMap.itS3A, courseId: itCourseId, semesterId: itS3, subjectCode: "IT312", teacherName: "Institutional Faculty (Shared)" },

    // --- IT S5 Section A ---
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT501", teacherName: "Deepika" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT501P", teacherName: "Deepika" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT502", teacherName: "Gursharan Saini" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT502P", teacherName: "Gursharan Saini" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT503", teacherName: "Ritu Rani" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT503P", teacherName: "Ritu Rani" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT504", teacherName: "Priya" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT505", teacherName: "Anand Parkash" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT506", teacherName: "Megha" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT507", teacherName: "Karan" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT507P", teacherName: "Karan" },
    { sectionId: secMap.itS5A, courseId: itCourseId, semesterId: itS5, subjectCode: "IT508", teacherName: "Institutional Faculty (Shared)" },

    // --- IT S7 Section A ---
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT701", teacherName: "Anand Parkash" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT702", teacherName: "Rupinder Kaur" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT703", teacherName: "Inderjeet Singh" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT703P", teacherName: "Inderjeet Singh" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT704", teacherName: "Renu Bala" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT704P", teacherName: "Renu Bala" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT705", teacherName: "Rahul" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT706", teacherName: "Megha" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT707P", teacherName: "Supinder Kaur" },
    { sectionId: secMap.itS7A, courseId: itCourseId, semesterId: itS7, subjectCode: "IT708", teacherName: "Institutional Faculty (Shared)" },

    // --- IT S1 Section A (Recorded Raman Kumar / IEM evidence) ---
    { sectionId: secMap.itS1A, courseId: itCourseId, semesterId: itS1, subjectCode: "IT101", teacherName: "Raman Kumar" },
  ];

  // Insert allocations
  let insertedCount = 0;
  for (const req of ALLOCATION_REQS) {
    const subId = subjectCodeToId.get(req.subjectCode);
    if (!subId) {
      console.error(`Subject code ${req.subjectCode} not found in map!`);
      continue;
    }
    const tId = getTeacherId(req.teacherName);

    // Check if allocation already exists
    const { data: existing } = await supabase
      .from("teacher_subjects")
      .select("id")
      .eq("section_id", req.sectionId)
      .eq("subject_id", subId)
      .maybeSingle();

    if (!existing) {
      const { error: insErr } = await supabase.from("teacher_subjects").insert({
        institution_id: instId,
        teacher_id: tId,
        course_id: req.courseId,
        semester_id: req.semesterId,
        section_id: req.sectionId,
        subject_id: subId,
      });
      if (insErr) {
        console.error(`Failed to allocate ${req.subjectCode} to ${req.teacherName}:`, insErr);
      } else {
        insertedCount++;
      }
    }
  }

  console.log(`\n================================================================================`);
  console.log(`IMPORT COMPLETE: Successfully inserted ${insertedCount} teacher_subjects allocations.`);
  console.log(`================================================================================\n`);
}

runImport().catch(console.error);
