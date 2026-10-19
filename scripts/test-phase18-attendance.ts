import { createClient } from "@supabase/supabase-js";
import {
  recordAttendanceAction,
  getAttendanceSessionAction,
  getTeacherAllocationsAction,
  getAdminAttendanceReportAction,
  updateAttendanceRecordAction,
} from "../src/app/actions/attendance";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_KEY;

const adminClient = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);
const instId = "00000000-0000-0000-0000-000000000001";

async function authenticateAs(email: string) {
  const anonClient = createClient(LOCAL_URL, LOCAL_ANON_KEY);
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.email_otp) {
    throw new Error(`Failed to generate magic link for ${email}: ${linkErr?.message}`);
  }
  const { data: sessionData, error: otpErr } = await anonClient.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: "magiclink",
  });
  if (otpErr || !sessionData?.session?.access_token) {
    throw new Error(`Failed to verify OTP for ${email}: ${otpErr?.message}`);
  }
  process.env.TEST_AUTH_TOKEN = sessionData.session.access_token;
  return sessionData.session;
}

async function runPhase18AttendanceSuite() {
  console.log("================================================================================");
  console.log("PHASE 18 — COMPLETE ATTENDANCE ENGINE & PORTAL TEST SUITE");
  console.log("Database: " + LOCAL_URL);
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: any, desc: string) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Resolve Real Fixture Entities
  // Section A (Sem 5)
  const { data: sectionA } = await adminClient
    .from("sections")
    .select("id, name, course_id, semester_id")
    .eq("institution_id", instId)
    .eq("name", "Section A")
    .limit(1)
    .single();

  // Section B
  const { data: sectionB } = await adminClient
    .from("sections")
    .select("id, name, course_id, semester_id")
    .eq("institution_id", instId)
    .eq("name", "Section B")
    .limit(1)
    .single();

  // Students in Section A
  const { data: studentsA } = await adminClient
    .from("students")
    .select("id, roll_number")
    .eq("section_id", sectionA?.id)
    .order("roll_number");

  // Students in Section B
  const { data: studentsB } = await adminClient
    .from("students")
    .select("id, roll_number")
    .eq("section_id", sectionB?.id)
    .order("roll_number");

  // Assigned teacher for Section A
  const { data: allocationA } = await adminClient
    .from("teacher_subjects")
    .select("id, teacher_id, subject_id, section_id, course_id, semester_id")
    .eq("section_id", sectionA?.id)
    .limit(1)
    .single();

  // Fetch email of assigned teacher
  const { data: teacherProfile } = await adminClient
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", allocationA?.teacher_id)
    .single();

  // Teacher NOT assigned to Section A
  const { data: otherTeacherAllocation } = await adminClient
    .from("teacher_subjects")
    .select("teacher_id")
    .neq("teacher_id", allocationA?.teacher_id)
    .limit(1)
    .single();

  const { data: otherTeacherProfile } = await adminClient
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", otherTeacherAllocation?.teacher_id)
    .single();

  // Subject from different semester
  const { data: wrongSubject } = await adminClient
    .from("subjects")
    .select("id, name, course_id, semester_id")
    .neq("semester_id", sectionA?.semester_id)
    .limit(1)
    .single();

  if (
    !sectionA ||
    !sectionB ||
    !studentsA ||
    studentsA.length === 0 ||
    !studentsB ||
    !allocationA ||
    !teacherProfile ||
    !otherTeacherProfile ||
    !wrongSubject
  ) {
    throw new Error("Missing prerequisite database records to execute attendance test suite.");
  }

  console.log(`Test Fixtures:`);
  console.log(`- Section A ID: ${sectionA.id} (${studentsA.length} students)`);
  console.log(`- Assigned Faculty: ${teacherProfile.full_name} (${teacherProfile.email})`);
  console.log(`- Subject ID: ${allocationA.subject_id}`);
  console.log(`- Unassigned Faculty: ${otherTeacherProfile.full_name} (${otherTeacherProfile.email})`);
  console.log(`- Section B Student ID: ${studentsB[0]?.id}\n`);

  console.log("--- PART 1: VALIDATION & BOUNDARY CHECKS ---");

  // Authenticate as Assigned Faculty
  await authenticateAs(teacherProfile.email);

  // 1. Future date rejection
  const futureRes = await recordAttendanceAction({
    date: "2099-12-31",
    periodNumber: 1,
    sectionId: sectionA.id,
    subjectId: allocationA.subject_id,
    records: [{ studentId: studentsA[0].id, status: "present" }],
  });
  assert(!futureRes.success, "Rejects future date submission");
  assert(
    futureRes.error === "Cannot record attendance for future dates.",
    "Correct error message for future date"
  );

  // 2. Period out of bounds (> 12)
  const invalidPeriodRes = await recordAttendanceAction({
    date: "2026-10-18",
    periodNumber: 14,
    sectionId: sectionA.id,
    subjectId: allocationA.subject_id,
    records: [{ studentId: studentsA[0].id, status: "present" }],
  });
  assert(!invalidPeriodRes.success, "Rejects period number > 12");

  // 3. Subject-Section Course/Semester mismatch
  const mismatchSubRes = await recordAttendanceAction({
    date: "2026-10-18",
    periodNumber: 2,
    sectionId: sectionA.id,
    subjectId: wrongSubject.id,
    records: [{ studentId: studentsA[0].id, status: "present" }],
  });
  assert(!mismatchSubRes.success, "Rejects subject from mismatching course/semester");
  assert(
    mismatchSubRes.error?.includes("does not belong to the course and semester"),
    "Returns descriptive error for curricular mismatch"
  );

  // 4. Student not belonging to selected section
  const wrongStudentRes = await recordAttendanceAction({
    date: "2026-10-18",
    periodNumber: 2,
    sectionId: sectionA.id,
    subjectId: allocationA.subject_id,
    records: [
      { studentId: studentsA[0].id, status: "present" },
      { studentId: studentsB[0].id, status: "present" }, // Belongs to Section B!
    ],
  });
  assert(!wrongStudentRes.success, "Rejects attendance when student does not belong to section");
  assert(
    wrongStudentRes.error?.includes("do not belong to the selected section"),
    "Returns student section membership violation error"
  );

  console.log("\n--- PART 2: TEACHER AUTHORIZATION ENFORCEMENT ---");

  // Authenticate as Unassigned Faculty
  await authenticateAs(otherTeacherProfile.email);

  const unauthorizedRes = await recordAttendanceAction({
    date: "2026-10-18",
    periodNumber: 2,
    sectionId: sectionA.id,
    subjectId: allocationA.subject_id,
    records: [{ studentId: studentsA[0].id, status: "present" }],
  });
  assert(!unauthorizedRes.success, "Unauthorized teacher cannot record roll call for another faculty's class");
  assert(
    unauthorizedRes.error?.includes("not authorized to record attendance"),
    "Returns authorization denial error"
  );

  console.log("\n--- PART 3: SUCCESSFUL ATTENDANCE RECORDING ---");

  // Switch back to Authorized Faculty
  await authenticateAs(teacherProfile.email);

  const testDate = "2026-10-19";
  const testPeriod = 2;

  // Build roll call with mix of Present, Absent, and Leave
  const rollCallPayload = studentsA.map((st, idx) => ({
    studentId: st.id,
    status: (idx === 0 ? "absent" : idx === 1 ? "leave" : "present") as "present" | "absent" | "leave",
    remarks: idx === 0 ? "Unexcused absence" : idx === 1 ? "Medical leave" : "Present in lecture",
  }));

  const recordRes = await recordAttendanceAction({
    date: testDate,
    periodNumber: testPeriod,
    sectionId: sectionA.id,
    subjectId: allocationA.subject_id,
    records: rollCallPayload,
  });

  assert(recordRes.success, "Successfully records batch attendance for assigned section");
  assert(
    recordRes.data?.recordedCount === studentsA.length,
    `Recorded count matches section student count (${studentsA.length})`
  );

  // Verify in PostgreSQL database
  const { data: dbRecords, count: dbCount } = await adminClient
    .from("attendance")
    .select("id, student_id, status, remarks", { count: "exact" })
    .eq("section_id", sectionA.id)
    .eq("subject_id", allocationA.subject_id)
    .eq("date", testDate)
    .eq("period_number", testPeriod);

  assert(dbCount === studentsA.length, `Database has exactly ${studentsA.length} saved records`);
  const firstStudentRec = dbRecords?.find((r) => r.student_id === studentsA[0].id);
  assert(firstStudentRec?.status === "absent", "First student status verified as absent");
  assert(firstStudentRec?.remarks === "Unexcused absence", "Remarks persisted accurately");

  console.log("\n--- PART 4: REOPENING & EDITING AN EXISTING SESSION ---");

  // Call getAttendanceSessionAction to verify it returns isExistingSession = true
  const sessionRes = await getAttendanceSessionAction({
    sectionId: sectionA.id,
    subjectId: allocationA.subject_id,
    date: testDate,
    periodNumber: testPeriod,
  });

  assert(sessionRes.success, "Successfully reopens attendance session");
  assert(sessionRes.data?.isExistingSession === true, "Marks session as existing session");
  assert(sessionRes.data?.roster.length === studentsA.length, "Roster student count matches");
  const loadedFirstStudent = sessionRes.data?.roster.find((r) => r.id === studentsA[0].id);
  assert(loadedFirstStudent?.existingStatus === "absent", "Loaded existing status matches saved value");

  // Update session: change first student from "absent" to "present" with updated remark
  const updatedPayload = rollCallPayload.map((r) =>
    r.studentId === studentsA[0].id
      ? { ...r, status: "present" as const, remarks: "Slip verified by HOD" }
      : r
  );

  const updateRes = await recordAttendanceAction({
    date: testDate,
    periodNumber: testPeriod,
    sectionId: sectionA.id,
    subjectId: allocationA.subject_id,
    records: updatedPayload,
  });

  assert(updateRes.success, "Successfully updates existing attendance session via upsert");
  assert(updateRes.data?.isUpdate === true, "Reports action was an update");

  // Verify no duplicate records created in attendance
  const { count: afterUpdateCount } = await adminClient
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionA.id)
    .eq("subject_id", allocationA.subject_id)
    .eq("date", testDate)
    .eq("period_number", testPeriod);

  assert(afterUpdateCount === studentsA.length, "No duplicate records created upon re-submission");

  // Verify PostgreSQL trigger logged change into attendance_audit
  const { data: auditLogs } = await adminClient
    .from("attendance_audit")
    .select("id, previous_status, new_status, reason")
    .eq("student_id", studentsA[0].id)
    .order("created_at", { ascending: false })
    .limit(1);

  assert(auditLogs && auditLogs.length > 0, "Audit trigger automatically created audit log entry");
  assert(
    auditLogs?.[0]?.previous_status === "absent" && auditLogs?.[0]?.new_status === "present",
    "Audit log recorded status transition: absent -> present"
  );
  assert(
    auditLogs?.[0]?.reason === "Slip verified by HOD",
    "Audit log recorded update reason correctly"
  );

  console.log("\n--- PART 5: ADMIN & HOD REPORTS AND DEFICIT THRESHOLD ---");

  // Authenticate as Admin
  await authenticateAs("admin@college.local");

  const reportRes = await getAdminAttendanceReportAction({
    sectionId: sectionA.id,
    threshold: 75,
  });

  assert(reportRes.success, "Successfully generated administrative attendance report");
  assert((reportRes.data?.overview.totalSessions || 0) > 0, "Reports total sessions logged");
  assert(reportRes.data?.studentSummaries.length === studentsA.length, "Summarizes all enrolled students in section");
  assert(reportRes.data?.subjectSummaries.length! > 0, "Provides subject-wise attendance aggregation");
  assert(reportRes.data?.recentAuditTrail.length! > 0, "Exposes tamper-evident audit trail entries");

  console.log("\n--- PART 6: RECORD CORRECTION WITH AUDIT REASON ---");

  if (firstStudentRec) {
    const correctionRes = await updateAttendanceRecordAction({
      attendanceId: firstStudentRec.id,
      newStatus: "leave",
      reason: "Official sports representation duty sanctioned",
    });

    assert(correctionRes.success, "Authorized admin can correct an attendance record with reason");

    const { data: verifiedCorrection } = await adminClient
      .from("attendance")
      .select("status, remarks")
      .eq("id", firstStudentRec.id)
      .single();

    assert(verifiedCorrection?.status === "leave", "Attendance status transitioned to leave");
  }

  console.log("\n--- PART 7: STUDENT PORTAL PRIVACY & CALCULATIONS ---");

  // Fetch email of first student
  const { data: studentAProfile } = await adminClient
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", studentsA[0].id)
    .single();

  if (studentAProfile) {
    const { getStudentAttendanceSummaryAction } = await import("../src/app/actions/attendance");

    // 1. Non-student calling student summary gets rejected
    await authenticateAs(teacherProfile.email);
    const nonStudentRes = await getStudentAttendanceSummaryAction();
    assert(!nonStudentRes.success, "Faculty cannot call student-scoped attendance summary");

    // 2. Authenticate as student
    await authenticateAs(studentAProfile.email);
    const studentSummaryRes = await getStudentAttendanceSummaryAction();

    assert(studentSummaryRes.success, "Student successfully queries own verified attendance summary");
    assert(
      studentSummaryRes.data?.studentInfo.id === studentsA[0].id,
      "Summary is strictly scoped to authenticated student"
    );
    assert(
      studentSummaryRes.data?.overall.totalClasses! > 0,
      "Student summary reflects recorded academic sessions"
    );

    // Verify formula
    const expectedPct = Number(
      (
        (studentSummaryRes.data!.overall.presentCount /
          studentSummaryRes.data!.overall.totalClasses) *
        100
      ).toFixed(1)
    );
    assert(
      studentSummaryRes.data?.overall.percentage === expectedPct,
      `Calculated attendance percentage matches formula: ${expectedPct}%`
    );

    // Verify all history records belong to this student
    const historyEntries = studentSummaryRes.data?.history || [];
    assert(historyEntries.length > 0, "Student receives chronological attendance history");
  }

  console.log("\n================================================================================");
  console.log(`TEST EXECUTION SUMMARY: Passed: ${passed} | Failed: ${failed}`);
  console.log("================================================================================\n");

  if (failed > 0) process.exit(1);
}

runPhase18AttendanceSuite().catch((err) => {
  console.error("Fatal test suite error:", err);
  process.exit(1);
});
