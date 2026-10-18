import { createClient } from "@supabase/supabase-js";
import { recordAttendanceAction } from "../src/app/actions/attendance";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Populate environment for local action execution
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_KEY;

const client = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);
const instId = "00000000-0000-0000-0000-000000000001";

async function runAttendanceEngineTests() {
  console.log("================================================================================");
  console.log("CORE ERP ATTENDANCE ENGINE TEST SUITE");
  console.log("Target Database: " + LOCAL_URL + " (LOCAL SUPABASE)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  // Authenticate as admin to set valid auth.uid() context for attendance audit triggers
  const anonClient = createClient(LOCAL_URL, LOCAL_ANON_KEY);
  const { data: linkData } = await client.auth.admin.generateLink({
    type: "magiclink",
    email: "admin@college.local",
  });
  const otp = linkData?.properties?.email_otp || "";
  const { data: sessionData } = await anonClient.auth.verifyOtp({
    email: "admin@college.local",
    token: otp,
    type: "magiclink",
  });
  if (sessionData?.session?.access_token) {
    process.env.TEST_AUTH_TOKEN = sessionData.session.access_token;
  }

  // 1. Fetch a real section, subject, and student
  const { data: section } = await client
    .from("sections")
    .select("id, name")
    .eq("institution_id", instId)
    .limit(1)
    .single();

  const { data: subject } = await client
    .from("subjects")
    .select("id, name, code")
    .eq("institution_id", instId)
    .limit(1)
    .single();

  const { data: student } = await client
    .from("students")
    .select("id, roll_number")
    .eq("institution_id", instId)
    .limit(1)
    .single();

  if (!section || !subject || !student) {
    throw new Error("Missing required fixture data in local database.");
  }

  console.log("--- PART 1: SCHEMA & CONSTRAINT VALIDATIONS ---");
  // Test invalid period (> 12)
  const resInvalidPeriod = await recordAttendanceAction({
    date: "2026-10-18",
    periodNumber: 15,
    sectionId: section.id,
    subjectId: subject.id,
    records: [{ studentId: student.id, status: "present" }],
  });
  assert(!resInvalidPeriod.success, "Rejects period number greater than 12");
  assert(!!resInvalidPeriod.fieldErrors?.periodNumber, "Reports field error on periodNumber");

  // Test invalid date format
  const resInvalidDate = await recordAttendanceAction({
    date: "18-10-2026",
    periodNumber: 1,
    sectionId: section.id,
    subjectId: subject.id,
    records: [{ studentId: student.id, status: "present" }],
  });
  assert(!resInvalidDate.success, "Rejects invalid date format (non-YYYY-MM-DD)");

  // Test empty records array
  const resEmptyRecords = await recordAttendanceAction({
    date: "2026-10-18",
    periodNumber: 1,
    sectionId: section.id,
    subjectId: subject.id,
    records: [],
  });
  assert(!resEmptyRecords.success, "Rejects empty student attendance records array");

  console.log("\n--- PART 2: SUCCESSFUL ATTENDANCE RECORDING & UPSERT ---");
  const testDate = "2026-10-18";
  const testPeriod = 1;

  // Insert roll call
  const resRecord = await recordAttendanceAction({
    date: testDate,
    periodNumber: testPeriod,
    sectionId: section.id,
    subjectId: subject.id,
    records: [{ studentId: student.id, status: "present", remarks: "On time" }],
  });
  assert(resRecord.success, "Successfully records attendance session for student");
  assert(resRecord.data?.recordedCount === 1, "Recorded count matches expected entries (1)");

  // Verify in database
  const { data: dbEntry } = await client
    .from("attendance")
    .select("id, status, remarks, period_number")
    .eq("student_id", student.id)
    .eq("date", testDate)
    .eq("period_number", testPeriod)
    .single();

  assert(dbEntry?.status === "present", "Verified database entry status is 'present'");
  assert(dbEntry?.remarks === "On time", "Verified database entry remarks saved accurately");

  // Upsert update: change to 'absent' with new remarks
  const resUpdate = await recordAttendanceAction({
    date: testDate,
    periodNumber: testPeriod,
    sectionId: section.id,
    subjectId: subject.id,
    records: [{ studentId: student.id, status: "absent", remarks: "Unexcused absence" }],
  });
  assert(resUpdate.success, "Successfully updates existing attendance session via upsert");

  const { data: updatedDbEntry } = await client
    .from("attendance")
    .select("id, status, remarks")
    .eq("student_id", student.id)
    .eq("date", testDate)
    .eq("period_number", testPeriod)
    .single();

  assert(updatedDbEntry?.status === "absent", "Verified status transitioned to 'absent'");
  assert(updatedDbEntry?.remarks === "Unexcused absence", "Verified remarks updated correctly");

  console.log("\n================================================================================");
  console.log(`TEST EXECUTION COMPLETE: Passed: ${passed} | Failed: ${failed}`);
  console.log("================================================================================\n");

  if (failed > 0) process.exit(1);
}

runAttendanceEngineTests();
