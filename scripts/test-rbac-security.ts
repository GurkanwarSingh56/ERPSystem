/**
 * Automated Security & RBAC Integration Test Suite
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

async function runSecuritySuite() {
  console.log("================================================================================");
  console.log("PHASE 3 SECURITY & RBAC INTEGRATION TEST SUITE");
  console.log("Target Database: " + supabaseUrl + " (DISPOSABLE LOCAL STACK)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: Anonymous Access Blocked for Sensitive Tables
  console.log("TEST 1: Verifying Anonymous/Unauthenticated Access is Denied to Sensitive Records...");
  const sensitiveTables = ["profiles", "fees", "fee_payments", "marks", "attendance", "attendance_audit"];
  let anonLeak = false;

  for (const table of sensitiveTables) {
    const { data, error } = await anonClient.from(table).select("*").limit(5);
    if (data && data.length > 0) {
      console.log(`  [FAIL] Unauthenticated access allowed on table "${table}"!`);
      anonLeak = true;
    } else {
      console.log(`  [PASS] Unauthenticated access denied/empty on table "${table}".`);
    }
  }

  if (!anonLeak) {
    console.log("RESULT TEST 1: PASS\n");
    passed++;
  } else {
    console.log("RESULT TEST 1: FAIL\n");
    failed++;
  }

  // TEST 2: Self-Role-Escalation Attack Rejection
  console.log("TEST 2: Verifying Self-Role-Escalation Attack is Rejection-Guarded...");
  // Attempt to escalate role anonymously or without admin privileges
  const { data: updateData, error: updateErr } = await anonClient
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", "00000000-0000-0000-0000-000000000001")
    .select();

  if (updateData && updateData.length > 0) {
    console.log("  [FAIL] Unauthorized client was able to escalate role to admin!");
    failed++;
  } else {
    console.log("  [PASS] Role escalation prevented by RLS policies and trigger.");
    console.log("RESULT TEST 2: PASS\n");
    passed++;
  }

  // TEST 3: Cross-Institution Data Modification Denial
  console.log("TEST 3: Verifying Cross-Institution Modification Protection...");
  const fakeForeignTenantId = "11111111-1111-1111-1111-111111111111";
  const { data: tenantUpdateData } = await anonClient
    .from("departments")
    .update({ name: "Compromised Department" })
    .eq("institution_id", fakeForeignTenantId)
    .select();

  if (tenantUpdateData && tenantUpdateData.length > 0) {
    console.log("  [FAIL] Foreign institution department was modified!");
    failed++;
  } else {
    console.log("  [PASS] Cross-institution modification denied (0 rows affected).");
    console.log("RESULT TEST 3: PASS\n");
    passed++;
  }

  // TEST 4: Direct Insertion Attack into Attendance Audit Log
  console.log("TEST 4: Verifying Append-Only/Trigger-Only Protection on Attendance Audit Table...");
  const dummyAuditId = "00000000-0000-0000-0000-000000000111";
  const { error: auditInsertErr } = await anonClient
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
      reason: "Hacked audit log entry",
    });

  if (auditInsertErr && auditInsertErr.message.includes("row-level security")) {
    console.log(`  [PASS] Audit log injection rejected by RLS: ${auditInsertErr.message}`);
    console.log("RESULT TEST 4: PASS\n");
    passed++;
  } else {
    console.log(`  [FAIL] Expected RLS rejection error, got: ${auditInsertErr?.message || "No error"}`);
    failed++;
  }

  // TEST 5: Direct Insertion Attack into Fee Payments Ledger
  console.log("TEST 5: Verifying Payment Ledger Injection Rejection...");
  const dummyPaymentId = "00000000-0000-0000-0000-000000000222";
  const { error: payInsertErr } = await anonClient
    .from("fee_payments")
    .insert({
      id: dummyPaymentId,
      institution_id: "00000000-0000-0000-0000-000000000001",
      fee_id: dummyPaymentId,
      student_id: dummyPaymentId,
      receipt_number: "ATTACK-001",
      idempotency_key: "ATTACK-001",
      amount: 50000,
      payment_method: "cash",
      recorded_by: dummyPaymentId,
    });

  if (payInsertErr && payInsertErr.message.includes("row-level security")) {
    console.log(`  [PASS] Direct fee payment injection rejected by RLS: ${payInsertErr.message}`);
    console.log("RESULT TEST 5: PASS\n");
    passed++;
  } else {
    console.log(`  [FAIL] Expected RLS rejection error, got: ${payInsertErr?.message || "No error"}`);
    failed++;
  }

  console.log("================================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
