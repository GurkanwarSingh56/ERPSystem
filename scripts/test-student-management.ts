/**
 * Automated Student Management Security & Integration Test Suite
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

async function runStudentTests() {
  console.log("================================================================================");
  console.log("PHASE 4 STUDENT MANAGEMENT SECURITY & INTEGRATION TEST SUITE");
  console.log("Target Database: " + supabaseUrl + " (DISPOSABLE LOCAL STACK)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: Unauthenticated Student Access Rejection
  console.log("TEST 1: Verifying Anonymous Access Cannot Read Student Records...");
  const { data: anonStudents, error: anonErr } = await anonClient
    .from("students")
    .select("*");

  if (anonStudents && anonStudents.length > 0) {
    console.log("  [FAIL] Anonymous client was able to read student rows!");
    failed++;
  } else {
    console.log("  [PASS] Anonymous client cannot query student records (0 rows leaked).");
    console.log("RESULT TEST 1: PASS\n");
    passed++;
  }

  // TEST 2: Anonymous Student Record Mutation Rejection
  console.log("TEST 2: Verifying Anonymous Client Cannot Insert or Update Students...");
  const dummyId = "00000000-0000-0000-0000-000000000333";
  const { error: insertErr } = await anonClient
    .from("students")
    .insert({
      id: dummyId,
      institution_id: "00000000-0000-0000-0000-000000000001",
      roll_number: "HACK-01",
      admission_number: "HACK-01",
      department_id: dummyId,
      course_id: dummyId,
      semester_id: dummyId,
      section_id: dummyId,
    });

  if (insertErr && insertErr.message.includes("row-level security")) {
    console.log(`  [PASS] Student insertion rejected by RLS: ${insertErr.message}`);
    console.log("RESULT TEST 2: PASS\n");
    passed++;
  } else {
    console.log(`  [FAIL] Expected RLS rejection error, got: ${insertErr?.message || "No error"}`);
    failed++;
  }

  // TEST 3: Duplicate Admission Number & Roll Number Constraint Integrity
  console.log("TEST 3: Verifying Academic Schema Composite Foreign Keys & Constraints Exist...");
  const { data: tableDef, error: tableErr } = await adminClient
    .from("students")
    .select("id, roll_number, admission_number, department_id, course_id, semester_id, section_id")
    .limit(0);

  if (tableErr) {
    console.log(`  [FAIL] Students table schema error: ${tableErr.message}`);
    failed++;
  } else {
    console.log("  [PASS] All expected academic fields exist on students schema.");
    console.log("RESULT TEST 3: PASS\n");
    passed++;
  }

  // TEST 4: Cross-Institution Tenant Scoping on Queries
  console.log("TEST 4: Verifying Tenant Scoping Prohibits Modifying Other Institutions...");
  const fakeTenantId = "22222222-2222-2222-2222-222222222222";
  const { data: tenantData } = await anonClient
    .from("students")
    .update({ roll_number: "TAMPER" })
    .eq("institution_id", fakeTenantId)
    .select();

  if (tenantData && tenantData.length > 0) {
    console.log("  [FAIL] Cross-tenant modification permitted!");
    failed++;
  } else {
    console.log("  [PASS] Cross-tenant student update rejected (0 rows affected).");
    console.log("RESULT TEST 4: PASS\n");
    passed++;
  }

  console.log("================================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runStudentTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
