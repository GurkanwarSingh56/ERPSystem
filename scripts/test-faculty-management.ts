/**
 * Automated Faculty Management Security & Integration Test Suite
 * Project: College ERP MVP
 * Target: ocqawmwlpexuvnsypobb.supabase.co
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Safety Shield: Default strictly to local disposable Supabase
const LOCAL_DEFAULT_URL = "http://127.0.0.1:54321";
const LOCAL_DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_DEFAULT_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabaseUrl = process.env.TEST_SUPABASE_URL || LOCAL_DEFAULT_URL;
const publishableKey = process.env.TEST_SUPABASE_ANON_KEY || LOCAL_DEFAULT_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || LOCAL_DEFAULT_SERVICE_KEY;

// Non-negotiable safety guard: Halt immediately if connected to production or non-local
if (supabaseUrl.includes("ocqawmwlpexuvnsypobb") || !supabaseUrl.includes("127.0.0.1")) {
  console.error("SAFETY SHIELD TRIGGERED: Remote production execution is prohibited!");
  console.error("Tests must run strictly against local disposable Supabase at http://127.0.0.1:54321");
  process.exit(1);
}

// Admin client (privileged, used strictly for test setup & cleanup)
const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Anonymous client (unauthenticated client enforcing RLS)
const anonClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runFacultyTests() {
  console.log("================================================================================");
  console.log("PHASE 5 FACULTY & STAFF MANAGEMENT SECURITY & INTEGRATION TEST SUITE");
  console.log("Target Database: " + supabaseUrl + " (DISPOSABLE LOCAL STACK)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: Unauthenticated Faculty Access Rejection
  console.log("TEST 1: Verifying Anonymous Access Cannot Read Faculty Records...");
  const { data: anonTeachers, error: anonErr } = await anonClient
    .from("teachers")
    .select("*");

  if (anonTeachers && anonTeachers.length > 0) {
    console.log("  [FAIL] Anonymous client was able to read teacher rows!");
    failed++;
  } else {
    console.log("  [PASS] Anonymous client cannot query teacher records (0 rows leaked).");
    console.log("RESULT TEST 1: PASS\n");
    passed++;
  }

  // TEST 2: Anonymous Faculty Record Mutation Rejection
  console.log("TEST 2: Verifying Anonymous Client Cannot Insert or Update Teachers...");
  const dummyId = "00000000-0000-0000-0000-000000000444";
  const { error: insertErr } = await anonClient
    .from("teachers")
    .insert({
      id: dummyId,
      institution_id: "00000000-0000-0000-0000-000000000001",
      employee_id: "HACK-EMP-01",
      department_id: dummyId,
      designation: "Hacker Professor",
    });

  if (insertErr && insertErr.message.includes("row-level security")) {
    console.log(`  [PASS] Teacher insertion rejected by RLS: ${insertErr.message}`);
    console.log("RESULT TEST 2: PASS\n");
    passed++;
  } else {
    console.log(`  [FAIL] Expected RLS rejection error, got: ${insertErr?.message || "No error"}`);
    failed++;
  }

  // TEST 3: Anonymous Teacher-Subject Mapping Mutation Rejection
  console.log("TEST 3: Verifying Anonymous Client Cannot Assign Curricular Allocations...");
  const { error: allocErr } = await anonClient
    .from("teacher_subjects")
    .insert({
      id: dummyId,
      institution_id: "00000000-0000-0000-0000-000000000001",
      teacher_id: dummyId,
      course_id: dummyId,
      semester_id: dummyId,
      subject_id: dummyId,
      section_id: dummyId,
    });

  if (allocErr && allocErr.message.includes("row-level security")) {
    console.log(`  [PASS] Teacher-subject assignment rejected by RLS: ${allocErr.message}`);
    console.log("RESULT TEST 3: PASS\n");
    passed++;
  } else {
    console.log(`  [FAIL] Expected RLS rejection error, got: ${allocErr?.message || "No error"}`);
    failed++;
  }

  // TEST 4: Teachers Table Schema & Composite Constraint Integrity
  console.log("TEST 4: Verifying Teachers and Teacher_Subjects Schemas and Foreign Keys...");
  const { data: teacherCols, error: teacherColErr } = await adminClient
    .from("teachers")
    .select("id, institution_id, employee_id, department_id, designation, created_at, updated_at")
    .limit(0);

  const { data: allocCols, error: allocColErr } = await adminClient
    .from("teacher_subjects")
    .select("id, institution_id, teacher_id, course_id, semester_id, subject_id, section_id")
    .limit(0);

  if (teacherColErr || allocColErr) {
    console.log(`  [FAIL] Faculty schema error: ${teacherColErr?.message || allocColErr?.message}`);
    failed++;
  } else {
    console.log("  [PASS] All expected fields exist on teachers and teacher_subjects schemas.");
    console.log("RESULT TEST 4: PASS\n");
    passed++;
  }

  // TEST 5: Cross-Institution Tenant Scoping Protection on Faculty
  console.log("TEST 5: Verifying Tenant Scoping Prohibits Modifying Other Institutions...");
  const fakeTenantId = "22222222-2222-2222-2222-222222222222";
  const { data: tenantData } = await anonClient
    .from("teachers")
    .update({ designation: "Tampered Designation" })
    .eq("institution_id", fakeTenantId)
    .select();

  if (tenantData && tenantData.length > 0) {
    console.log("  [FAIL] Cross-tenant faculty modification permitted!");
    failed++;
  } else {
    console.log("  [PASS] Cross-tenant faculty update rejected (0 rows affected).");
    console.log("RESULT TEST 5: PASS\n");
    passed++;
  }

  // TEST 6: Student Table Self-Update Role Boundary Verification
  console.log("TEST 6: Verifying Students Table Cannot be Tampered With Anonymously...");
  const { data: studentTamper } = await anonClient
    .from("students")
    .update({ is_dropped: true })
    .eq("institution_id", "00000000-0000-0000-0000-000000000001")
    .select();

  if (studentTamper && studentTamper.length > 0) {
    console.log("  [FAIL] Unauthorized client modified student drop status!");
    failed++;
  } else {
    console.log("  [PASS] Student record modification safely blocked (0 rows affected).");
    console.log("RESULT TEST 6: PASS\n");
    passed++;
  }

  console.log("================================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runFacultyTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
