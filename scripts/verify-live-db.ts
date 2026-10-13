/**
 * Live Database Schema & RLS Verification Suite (v2.0)
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

// Admin client (bypasses RLS strictly for schema probing)
const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Client instance (enforces RLS)
const anonClient = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runLiveVerification() {
  console.log("================================================================================");
  console.log("PHASE 2 REAL POSTGRESQL & RLS VERIFICATION TEST SUITE");
  console.log("Target Database: " + supabaseUrl + " (DISPOSABLE LOCAL STACK)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: Table Existence Check (All 15 tables)
  const expectedTables = [
    "institutions", "profiles", "departments", "courses", "semesters",
    "sections", "subjects", "teachers", "students", "teacher_subjects",
    "attendance", "attendance_audit", "fees", "fee_payments", "marks"
  ];

  console.log("TEST 1: Verifying Table Existence Across All 15 Schema Tables...");
  let tableErrors = 0;
  for (const table of expectedTables) {
    const { error } = await adminClient.from(table).select("*").limit(0);
    if (error) {
      console.log(`  [FAIL] Table "${table}": ${error.message}`);
      tableErrors++;
    } else {
      console.log(`  [PASS] Table "${table}" is online and queryable.`);
    }
  }

  if (tableErrors === 0) {
    console.log("RESULT TEST 1: PASS (All 15 tables exist)\n");
    passed++;
  } else {
    console.log(`RESULT TEST 1: FAIL (${tableErrors} tables missing)\n`);
    failed++;
  }

  // TEST 2: Seed Tenant Exists
  console.log("TEST 2: Verifying Default Campus Institution Seed...");
  const { data: instData, error: instErr } = await adminClient
    .from("institutions")
    .select("id, name, code")
    .eq("code", "MAIN-CAMPUS")
    .single();

  if (instErr || !instData) {
    console.log(`  [FAIL] Default tenant not found: ${instErr?.message}`);
    failed++;
  } else {
    console.log(`  [PASS] Found tenant: ${instData.name} (${instData.code}) [${instData.id}]`);
    console.log("RESULT TEST 2: PASS\n");
    passed++;
  }

  // TEST 3: RLS Active Protection for Unauthenticated Access to Fees
  console.log("TEST 3: Verifying RLS Blocks Unauthenticated Access to Sensitive Financial Data...");
  const { data: feeAnonData, error: feeAnonErr } = await anonClient
    .from("fees")
    .select("*");

  if (feeAnonData && feeAnonData.length > 0) {
    console.log("  [FAIL] Unauthenticated client was able to read fee records!");
    failed++;
  } else {
    console.log("  [PASS] Unauthenticated client cannot read fees (0 records leaked).");
    console.log("RESULT TEST 3: PASS\n");
    passed++;
  }

  // TEST 4: RLS Rejection on Unauthorized INSERT to Attendance Audit
  console.log("TEST 4: Verifying RLS Rejection on Direct Insertion to Audit Log...");
  const dummyAuditId = "00000000-0000-0000-0000-000000000999";
  const { error: insertAuditErr } = await anonClient
    .from("attendance_audit")
    .insert({
      id: dummyAuditId,
      institution_id: "00000000-0000-0000-0000-000000000001",
      attendance_id: dummyAuditId,
      student_id: dummyAuditId,
      subject_id: dummyAuditId,
      previous_status: "absent",
      new_status: "present",
      changed_by: dummyAuditId,
      reason: "Unauthorized injection attempt"
    });

  if (insertAuditErr && insertAuditErr.message.includes("row-level security")) {
    console.log(`  [PASS] Audit write correctly rejected: ${insertAuditErr.message}`);
    console.log("RESULT TEST 4: PASS\n");
    passed++;
  } else {
    console.log(`  [FAIL] Expected RLS rejection error, got: ${insertAuditErr?.message || "No error"}`);
    failed++;
  }

  // TEST 5: RLS Rejection on Unauthorized INSERT to Fee Payments
  console.log("TEST 5: Verifying RLS Rejection on Direct Insertion to Financial Payments Ledger...");
  const dummyPayId = "00000000-0000-0000-0000-000000000999";
  const { error: insertPayErr } = await anonClient
    .from("fee_payments")
    .insert({
      id: dummyPayId,
      institution_id: "00000000-0000-0000-0000-000000000001",
      fee_id: dummyPayId,
      student_id: dummyPayId,
      receipt_number: "UNAUTH-RCPT-001",
      idempotency_key: "UNAUTH-IDEMP-001",
      amount: 1500,
      payment_method: "cash",
      recorded_by: dummyPayId
    });

  if (insertPayErr && insertPayErr.message.includes("row-level security")) {
    console.log(`  [PASS] Financial payment insertion correctly rejected: ${insertPayErr.message}`);
    console.log("RESULT TEST 5: PASS\n");
    passed++;
  } else {
    console.log(`  [FAIL] Expected RLS rejection error, got: ${insertPayErr?.message || "No error"}`);
    failed++;
  }

  // TEST 6: RLS Role Escalation Protection on Profiles
  console.log("TEST 6: Verifying RLS Prevents Role Escalation on Profiles Table...");
  const { data: updateProfileData, error: updateProfileErr } = await anonClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .select();

  if (updateProfileData && updateProfileData.length > 0) {
    console.log("  [FAIL] Anonymous client was able to update a profile role!");
    failed++;
  } else {
    console.log("  [PASS] Anonymous client cannot modify profile roles (0 rows updated).");
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

runLiveVerification().catch(err => {
  console.error("Verification suite failed:", err);
  process.exit(1);
});
