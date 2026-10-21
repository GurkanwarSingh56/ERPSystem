/**
 * scripts/test-phase19-2-portal-data.ts
 *
 * Comprehensive End-to-End Verification Suite for Phase 19.2:
 * 1. Issue A: Teacher & Student Timetable Data Visibility
 *    - Student 24CSE051 (Section B, CSE Sem 5) sees published timetable with all entries
 *    - Teacher FAC106 (Er. Chetna Saini) sees published weekly teaching periods
 *    - Timetable publication workflow validates allocations, conflicts, boundaries, versions
 * 2. Issue B: Teacher FAC106 Assigned Cohorts
 *    - getTeacherAllocationsAction returns all genuine allocations with resolved courses/semesters
 *    - Attendance roster is accessible for authorized cohorts
 * 3. Issue C: Attendance History PostgREST Relationship
 *    - Querying attendance history with fk_attendance_section executes cleanly with 0 errors
 */

import { createClient } from "@supabase/supabase-js";
import { getTeacherAllocationsAction, getAttendanceSessionAction } from "../src/app/actions/attendance";
import { publishTimetableAction } from "../src/app/actions/timetable";

const LOCAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const adminClient = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`);
  }
}

async function getAuthTokenForUser(email: string): Promise<string> {
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.email_otp) {
    throw new Error(`Failed to generate magic link for ${email}: ${linkErr?.message}`);
  }
  const { data: sessionData, error: sessionErr } = await anonClient.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (sessionErr || !sessionData.session) {
    throw new Error(`Failed to verify OTP for ${email}: ${sessionErr?.message}`);
  }
  return sessionData.session.access_token;
}

async function runVerification() {
  console.log("\n=======================================================");
  console.log("   PHASE 19.2: PORTAL REAL DATA & INTEGRITY VERIFICATION ");
  console.log("=======================================================\n");

  // =========================================================================
  // TEST SECTION 1: Issue B — Teacher FAC106 Assigned Cohorts
  // =========================================================================
  console.log("[1] Testing Issue B: Teacher FAC106 (Er. Chetna Saini) Assigned Cohorts...");

  const { data: chetnaProf } = await adminClient
    .from("profiles")
    .select("id, login_id, email, full_name, institution_id")
    .eq("login_id", "FAC106")
    .single();

  assert(!!chetnaProf, "Found canonical profile for FAC106", chetnaProf?.full_name);
  assert(chetnaProf?.full_name === "Er. Chetna Saini", "FAC106 profile full name matches Er. Chetna Saini");

  const { data: chetnaTeacher } = await adminClient
    .from("teachers")
    .select("id, employee_id, department_id")
    .eq("id", chetnaProf!.id)
    .single();

  assert(!!chetnaTeacher && chetnaTeacher.id === chetnaProf!.id, "Canonical 1:1 teacher record verified for FAC106");

  // Get session token for Chetna Saini
  const chetnaToken = await getAuthTokenForUser(chetnaProf!.email);
  process.env.TEST_AUTH_TOKEN = chetnaToken;

  const allocRes = await getTeacherAllocationsAction();
  assert(allocRes.success === true, "getTeacherAllocationsAction succeeded without relationship error");
  assert((allocRes.data || []).length === 6, `getTeacherAllocationsAction returned all 6 assigned cohorts (got ${allocRes.data?.length})`);

  const secBAlloc = allocRes.data?.find((a) => a.sectionName === "Section B" && a.subjectCode === "CS504");
  assert(!!secBAlloc, "Found Computer Networks (CS504) allocation for Section B");
  assert(secBAlloc?.courseCode === "CSE", "Allocation course code resolved to CSE");
  assert(secBAlloc?.semesterNumber === 5, "Allocation semester number resolved to 5");

  // Verify attendance roster access for her allocated section
  const rosterRes = await getAttendanceSessionAction({
    sectionId: secBAlloc!.sectionId,
    subjectId: secBAlloc!.subjectId,
    date: "2026-10-21",
    periodNumber: 1,
  });
  assert(rosterRes.success === true, "Teacher can access attendance roster for allocated section");
  assert((rosterRes.data?.roster || []).length > 0, `Roster returned students for Section B (count: ${rosterRes.data?.roster?.length})`);

  // =========================================================================
  // TEST SECTION 2: Issue C — Attendance History PostgREST Relationship
  // =========================================================================
  console.log("\n[2] Testing Issue C: Attendance History PostgREST Relationship Query...");

  const userClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${chetnaToken}` } },
  });

  const { data: historyData, error: historyErr } = await userClient
    .from("attendance")
    .select(`
      id,
      date,
      period_number,
      status,
      remarks,
      student_id,
      students!fk_attendance_student_section (
        roll_number,
        profiles (full_name)
      ),
      subjects (
        name,
        code
      ),
      sections!fk_attendance_section (
        name
      )
    `)
    .limit(5);

  assert(!historyErr, "Attendance history query executed without schema cache error", historyErr?.message);
  assert(historyData !== null, "Attendance history returned data array");

  // =========================================================================
  // TEST SECTION 3: Issue A — Publication Workflow & Pre-Publication Validation
  // =========================================================================
  console.log("\n[3] Testing Issue A: Admin Timetable Publication Workflow & Validation...");

  // Verify that an invalid timetable ID is safely rejected
  const badPubRes = await publishTimetableAction("00000000-0000-0000-0000-000000000000");
  assert(badPubRes.success === false, "Publishing nonexistent timetable ID returns failure");

  // Verify that attempting to publish an already published timetable returns friendly rejection
  const republishRes = await publishTimetableAction("95600e35-90c3-45fb-af1b-0abf685b6154");
  assert(
    republishRes.success === false && Boolean(republishRes.error?.includes("already published")),
    "Republishing already published timetable is idempotently rejected"
  );

  // Check database status for published Section B and Section A timetables
  const { data: tB } = await adminClient
    .from("timetables")
    .select("id, status, version, published_at")
    .eq("id", "95600e35-90c3-45fb-af1b-0abf685b6154")
    .single();

  assert(tB?.status === "published", "Section B timetable status is published");
  assert(!!tB?.published_at, "Section B published_at timestamp is set");

  const { data: tA } = await adminClient
    .from("timetables")
    .select("id, status, version, published_at")
    .eq("id", "32277b78-2cb2-41eb-b68f-06e21a0c7532")
    .single();

  assert(tA?.status === "published", "Section A timetable status is published");

  // =========================================================================
  // TEST SECTION 4: Issue A — Teacher Portal Timetable Visibility
  // =========================================================================
  console.log("\n[4] Testing Issue A: Teacher Timetable Portal Data Display...");

  // Query as Er. Chetna Saini using the exact teacher timetable page query
  const { data: teacherEntries, error: teErr } = await userClient
    .from("timetable_entries")
    .select(`
      id,
      day_of_week,
      slot_number,
      room_number,
      subjects (id, name, code, type),
      timetables!inner (
        id,
        status,
        academic_year,
        sections (name)
      )
    `)
    .eq("teacher_id", chetnaProf!.id)
    .eq("timetables.status", "published");

  assert(!teErr, "Teacher timetable query succeeded without error", teErr?.message);
  assert((teacherEntries || []).length === 10, `Teacher portal displays all 10 published weekly periods across Sem 5 Sec A & B (got ${teacherEntries?.length})`);

  const daysCovered = new Set((teacherEntries || []).map((e: any) => e.day_of_week));
  assert(daysCovered.has("monday") && daysCovered.has("friday"), "Teacher schedule covers multiple weekly teaching days");

  // =========================================================================
  // TEST SECTION 5: Issue A — Student Portal Timetable Visibility
  // =========================================================================
  console.log("\n[5] Testing Issue A: Student 24CSE051 Timetable Portal Data Display...");

  // Verify Student 24CSE051 identity
  const { data: stuProf } = await adminClient
    .from("profiles")
    .select("id, login_id, email, full_name")
    .eq("login_id", "24CSE051")
    .single();

  assert(!!stuProf, "Found student profile for 24CSE051", stuProf?.full_name);

  const { data: stuRecord } = await adminClient
    .from("students")
    .select("id, section_id, semester_id, sections(name), courses(code, name)")
    .eq("id", stuProf!.id)
    .single();

  const { data: semRecord } = await adminClient
    .from("semesters")
    .select("semester_number")
    .eq("id", stuRecord?.semester_id)
    .single();

  assert(!!stuRecord, "Found student record for 24CSE051");
  assert((stuRecord?.sections as any)?.name === "Section B", "Student enrolled in Section B");
  assert((stuRecord?.courses as any)?.code === "CSE", "Student course is CSE");
  assert(semRecord?.semester_number === 5, "Student semester is 5");

  // Get session token for Student 24CSE051
  const studentToken = await getAuthTokenForUser(stuProf!.email);
  const studentClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${studentToken}` } },
  });

  // Query exact student timetable query
  const { data: studentTimetable } = await studentClient
    .from("timetables")
    .select("id, title, academic_year, version")
    .eq("section_id", stuRecord!.section_id)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  assert(!!studentTimetable, "Student portal finds active published timetable for Section B");

  const { data: stuEntries, error: seErr } = await studentClient
    .from("timetable_entries")
    .select(`
      id,
      day_of_week,
      slot_number,
      room_number,
      subjects (id, name, code, type),
      teachers (
        profiles (full_name)
      )
    `)
    .eq("timetable_id", studentTimetable!.id);

  assert(!seErr, "Student timetable entries query succeeded", seErr?.message);
  assert((stuEntries || []).length === 34, `Student portal displays all 34 scheduled classes for Section B (got ${stuEntries?.length})`);

  // Verify presence of Er. Chetna Saini's Computer Networks class in student's schedule
  const cnClass = (stuEntries || []).find(
    (e: any) =>
      e.subjects?.code === "CN_S5" &&
      e.teachers?.profiles?.full_name === "Er. Chetna Saini"
  );
  assert(!!cnClass, "Student schedule contains Computer Networks taught by Er. Chetna Saini");

  console.log("\n=======================================================");
  console.log(`  VERIFICATION COMPLETE: ${passed} / ${total} TESTS PASSED`);
  console.log("=======================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("FATAL in verification runner:", err);
  process.exit(1);
});
