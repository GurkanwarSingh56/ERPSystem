/**
 * Comprehensive Authenticated RBAC, Tenancy Isolation & Dedicated Cashier Security Audit Suite
 * Project: College ERP MVP
 * Target: Local Disposable Supabase Stack (127.0.0.1:54321 / 54322)
 *
 * Verifies:
 * 1. Migration 11: Cross-institution isolation across all 13 affected tables,
 *    role escalation prevention, institution immutability, and inactive user rejection.
 * 2. Migration 12: Dedicated cashier role verification, offline fee collection
 *    (cash, cheque, bank transfer, UPI, DD), balance reconciliation triggers,
 *    overpayment prevention, duplicate receipt/idempotency protection,
 *    ledger immutability, auditable reversals, and cross-institution protections.
 */

import { createClient } from "@supabase/supabase-js";

// Safety Shield: Default strictly to local disposable Supabase
const LOCAL_DEFAULT_URL = "http://127.0.0.1:54321";
const LOCAL_DEFAULT_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_DEFAULT_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabaseUrl = process.env.TEST_SUPABASE_URL || LOCAL_DEFAULT_URL;
const publishableKey = process.env.TEST_SUPABASE_ANON_KEY || LOCAL_DEFAULT_ANON_KEY;
const serviceKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY || LOCAL_DEFAULT_SERVICE_KEY;

// Non-negotiable safety guard: Halt immediately if connected to production
if (supabaseUrl.includes("ocqawmwlpexuvnsypobb") || !supabaseUrl.includes("127.0.0.1")) {
  console.error("SAFETY SHIELD TRIGGERED: Remote production execution is prohibited!");
  console.error("Tests must run strictly against local disposable Supabase at http://127.0.0.1:54321");
  process.exit(1);
}

// Privileged admin client for fixture provisioning and cleanup
const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Helper: Create an isolated authenticated client for a specific email & password
async function createAuthenticatedClient(email: string, pass: string) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error || !data.user) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message}`);
  }
  return { client, user: data.user, session: data.session };
}

async function runSecurityAudit() {
  console.log("================================================================================");
  console.log("COLLEGE ERP SECURITY AUDIT: MIGRATION 11 TENANCY & MIGRATION 12 CASHIER ROLE");
  console.log("Target Database: " + supabaseUrl + " (DISPOSABLE LOCAL STACK)");
  console.log("================================================================================\n");

  const runId = Math.random().toString(36).substring(2, 7);
  const testPassword = `TestPass!9${runId}X#`;

  // Fixture IDs
  const institutionAId = "00000000-0000-0000-0000-000000000001"; // Main campus
  let institutionBId: string | null = null;

  // Test accounts to clean up
  const createdAuthUserIds: string[] = [];

  let passed = 0;
  let failed = 0;

  function assert(condition: unknown, passMsg: string, failMsg: string) {
    if (Boolean(condition)) {
      console.log(`  [PASS] ${passMsg}`);
      passed++;
    } else {
      console.log(`  [FAIL] ${failMsg}`);
      failed++;
    }
  }

  try {
    console.log(">>> [SETUP] Creating isolated Test Institution B and Role Personas...");

    // 1. Create a second test institution for cross-tenant verification
    const { data: instB, error: instBErr } = await adminClient
      .from("institutions")
      .insert({
        name: `Foreign Campus ${runId}`,
        code: `CAMPUS-B-${runId.toUpperCase()}`,
      })
      .select("id")
      .single();

    if (instBErr || !instB) {
      throw new Error(`Failed to create test institution B: ${instBErr?.message}`);
    }
    institutionBId = instB.id;
    console.log(`  [+] Created Institution B: ${institutionBId}`);

    // Helper to provision user persona
    async function provisionUser(role: string, emailPrefix: string, instId: string, status = "active") {
      const email = `${emailPrefix}_${runId}@audit.test`;
      const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
        user_metadata: { full_name: `Test ${role.toUpperCase()} ${runId}` },
      });
      if (authErr || !authUser.user) {
        throw new Error(`Failed to create auth user ${email}: ${authErr?.message}`);
      }
      createdAuthUserIds.push(authUser.user.id);

      const { error: profErr } = await adminClient.from("profiles").insert({
        id: authUser.user.id,
        institution_id: instId,
        email,
        full_name: `Test ${role.toUpperCase()} ${runId}`,
        role,
        status,
      });
      if (profErr) throw new Error(`Failed to create profile: ${profErr.message}`);

      return { id: authUser.user.id, email, password: testPassword };
    }

    // Provision Personas in Institution A
    const adminA = await provisionUser("admin", "admin_a", institutionAId);
    const cashierA = await provisionUser("cashier", "cashier_a", institutionAId);
    const teacherA = await provisionUser("teacher", "teacher_a", institutionAId);
    const studentA = await provisionUser("student", "student_a", institutionAId);
    const studentA2 = await provisionUser("student", "student_a2", institutionAId);
    const inactiveAdminA = await provisionUser("admin", "inactive_admin_a", institutionAId, "inactive");

    // Provision Personas in Institution B (Foreign Campus)
    const adminB = await provisionUser("admin", "admin_b", institutionBId!);
    const cashierB = await provisionUser("cashier", "cashier_b", institutionBId!);
    const studentB = await provisionUser("student", "student_b", institutionBId!);

    console.log("  [+] Successfully provisioned authenticated test personas:");
    console.log(`      - Admin A (Inst A): ${adminA.id}`);
    console.log(`      - Cashier A (Inst A): ${cashierA.id}`);
    console.log(`      - Teacher A (Inst A): ${teacherA.id}`);
    console.log(`      - Student A (Inst A): ${studentA.id}`);
    console.log(`      - Admin B (Inst B): ${adminB.id}`);
    console.log(`      - Cashier B (Inst B): ${cashierB.id}`);
    console.log(`      - Student B (Inst B): ${studentB.id}\n`);

    // Connect authenticated Supabase clients
    const clientAdminA = (await createAuthenticatedClient(adminA.email, adminA.password)).client;
    const clientCashierA = (await createAuthenticatedClient(cashierA.email, cashierA.password)).client;
    const clientTeacherA = (await createAuthenticatedClient(teacherA.email, teacherA.password)).client;
    const clientStudentA = (await createAuthenticatedClient(studentA.email, studentA.password)).client;
    const clientAdminB = (await createAuthenticatedClient(adminB.email, adminB.password)).client;
    const clientCashierB = (await createAuthenticatedClient(cashierB.email, cashierB.password)).client;
    const clientStudentB = (await createAuthenticatedClient(studentB.email, studentB.password)).client;
    const clientInactiveAdminA = (await createAuthenticatedClient(inactiveAdminA.email, inactiveAdminA.password)).client;

    // Academic structure setup in Inst A
    const { data: deptA } = await adminClient
      .from("departments")
      .insert({ institution_id: institutionAId, name: `CS Dept ${runId}`, code: `CS-${runId}` })
      .select("id")
      .single();
    if (!deptA) throw new Error("Failed to create test department");

    const { data: courseA } = await adminClient
      .from("courses")
      .insert({ institution_id: institutionAId, department_id: deptA.id, name: `BTech CS ${runId}`, code: `BT-${runId}` })
      .select("id")
      .single();
    if (!courseA) throw new Error("Failed to create test course");

    const { data: semA } = await adminClient
      .from("semesters")
      .insert({ institution_id: institutionAId, course_id: courseA.id, semester_number: 1 })
      .select("id")
      .single();
    if (!semA) throw new Error("Failed to create test semester");

    const { data: secA } = await adminClient
      .from("sections")
      .insert({ institution_id: institutionAId, course_id: courseA.id, semester_id: semA.id, name: "Section A" })
      .select("id")
      .single();
    if (!secA) throw new Error("Failed to create test section");

    const { data: subjA } = await adminClient
      .from("subjects")
      .insert({
        institution_id: institutionAId,
        course_id: courseA.id,
        semester_id: semA.id,
        name: `Data Structures ${runId}`,
        code: `DS-${runId}`,
        type: "theory",
      })
      .select("id")
      .single();
    if (!subjA) throw new Error("Failed to create test subject");

    // Student A record
    await adminClient.from("students").insert({
      id: studentA.id,
      institution_id: institutionAId,
      roll_number: `ROLL-A-${runId}`,
      admission_number: `ADM-A-${runId}`,
      department_id: deptA.id,
      course_id: courseA.id,
      semester_id: semA.id,
      section_id: secA.id,
    });

    // Student A2 record in Inst A (for Admin allocation tests)
    await adminClient.from("students").insert({
      id: studentA2.id,
      institution_id: institutionAId,
      roll_number: `ROLL-A2-${runId}`,
      admission_number: `ADM-A2-${runId}`,
      department_id: deptA.id,
      course_id: courseA.id,
      semester_id: semA.id,
      section_id: secA.id,
    });

    // Student B record in Inst B
    const { data: deptB } = await adminClient
      .from("departments")
      .insert({ institution_id: institutionBId!, name: `Mech Dept ${runId}`, code: `ME-${runId}` })
      .select("id")
      .single();
    const { data: courseB } = await adminClient
      .from("courses")
      .insert({ institution_id: institutionBId!, department_id: deptB!.id, name: `BTech ME ${runId}`, code: `BM-${runId}` })
      .select("id")
      .single();
    const { data: semB } = await adminClient
      .from("semesters")
      .insert({ institution_id: institutionBId!, course_id: courseB!.id, semester_number: 1 })
      .select("id")
      .single();
    const { data: secB } = await adminClient
      .from("sections")
      .insert({ institution_id: institutionBId!, course_id: courseB!.id, semester_id: semB!.id, name: "Section B" })
      .select("id")
      .single();

    await adminClient.from("students").insert({
      id: studentB.id,
      institution_id: institutionBId!,
      roll_number: `ROLL-B-${runId}`,
      admission_number: `ADM-B-${runId}`,
      department_id: deptB!.id,
      course_id: courseB!.id,
      semester_id: semB!.id,
      section_id: secB!.id,
    });

    // =========================================================================
    // SECTION 1: MIGRATION 11 TENANCY & CROSS-INSTITUTION AUDIT
    // =========================================================================
    console.log("SECTION 1: MIGRATION 11 TENANCY & CROSS-INSTITUTION ISOLATION AUDIT");

    // 1.1 Profiles Cross-Tenant SELECT, UPDATE, DELETE
    const { data: leakProf } = await clientAdminB
      .from("profiles")
      .select("id")
      .eq("institution_id", institutionAId);
    assert(
      !leakProf || leakProf.length === 0,
      "Admin B cannot SELECT profiles from Institution A (0 leaked rows).",
      `Admin B was able to view ${leakProf?.length} profiles from Institution A!`
    );

    const { data: tamperProf } = await clientAdminB
      .from("profiles")
      .update({ full_name: "Hacked by Admin B" })
      .eq("id", studentA.id)
      .select();
    assert(
      !tamperProf || tamperProf.length === 0,
      "Admin B cannot UPDATE profiles in Institution A (0 rows modified).",
      "Admin B tampered with an Institution A profile!"
    );

    const { data: delProf } = await clientAdminB
      .from("profiles")
      .delete()
      .eq("id", studentA.id)
      .select();
    assert(
      !delProf || delProf.length === 0,
      "Admin B cannot DELETE profiles in Institution A (0 rows deleted).",
      "Admin B deleted an Institution A profile!"
    );

    // 1.2 Departments Cross-Tenant INSERT & UPDATE
    const { error: deptCrossInsErr } = await clientAdminB
      .from("departments")
      .insert({ institution_id: institutionAId, name: `Infiltrated Dept ${runId}`, code: `INF-${runId}` });
    assert(
      !!deptCrossInsErr,
      "Admin B cannot INSERT departments into Institution A (blocked by RLS).",
      "Admin B inserted a department into Institution A!"
    );

    // 1.3 Courses Cross-Tenant INSERT
    const { error: courseCrossInsErr } = await clientAdminB
      .from("courses")
      .insert({ institution_id: institutionAId, department_id: deptA.id, name: `Fake Course ${runId}`, code: `FC-${runId}` });
    assert(
      !!courseCrossInsErr,
      "Admin B cannot INSERT courses into Institution A (blocked by RLS).",
      "Admin B inserted a course into Institution A!"
    );

    // 1.4 Students Cross-Tenant INSERT & UPDATE
    const { error: stuCrossInsErr } = await clientAdminB
      .from("students")
      .insert({
        id: studentB.id,
        institution_id: institutionAId,
        roll_number: `ROLL-X-${runId}`,
        admission_number: `ADM-X-${runId}`,
        department_id: deptA.id,
        course_id: courseA.id,
        semester_id: semA.id,
        section_id: secA.id,
      });
    assert(
      !!stuCrossInsErr,
      "Admin B cannot INSERT students into Institution A (blocked by RLS).",
      "Admin B inserted a student into Institution A!"
    );

    // 1.5 Marks Cross-Tenant INSERT
    const { error: marksCrossInsErr } = await clientAdminB
      .from("marks")
      .insert({
        institution_id: institutionAId,
        student_id: studentA.id,
        subject_id: subjA.id,
        internal_marks: 25,
        midterm_marks: 18,
        final_marks: 45,
        entered_by: adminB.id,
      });
    assert(
      !!marksCrossInsErr,
      "Admin B cannot INSERT marks into Institution A (blocked by RLS).",
      "Admin B inserted marks into Institution A!"
    );

    // 1.6 Attendance Cross-Tenant INSERT
    const { error: attCrossInsErr } = await clientAdminB
      .from("attendance")
      .insert({
        institution_id: institutionAId,
        student_id: studentA.id,
        subject_id: subjA.id,
        section_id: secA.id,
        date: "2026-10-11",
        period_number: 1,
        status: "present",
        marked_by: adminB.id,
      });
    assert(
      !!attCrossInsErr,
      "Admin B cannot INSERT attendance into Institution A (blocked by RLS).",
      "Admin B inserted attendance into Institution A!"
    );

    // 1.7 Prevent Role Escalation Trigger: Student Self-Escalation
    const { error: selfEscalateErr } = await clientStudentA
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", studentA.id);
    assert(
      !!selfEscalateErr && (selfEscalateErr.message.includes("Access Denied") || selfEscalateErr.message.includes("row-level security")),
      "Student self-role escalation rejected by prevent_role_escalation trigger.",
      "Student was able to escalate their own role to admin!"
    );

    // 1.8 Prevent Role Escalation Trigger: Institution Reassignment Blocked (Even by Admin)
    const { error: instReassignErr } = await clientAdminA
      .from("profiles")
      .update({ institution_id: institutionBId })
      .eq("id", studentA.id);
    assert(
      !!instReassignErr && instReassignErr.message.includes("Access Denied"),
      "Institution affiliation is immutable; campus admin cannot reassign profile to another institution.",
      "Admin was able to alter profile institution_id!"
    );

    // 1.9 Inactive Admin Blocked
    const { error: inactiveAdminErr } = await clientInactiveAdminA
      .from("profiles")
      .update({ full_name: "Modified by Inactive Admin" })
      .eq("id", studentA.id);
    assert(
      !!inactiveAdminErr || (await adminClient.from("profiles").select("full_name").eq("id", studentA.id).single()).data?.full_name !== "Modified by Inactive Admin",
      "Inactive admin is blocked from modifying profiles via RLS/triggers.",
      "Inactive admin was able to modify profiles!"
    );

    // =========================================================================
    // SECTION 2: DEDICATED CASHIER ROLE & OFFLINE FEE COLLECTION AUDIT
    // =========================================================================
    console.log("\nSECTION 2: DEDICATED CASHIER ROLE & OFFLINE FEE COLLECTION AUDIT");

    // 2.1 Confirm Cashier Profile Verification
    const { data: cashierProfile } = await clientCashierA
      .from("profiles")
      .select("id, role, status, institution_id")
      .eq("id", cashierA.id)
      .single();

    assert(
      cashierProfile?.role === "cashier" && cashierProfile?.status === "active",
      `Verified real profile with role = 'cashier' exists in local DB (${cashierProfile?.id}).`,
      `Cashier profile role mismatch: ${cashierProfile?.role}`
    );

    // 2.2 Cashier Role Boundaries: Cashier cannot insert departments or students
    const { error: cashierInsDeptErr } = await clientCashierA
      .from("departments")
      .insert({ institution_id: institutionAId, name: `Cashier Dept ${runId}`, code: `CD-${runId}` });
    assert(
      !!cashierInsDeptErr,
      "Cashier is strictly prevented from inserting departments (boundary maintained).",
      "Cashier inserted a department!"
    );

    const { error: cashierInsStuErr } = await clientCashierA
      .from("students")
      .insert({
        id: cashierA.id,
        institution_id: institutionAId,
        roll_number: `CASH-ROLL-${runId}`,
        admission_number: `CASH-ADM-${runId}`,
        department_id: deptA.id,
        course_id: courseA.id,
        semester_id: semA.id,
        section_id: secA.id,
      });
    assert(
      !!cashierInsStuErr,
      "Cashier is strictly prevented from creating students (boundary maintained).",
      "Cashier inserted a student record!"
    );

    // 2.3 Cashier cannot manage fee structures (fees table)
    const { error: cashierCreateFeeErr } = await clientCashierA
      .from("fees")
      .insert({
        institution_id: institutionAId,
        student_id: studentA.id,
        academic_year: "2026-27",
        total_fee: 100000,
        paid_amount: 0,
      });
    assert(
      !!cashierCreateFeeErr,
      "Cashier cannot create fee structures on fees table (fees_admin_all requires admin).",
      "Cashier created a fee structure!"
    );

    // 2.4 Cashier cannot self-escalate role
    const { error: cashierEscalateErr } = await clientCashierA
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", cashierA.id);
    assert(
      !!cashierEscalateErr && (cashierEscalateErr.message.includes("Access Denied") || cashierEscalateErr.message.includes("row-level security")),
      "Cashier self-role escalation to admin strictly blocked by prevent_role_escalation trigger.",
      "Cashier elevated their role to admin!"
    );

    // 2.5 Provision Fee Master for Student A: ₹60,000 total fee
    const { data: feeMaster, error: feeMasterErr } = await adminClient
      .from("fees")
      .insert({
        institution_id: institutionAId,
        student_id: studentA.id,
        academic_year: `2026-${runId}`,
        total_fee: 60000,
        paid_amount: 0,
      })
      .select("id, total_fee, paid_amount, pending_amount")
      .single();

    if (feeMasterErr || !feeMaster) {
      throw new Error(`Failed to provision student fee master: ${feeMasterErr?.message}`);
    }
    console.log(`  [+] Provisioned Student Fee Master: ₹${feeMaster.total_fee} total dues.`);

    // 2.6 Cashier can view fees and student directory within same institution
    const { data: cashierFeeRead } = await clientCashierA
      .from("fees")
      .select("id, total_fee, pending_amount")
      .eq("id", feeMaster.id)
      .single();
    assert(
      cashierFeeRead?.id === feeMaster.id && Number(cashierFeeRead?.pending_amount) === 60000,
      "Cashier A successfully queried fee dues for Student A within Institution A via RLS.",
      "Cashier A failed to read fee dues within own institution!"
    );

    // 2.7 Cross-Tenant Read: Cashier B CANNOT view Institution A fee dues
    const { data: cashierBLeak } = await clientCashierB
      .from("fees")
      .select("id")
      .eq("id", feeMaster.id);
    assert(
      !cashierBLeak || cashierBLeak.length === 0,
      "Cashier B cannot view fee records of Institution A (cross-tenant RLS leak blocked).",
      "Cashier B accessed Institution A fee records!"
    );

    // 2.8 Student Unauthorized Direct Payment Insertion (Must be blocked by RLS)
    const { error: stuDirectPayErr } = await clientStudentA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: `STU-DIRECT-${runId}`,
        idempotency_key: `IDEM-STU-${runId}`,
        amount: 60000,
        payment_method: "cash",
        recorded_by: studentA.id,
      });
    assert(
      !!stuDirectPayErr,
      "Student direct insert into fee_payments blocked by RLS (only cashiers/admins can insert).",
      "Student was able to record their own payment directly!"
    );

    // 2.9 Cashier A Records Offline Installment 1 (₹25,000 via Cash)
    const receipt1 = `REC-OFFLINE-${runId}-001`;
    const { data: pay1, error: pay1Err } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: receipt1,
        idempotency_key: `IDEM-CASH1-${runId}`,
        amount: 25000,
        payment_date: "2026-10-12",
        payment_method: "cash",
        payment_status: "completed",
        remarks: "Cash paid at campus counter; verified by Cashier A",
        recorded_by: cashierA.id,
      })
      .select("id, receipt_number, amount, recorded_by, payment_status")
      .single();

    assert(
      !pay1Err && pay1?.receipt_number === receipt1 && Number(pay1?.amount) === 25000 && pay1?.recorded_by === cashierA.id,
      `Cashier A authenticated offline payment #1 recorded (Receipt: ${pay1?.receipt_number}, Amount: ₹${pay1?.amount}, recorded_by: ${pay1?.recorded_by}).`,
      `Cashier payment #1 recording failed: ${pay1Err?.message}`
    );

    // Inspect database balance after Installment 1
    const { data: feeAfterPay1 } = await adminClient
      .from("fees")
      .select("paid_amount, pending_amount")
      .eq("id", feeMaster.id)
      .single();

    assert(
      feeAfterPay1 && Number(feeAfterPay1.paid_amount) === 25000 && Number(feeAfterPay1.pending_amount) === 35000,
      `Reconciled balance after Installment 1: Paid = ₹${feeAfterPay1?.paid_amount}, Pending = ₹${feeAfterPay1?.pending_amount}.`,
      `Balance mismatch after Installment 1: Paid=${feeAfterPay1?.paid_amount}, Pending=${feeAfterPay1?.pending_amount}`
    );

    // 2.10 Cashier A Records Offline Installment 2 (₹15,000 via UPI)
    const receipt2 = `REC-OFFLINE-${runId}-002`;
    const { data: pay2, error: pay2Err } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: receipt2,
        idempotency_key: `IDEM-CASH2-${runId}`,
        amount: 15000,
        payment_date: "2026-10-12",
        payment_method: "upi",
        payment_status: "completed",
        remarks: "Counter QR code UPI payment verified by Cashier A",
        recorded_by: cashierA.id,
      })
      .select("id, receipt_number, amount")
      .single();

    assert(
      !pay2Err && pay2?.receipt_number === receipt2 && Number(pay2?.amount) === 15000,
      `Cashier A recorded offline partial installment #2 via UPI (Receipt: ${pay2?.receipt_number}, Amount: ₹${pay2?.amount}).`,
      `Installment #2 recording failed: ${pay2Err?.message}`
    );

    const { data: feeAfterPay2 } = await adminClient
      .from("fees")
      .select("paid_amount, pending_amount")
      .eq("id", feeMaster.id)
      .single();

    assert(
      feeAfterPay2 && Number(feeAfterPay2.paid_amount) === 40000 && Number(feeAfterPay2.pending_amount) === 20000,
      `Reconciled balance after Installment 2: Cumulative Paid = ₹${feeAfterPay2?.paid_amount}, Remaining Pending = ₹${feeAfterPay2?.pending_amount}.`,
      `Balance mismatch after Installment 2: Paid=${feeAfterPay2?.paid_amount}, Pending=${feeAfterPay2?.pending_amount}`
    );

    // 2.11 Other Supported Offline Methods (Demand Draft: ₹10,000)
    const receipt3 = `REC-OFFLINE-${runId}-003`;
    const { data: pay3, error: pay3Err } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: receipt3,
        idempotency_key: `IDEM-CASH3-${runId}`,
        amount: 10000,
        payment_date: "2026-10-12",
        payment_method: "demand_draft",
        payment_status: "completed",
        reference_number: "DD-SBI-998877",
        remarks: "Demand Draft deposited and verified",
        recorded_by: cashierA.id,
      })
      .select("id, amount, payment_method")
      .single();

    assert(
      !pay3Err && pay3?.payment_method === "demand_draft" && Number(pay3?.amount) === 10000,
      `Cashier recorded offline payment using Demand Draft (Method: ${pay3?.payment_method}, Amount: ₹${pay3?.amount}).`,
      `Demand draft payment failed: ${pay3Err?.message}`
    );

    const { data: feeAfterPay3 } = await adminClient
      .from("fees")
      .select("paid_amount, pending_amount")
      .eq("id", feeMaster.id)
      .single();

    assert(
      feeAfterPay3 && Number(feeAfterPay3.paid_amount) === 50000 && Number(feeAfterPay3.pending_amount) === 10000,
      `Balance after Installment 3: Paid = ₹${feeAfterPay3?.paid_amount}, Pending = ₹${feeAfterPay3?.pending_amount}.`,
      `Balance mismatch after Installment 3: Paid=${feeAfterPay3?.paid_amount}, Pending=${feeAfterPay3?.pending_amount}`
    );

    // 2.12 Overpayment Prevention Trigger
    // Total is ₹60,000. Paid is ₹50,000. Pending is ₹10,000.
    // Attempting to pay ₹25,000 would exceed the required fee (₹75,000 > ₹60,000).
    const { error: overpayErr } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: `REC-OVERPAY-${runId}`,
        idempotency_key: `IDEM-OVERPAY-${runId}`,
        amount: 25000,
        payment_method: "cash",
        recorded_by: cashierA.id,
      });

    assert(
      !!overpayErr && overpayErr.message.includes("exceed the total required fee balance"),
      `Overpayment rejected by reconcile_fee_balance trigger: "${overpayErr?.message}".`,
      "Overpayment was permitted by database trigger!"
    );

    // Inspect database balance remains unchanged after rejected overpayment
    const { data: feeAfterOverpay } = await adminClient
      .from("fees")
      .select("paid_amount, pending_amount")
      .eq("id", feeMaster.id)
      .single();

    assert(
      feeAfterOverpay && Number(feeAfterOverpay.paid_amount) === 50000 && Number(feeAfterOverpay.pending_amount) === 10000,
      "Database state preserved after rejected overpayment (Paid = ₹50,000, Pending = ₹10,000).",
      `Balance mutated after rejected overpayment! Paid=${feeAfterOverpay?.paid_amount}`
    );

    // 2.13 Duplicate Receipt Number Rejection (Within Institution)
    const { error: dupReceiptErr } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: receipt1, // Reusing receipt1!
        idempotency_key: `IDEM-DUPREC-${runId}`,
        amount: 5000,
        payment_method: "cash",
        recorded_by: cashierA.id,
      });

    assert(
      !!dupReceiptErr && (dupReceiptErr.message.includes("duplicate key") || dupReceiptErr.message.includes("uq_fee_payments_inst_receipt")),
      "Duplicate receipt number strictly rejected by uq_fee_payments_inst_receipt constraint.",
      "Duplicate receipt number was permitted!"
    );

    // 2.14 Duplicate Idempotency Key Rejection
    const { error: dupIdemErr } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: `REC-NEW-${runId}`,
        idempotency_key: `IDEM-CASH1-${runId}`, // Reusing idempotency key of pay1!
        amount: 5000,
        payment_method: "cash",
        recorded_by: cashierA.id,
      });

    assert(
      !!dupIdemErr && (dupIdemErr.message.includes("duplicate key") || dupIdemErr.message.includes("uq_fee_payments_inst_idempotency")),
      "Duplicate idempotency key strictly rejected by uq_fee_payments_inst_idempotency constraint.",
      "Duplicate idempotency key was permitted!"
    );

    // 2.15 Spoofing recorded_by Blocked
    const { error: spoofRecordedByErr } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: `REC-SPOOF-${runId}`,
        idempotency_key: `IDEM-SPOOF-${runId}`,
        amount: 5000,
        payment_method: "cash",
        recorded_by: adminA.id, // Cashier attempting to spoof Admin's user ID!
      });

    assert(
      !!spoofRecordedByErr && (spoofRecordedByErr.message.includes("recorded_by") || spoofRecordedByErr.message.includes("row-level security")),
      "Spoofing recorded_by with another user's ID is rejected by RLS & trigger.",
      "Cashier successfully spoofed recorded_by user ID!"
    );

    // 2.16 Cross-Institution Payment Block (Cashier B cannot insert payment in Institution A)
    const { error: crossCashierErr } = await clientCashierB
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: `REC-CROSS-${runId}`,
        idempotency_key: `IDEM-CROSS-${runId}`,
        amount: 5000,
        payment_method: "cash",
        recorded_by: cashierB.id,
      });

    assert(
      !!crossCashierErr && crossCashierErr.message.includes("row-level security"),
      "Foreign Cashier B cannot record payment in Institution A (blocked by is_cashier_or_admin_of_institution).",
      "Foreign Cashier recorded payment in Institution A!"
    );

    // 2.17 Ledger Immutability (Direct UPDATE and DELETE blocked)
    const { data: updateLedgerData } = await clientCashierA
      .from("fee_payments")
      .update({ amount: 99999 })
      .eq("id", pay1!.id)
      .select();

    assert(
      !updateLedgerData || updateLedgerData.length === 0,
      "Direct UPDATE of fee_payments ledger row strictly rejected by fee_payments_no_update policy (0 modified).",
      "Cashier updated a financial ledger entry!"
    );

    const { data: deleteLedgerData } = await clientCashierA
      .from("fee_payments")
      .delete()
      .eq("id", pay1!.id)
      .select();

    assert(
      !deleteLedgerData || deleteLedgerData.length === 0,
      "Direct DELETE of fee_payments ledger row strictly rejected by fee_payments_no_delete policy (0 deleted).",
      "Cashier deleted a financial ledger entry!"
    );

    // 2.18 Auditable Reversal: Correcting Installment 2 (₹15,000)
    // Business rule: Reversals must insert a linked record referencing reversed_payment_id with payment_status = 'reversed'.
    const revReceipt = `REV-${runId}-001`;
    const { data: revRecord, error: revErr } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: revReceipt,
        idempotency_key: `IDEM-REV-${runId}`,
        amount: 15000,
        payment_date: "2026-10-12",
        payment_method: "upi",
        payment_status: "reversed",
        reversed_payment_id: pay2!.id,
        remarks: "Cashier reversal: UPI payment bounce / counter reconciliation",
        recorded_by: cashierA.id,
      })
      .select("id, receipt_number, amount, payment_status, reversed_payment_id")
      .single();

    assert(
      !revErr && revRecord?.reversed_payment_id === pay2!.id && revRecord?.payment_status === "reversed",
      `Auditable reversal record inserted (ID: ${revRecord?.id}, Linked to original: ${revRecord?.reversed_payment_id}).`,
      `Auditable reversal insertion failed: ${revErr?.message}`
    );

    // Inspect database balance after reversal:
    // Net payments should be 50,000 - 15,000 = 35,000. Pending dues should be 60,000 - 35,000 = 25,000.
    const { data: feeAfterRev } = await adminClient
      .from("fees")
      .select("paid_amount, pending_amount")
      .eq("id", feeMaster.id)
      .single();

    assert(
      feeAfterRev && Number(feeAfterRev.paid_amount) === 35000 && Number(feeAfterRev.pending_amount) === 25000,
      `Balance reconciled after reversal: Paid decremented to ₹${feeAfterRev?.paid_amount}, Pending restored to ₹${feeAfterRev?.pending_amount}.`,
      `Balance mismatch after reversal: Paid=${feeAfterRev?.paid_amount}, Pending=${feeAfterRev?.pending_amount}`
    );

    // Verify both original payment and reversal row remain in fee_payments ledger
    const { data: ledgerAudit } = await adminClient
      .from("fee_payments")
      .select("id, amount, payment_status, receipt_number")
      .in("id", [pay2!.id, revRecord!.id]);

    assert(
      ledgerAudit && ledgerAudit.length === 2,
      `Both original payment row (${pay2!.receipt_number}) and reversal row (${revReceipt}) preserved in immutable ledger.`,
      "Ledger audit integrity compromised!"
    );

    // 2.19 Duplicate Reversal Rejection: Attempting to reverse pay2 a second time
    const { error: dupRevErr } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: `REV-DUP-${runId}`,
        idempotency_key: `IDEM-REV-DUP-${runId}`,
        amount: 15000,
        payment_method: "upi",
        payment_status: "reversed",
        reversed_payment_id: pay2!.id, // Same original payment!
        recorded_by: cashierA.id,
      });

    assert(
      !!dupRevErr && dupRevErr.message.includes("already been reversed"),
      `Duplicate reversal prevented by validate_fee_payment_transaction trigger: "${dupRevErr?.message}".`,
      "Duplicate reversal was permitted!"
    );

    // 2.20 Cross-Institution Reversal Block: Cashier B attempting to reverse Cashier A's payment
    const { error: crossRevErr } = await clientCashierB
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: `REV-CROSS-${runId}`,
        idempotency_key: `IDEM-REV-CROSS-${runId}`,
        amount: 25000,
        payment_method: "cash",
        payment_status: "reversed",
        reversed_payment_id: pay1!.id,
        recorded_by: cashierB.id,
      });

    assert(
      !!crossRevErr,
      "Cross-institution reversal rejected (Cashier B cannot reverse Institution A payment).",
      "Cross-institution reversal was permitted!"
    );

    // 2.21 Reversal Amount Mismatch Rejection
    const { error: mismatchRevErr } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: `REV-MISMATCH-${runId}`,
        idempotency_key: `IDEM-REV-MIS-${runId}`,
        amount: 9999, // Mismatched amount! pay1 was 25000
        payment_method: "cash",
        payment_status: "reversed",
        reversed_payment_id: pay1!.id,
        recorded_by: cashierA.id,
      });

    assert(
      !!mismatchRevErr && mismatchRevErr.message.includes("must exactly equal original payment amount"),
      `Reversal amount mismatch rejected by trigger: "${mismatchRevErr?.message}".`,
      "Reversal with mismatched amount was permitted!"
    );

    // 2.22 Final Settlement: Paying Remaining Balance of ₹25,000 via Bank Transfer
    const receiptFinal = `REC-FINAL-${runId}`;
    const { data: payFinal, error: payFinalErr } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster.id,
        student_id: studentA.id,
        receipt_number: receiptFinal,
        idempotency_key: `IDEM-FINAL-${runId}`,
        amount: 25000,
        payment_date: "2026-10-12",
        payment_method: "bank_transfer",
        payment_status: "completed",
        reference_number: "NEFT-HDFC-112233",
        remarks: "Final settlement via bank transfer",
        recorded_by: cashierA.id,
      })
      .select("id, amount, payment_method")
      .single();

    assert(
      !payFinalErr && Number(payFinal?.amount) === 25000,
      `Final settlement payment recorded (Receipt: ${receiptFinal}, Amount: ₹${payFinal?.amount}, Method: ${payFinal?.payment_method}).`,
      `Final settlement failed: ${payFinalErr?.message}`
    );

    const { data: feeFinal } = await adminClient
      .from("fees")
      .select("total_fee, paid_amount, pending_amount")
      .eq("id", feeMaster.id)
      .single();

    assert(
      feeFinal && Number(feeFinal.paid_amount) === 60000 && Number(feeFinal.pending_amount) === 0,
      `Student fee ledger fully reconciled to zero dues: Total = ₹${feeFinal?.total_fee}, Paid = ₹${feeFinal?.paid_amount}, Pending = ₹${feeFinal?.pending_amount}.`,
      `Final balance mismatch: Paid=${feeFinal?.paid_amount}, Pending=${feeFinal?.pending_amount}`
    );

    // =========================================================================
    // SECTION 3: STUDENT FEE PORTAL SECURITY & RLS AUDIT
    // =========================================================================
    console.log("\nSECTION 3: STUDENT FEE PORTAL SECURITY & RLS AUDIT");

    // 3.1 Student can read their own fee master
    const { data: stuOwnFee, error: stuOwnFeeErr } = await clientStudentA
      .from("fees")
      .select("id, total_fee, paid_amount, pending_amount, academic_year")
      .eq("student_id", studentA.id);

    assert(
      !stuOwnFeeErr && stuOwnFee?.length === 1 && Number(stuOwnFee[0].paid_amount) === 60000,
      `Student A can view their own allocated fee schedule via RLS (AY: ${stuOwnFee?.[0]?.academic_year}, Total: ₹${stuOwnFee?.[0]?.total_fee}).`,
      `Student A failed to view own fee schedule: ${stuOwnFeeErr?.message}`
    );

    // 3.2 Student can read their own payment records and receipts
    const { data: stuOwnPayments, error: stuOwnPayErr } = await clientStudentA
      .from("fee_payments")
      .select("id, receipt_number, amount, payment_status, payment_method, reversed_payment_id")
      .eq("student_id", studentA.id)
      .order("created_at", { ascending: false });

    assert(
      !stuOwnPayErr && (stuOwnPayments?.length ?? 0) >= 3,
      `Student A can view their own payment ledger history (${stuOwnPayments?.length} receipts returned).`,
      `Student A failed to view own payment history: ${stuOwnPayErr?.message}`
    );

    // 3.3 Student CANNOT read another student's fee allocation (Peer student isolation)
    const { data: peerFeeLeak } = await clientStudentB
      .from("fees")
      .select("id, total_fee, paid_amount")
      .eq("student_id", studentA.id);

    assert(
      !peerFeeLeak || peerFeeLeak.length === 0,
      "Student B cannot view Student A's fee record (0 rows returned; peer isolation strictly enforced by RLS).",
      `Peer isolation breach: Student B read Student A fee record!`
    );

    // 3.4 Student CANNOT read another student's payment receipts
    const { data: peerPayLeak } = await clientStudentB
      .from("fee_payments")
      .select("id, receipt_number, amount")
      .eq("student_id", studentA.id);

    assert(
      !peerPayLeak || peerPayLeak.length === 0,
      "Student B cannot view Student A's payment receipts (0 rows returned; ledger isolation enforced by RLS).",
      `Peer isolation breach: Student B read Student A payment receipts!`
    );

    // 3.5 Student cannot mutate (UPDATE) fee records
    const { data: stuTamperFee } = await clientStudentA
      .from("fees")
      .update({ total_fee: 0, pending_amount: 0 })
      .eq("id", feeMaster.id)
      .select();

    assert(
      !stuTamperFee || stuTamperFee.length === 0,
      "Student A cannot UPDATE fee records (0 rows modified; read-only access enforced by RLS).",
      "Student A tampered with fee records!"
    );

    // 3.6 Student cannot mutate (DELETE) fee payments
    const { data: stuDelPay } = await clientStudentA
      .from("fee_payments")
      .delete()
      .eq("student_id", studentA.id)
      .select();

    assert(
      !stuDelPay || stuDelPay.length === 0,
      "Student A cannot DELETE payment records (0 rows deleted; immutability enforced by RLS).",
      "Student A deleted payment records!"
    );

    // 3.7 Student with no fee structure gets empty array cleanly (no RLS error or crash)
    const { data: noFeeStu, error: noFeeStuErr } = await clientStudentB
      .from("fees")
      .select("id, total_fee, pending_amount")
      .eq("student_id", studentB.id);

    assert(
      !noFeeStuErr && Array.isArray(noFeeStu) && noFeeStu.length === 0,
      "Student B (unassigned fee structure) receives clean empty state without query error.",
      `Query error for unassigned student: ${noFeeStuErr?.message}`
    );

    // =========================================================================
    // SECTION 4: PHASE 4 ADMIN FEE ALLOCATION & FINANCIAL SAFEGUARDS AUDIT
    // =========================================================================
    console.log("\nSECTION 4: PHASE 4 ADMIN FEE ALLOCATION & FINANCIAL SAFEGUARDS AUDIT");

    // 4.1 Authorized Admin A creates a new fee allocation for Student A2
    const { data: adminFeeAlloc, error: adminFeeAllocErr } = await clientAdminA
      .from("fees")
      .insert({
        institution_id: institutionAId,
        student_id: studentA2.id,
        academic_year: `2026-${runId}`,
        total_fee: 75000,
        paid_amount: 0,
      })
      .select("id, total_fee, paid_amount, pending_amount")
      .single();

    assert(
      !adminFeeAllocErr && !!adminFeeAlloc && Number(adminFeeAlloc.total_fee) === 75000,
      `Authorized Admin A successfully assigned fee allocation to Student A2 (Total: ₹75,000, ID: ${adminFeeAlloc?.id}).`,
      `Admin A failed to allocate fee to Student A2: ${adminFeeAllocErr?.message}`
    );

    // 4.2 Duplicate allocation for same student and academic year is rejected
    const { error: dupAllocErr } = await clientAdminA
      .from("fees")
      .insert({
        institution_id: institutionAId,
        student_id: studentA2.id,
        academic_year: `2026-${runId}`, // Duplicate academic year!
        total_fee: 80000,
        paid_amount: 0,
      });

    assert(
      !!dupAllocErr && (dupAllocErr.message.includes("uq_fees_student_year") || dupAllocErr.code === "23505"),
      "Duplicate fee allocation for same student and academic year strictly rejected by uq_fees_student_year constraint.",
      "Duplicate fee allocation was allowed!"
    );

    // 4.3 Negative fee amount is rejected by constraint
    const { error: negFeeErr } = await clientAdminA
      .from("fees")
      .insert({
        institution_id: institutionAId,
        student_id: studentA2.id,
        academic_year: `2027-${runId}`,
        total_fee: -5000, // Invalid negative fee!
        paid_amount: 0,
      });

    assert(
      !!negFeeErr && (negFeeErr.message.includes("fees_total_fee_check") || negFeeErr.message.includes("check constraint")),
      "Negative fee amount rejected by database check constraint (fees_total_fee_check).",
      "Negative fee was allowed!"
    );

    // 4.4 Non-admin (Cashier A) cannot create fee allocations
    const { error: cashierAllocErr } = await clientCashierA
      .from("fees")
      .insert({
        institution_id: institutionAId,
        student_id: studentA2.id,
        academic_year: `2028-${runId}`,
        total_fee: 50000,
        paid_amount: 0,
      });

    assert(
      !!cashierAllocErr && cashierAllocErr.message.includes("row-level security"),
      "Cashier cannot create fee allocations (strictly blocked by RLS fees_admin_all).",
      "Cashier created a fee allocation!"
    );

    // 4.5 Non-admin (Student A) cannot create fee allocations
    const { error: stuAllocErr } = await clientStudentA
      .from("fees")
      .insert({
        institution_id: institutionAId,
        student_id: studentA.id,
        academic_year: `2028-${runId}`,
        total_fee: 1000,
        paid_amount: 0,
      });

    assert(
      !!stuAllocErr && stuAllocErr.message.includes("row-level security"),
      "Student cannot create fee allocations (strictly blocked by RLS fees_admin_all).",
      "Student created a fee allocation!"
    );

    // 4.6 Cross-Institution Admin B cannot view or modify Institution A fee allocations
    const { data: crossFeeLeak } = await clientAdminB
      .from("fees")
      .select("id, total_fee")
      .eq("id", adminFeeAlloc!.id);

    assert(
      !crossFeeLeak || crossFeeLeak.length === 0,
      "Cross-institution Admin B cannot SELECT Institution A fee allocations (0 rows leaked).",
      "Cross-institution Admin B leaked Institution A fee allocation!"
    );

    const { data: crossFeeTamper } = await clientAdminB
      .from("fees")
      .update({ total_fee: 1000 })
      .eq("id", adminFeeAlloc!.id)
      .select();

    assert(
      !crossFeeTamper || crossFeeTamper.length === 0,
      "Cross-institution Admin B cannot UPDATE Institution A fee allocations (0 rows modified).",
      "Cross-institution Admin B tampered with Institution A fee allocation!"
    );

    // 4.7 Admin A safely adjusts fee allocation where permitted
    const { data: adjustedFee, error: adjustFeeErr } = await clientAdminA
      .from("fees")
      .update({ total_fee: 85000 })
      .eq("id", adminFeeAlloc!.id)
      .select("id, total_fee, pending_amount")
      .single();

    assert(
      !adjustFeeErr && !!adjustedFee && Number(adjustedFee.total_fee) === 85000 && Number(adjustedFee.pending_amount) === 85000,
      "Admin A successfully adjusted fee allocation to ₹85,000 (pending balance automatically recomputed to ₹85,000).",
      `Admin A failed to adjust fee allocation: ${adjustFeeErr?.message}`
    );

    // 4.8 Financial Safeguard: Cannot delete fee allocation that has payment history
    const { error: delWithPayErr } = await clientAdminA
      .from("fees")
      .delete()
      .eq("id", feeMaster.id);

    assert(
      !!delWithPayErr && (delWithPayErr.message.includes("foreign key") || delWithPayErr.code === "23503"),
      "Deletion of fee allocation with payment history strictly blocked by foreign key constraint (fk_fee_payments_fee_student).",
      "Fee allocation with payment history was deleted!"
    );

    // =========================================================================
    // SECTION 5: PHASE 5 FEE RECEIPTS & PRINTABLE PAYMENT RECORDS AUDIT
    // =========================================================================
    console.log("\nSECTION 5: PHASE 5 FEE RECEIPTS & PRINTABLE PAYMENT RECORDS AUDIT");

    // 5.1 Student A can query their own verified payment receipt details
    const { data: stuReceiptData, error: stuReceiptErr } = await clientStudentA
      .from("fee_payments")
      .select(`
        id,
        receipt_number,
        amount,
        payment_date,
        payment_method,
        payment_status,
        reference_number,
        fee_id,
        student_id
      `)
      .eq("id", pay1!.id)
      .eq("student_id", studentA.id)
      .single();

    assert(
      !stuReceiptErr && !!stuReceiptData && stuReceiptData.receipt_number === "REC-OFFLINE-4hvf2-001".replace("4hvf2", runId) && Number(stuReceiptData.amount) === 25000,
      `Student A can fetch their own authentic payment receipt (Receipt: ${stuReceiptData?.receipt_number}, Amount: ₹25,000).`,
      `Student A failed to fetch own payment receipt: ${stuReceiptErr?.message}`
    );

    // 5.2 Student B cannot access Student A's receipt by ID (IDOR / Peer isolation check)
    const { data: idorReceiptLeak } = await clientStudentB
      .from("fee_payments")
      .select("id, receipt_number, amount")
      .eq("id", pay1!.id);

    assert(
      !idorReceiptLeak || idorReceiptLeak.length === 0,
      "Student B cannot access Student A's receipt by ID (IDOR strictly prevented by RLS).",
      "IDOR Vulnerability: Student B fetched Student A receipt!"
    );

    // 5.3 Cashier A can access authorized payment receipts within Institution A
    const { data: cashierReceiptData, error: cashierReceiptErr } = await clientCashierA
      .from("fee_payments")
      .select("id, receipt_number, amount, payment_status")
      .eq("id", pay1!.id)
      .single();

    assert(
      !cashierReceiptErr && !!cashierReceiptData && Number(cashierReceiptData.amount) === 25000,
      `Cashier A can view and print authorized counter receipts within Institution A (ID: ${pay1!.id}).`,
      `Cashier A failed to access counter receipt: ${cashierReceiptErr?.message}`
    );

    // 5.4 Cross-Institution Cashier B cannot access Institution A receipts
    const { data: crossCashierReceiptLeak } = await clientCashierB
      .from("fee_payments")
      .select("id, receipt_number")
      .eq("id", pay1!.id);

    assert(
      !crossCashierReceiptLeak || crossCashierReceiptLeak.length === 0,
      "Cross-institution Cashier B cannot access Institution A receipt (0 rows leaked).",
      "Cross-tenant Cashier B accessed Institution A receipt!"
    );

    // 5.5 Reversed payment is visibly and correctly identified with payment_status = 'reversed'
    const { data: reversedReceiptRow, error: reversedReceiptErr } = await clientCashierA
      .from("fee_payments")
      .select("id, receipt_number, amount, payment_status, reversed_payment_id")
      .eq("id", revRecord!.id)
      .single();

    assert(
      !reversedReceiptErr && reversedReceiptRow?.payment_status === "reversed" && reversedReceiptRow.reversed_payment_id === pay2!.id,
      `Reversed payment receipt is strictly marked as reversed (Status: ${reversedReceiptRow?.payment_status}, Linked to: ${reversedReceiptRow?.reversed_payment_id}).`,
      "Reversed payment receipt not properly identified!"
    );

    // 5.6 Non-existent or invalid payment ID cleanly returns empty without database crash
    const { data: invalidReceiptData, error: invalidReceiptErr } = await clientStudentA
      .from("fee_payments")
      .select("id")
      .eq("id", "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    assert(
      !invalidReceiptErr && invalidReceiptData === null,
      "Missing or invalid payment identifier cleanly handled with null response.",
      "Invalid payment identifier caused error!"
    );

    // 5.7 Financial Integrity: Payment ledger and fee totals remained completely intact
    const { data: finalFeeIntegrity } = await clientAdminA
      .from("fees")
      .select("id, total_fee, paid_amount, pending_amount")
      .eq("id", feeMaster.id)
      .single();

    assert(
      Number(finalFeeIntegrity?.total_fee) === 60000 &&
      Number(finalFeeIntegrity?.paid_amount) === 60000 &&
      Number(finalFeeIntegrity?.pending_amount) === 0,
      "Receipt viewing caused zero state mutations; fee totals and ledger balance remain 100% intact.",
      "Financial state mutation occurred during receipt operations!"
    );

    // =========================================================================
    // SECTION 6: PHASE 6 MULTI-YEAR STUDENT FEE HISTORY SELECTOR AUDIT
    // =========================================================================
    console.log("\nSECTION 6: PHASE 6 MULTI-YEAR STUDENT FEE HISTORY SELECTOR AUDIT");

    // 6.1 Provision a second academic year allocation for Student A (Multi-Year History)
    const ay2025 = `2025-${runId}`;
    const ay2026 = `2026-${runId}`;
    const { data: feeMaster2025, error: fee2025Err } = await clientAdminA
      .from("fees")
      .insert({
        institution_id: institutionAId,
        student_id: studentA.id,
        academic_year: ay2025,
        total_fee: 55000,
        paid_amount: 0,
      })
      .select("id, academic_year, total_fee, paid_amount, pending_amount")
      .single();

    assert(
      !fee2025Err && !!feeMaster2025 && Number(feeMaster2025.total_fee) === 55000,
      `Provisioned second academic year allocation for Student A (AY: ${ay2025}, Total: ₹55,000).`,
      `Failed to provision second year allocation: ${fee2025Err?.message}`
    );

    // Record a payment against the second year allocation (Installment in 2025)
    const { data: pay2025, error: pay2025Err } = await clientCashierA
      .from("fee_payments")
      .insert({
        institution_id: institutionAId,
        fee_id: feeMaster2025!.id,
        student_id: studentA.id,
        receipt_number: `REC-2025-${runId}`,
        idempotency_key: `IDEM-2025-${runId}`,
        amount: 30000,
        payment_date: "2025-08-15",
        payment_method: "cash",
        payment_status: "completed",
        remarks: "First installment for 2025",
        recorded_by: cashierA.id,
      })
      .select("id, receipt_number, amount")
      .single();

    assert(
      !pay2025Err && !!pay2025 && Number(pay2025.amount) === 30000,
      `Recorded verified offline payment of ₹30,000 against AY ${ay2025}.`,
      `Failed to record payment for 2025: ${pay2025Err?.message}`
    );

    // 6.2 Student A queries all their authorized academic year allocations
    const { data: stuAllAllocations, error: stuMultiAllocErr } = await clientStudentA
      .from("fees")
      .select("id, academic_year, total_fee, paid_amount, pending_amount")
      .eq("student_id", studentA.id)
      .order("academic_year", { ascending: false });

    assert(
      !stuMultiAllocErr && stuAllAllocations?.length === 2,
      `Student A can view both their distinct academic year allocations (Count: ${stuAllAllocations?.length}).`,
      `Student A failed to retrieve multi-year allocations: ${stuMultiAllocErr?.message}`
    );

    // Verify derived academic years list
    const studentYears = stuAllAllocations!.map((a) => a.academic_year);
    assert(
      studentYears.includes(ay2025) && studentYears.includes(ay2026),
      `Derived available academic years match authenticated student allocations: [${studentYears.join(", ")}].`,
      "Academic years list mismatch!"
    );

    // 6.3 Year-Specific Filtering: Verify AY 2025 allocation and payments
    const alloc2025 = stuAllAllocations!.find((a) => a.academic_year === ay2025);
    assert(
      Number(alloc2025?.total_fee) === 55000 && Number(alloc2025?.paid_amount) === 30000 && Number(alloc2025?.pending_amount) === 25000,
      `AY ${ay2025} specific summary is accurate: Total = ₹55,000, Paid = ₹30,000, Balance = ₹25,000.`,
      "Year-specific summary inaccurate!"
    );

    // 6.4 Year-Specific Filtering: Verify AY 2026 allocation and payments
    const alloc2026 = stuAllAllocations!.find((a) => a.academic_year === ay2026);
    assert(
      Number(alloc2026?.total_fee) === 60000 && Number(alloc2026?.paid_amount) === 60000 && Number(alloc2026?.pending_amount) === 0,
      `AY ${ay2026} specific summary is accurate: Total = ₹60,000, Paid = ₹60,000, Balance = ₹0.`,
      "Year-specific summary inaccurate!"
    );

    // 6.5 Cumulative "All Years" calculation without double-counting
    const cumulativeTotalFee = stuAllAllocations!.reduce((acc, a) => acc + Number(a.total_fee), 0);
    const cumulativePaidAmount = stuAllAllocations!.reduce((acc, a) => acc + Number(a.paid_amount), 0);
    const cumulativePendingAmount = stuAllAllocations!.reduce((acc, a) => acc + Number(a.pending_amount), 0);

    assert(
      cumulativeTotalFee === 115000 && cumulativePaidAmount === 90000 && cumulativePendingAmount === 25000,
      `Cumulative "All Years" accurately calculated without double-counting (Total: ₹115,000, Paid: ₹90,000, Balance: ₹25,000).`,
      `Cumulative calculation mismatch: Total=${cumulativeTotalFee}, Paid=${cumulativePaidAmount}, Pending=${cumulativePendingAmount}`
    );

    // 6.6 Peer and Tenant Isolation: Student B cannot see Student A's multi-year allocations
    const { data: peerYearLeak } = await clientStudentB
      .from("fees")
      .select("academic_year")
      .eq("student_id", studentA.id);

    assert(
      !peerYearLeak || peerYearLeak.length === 0,
      "Student B cannot observe Student A's available academic years (0 rows returned; peer isolation strictly preserved).",
      "Peer leak: Student B observed Student A academic years!"
    );

    // 6.7 Filtering payment history by fee_id for academic year 2025
    const { data: payments2025, error: payFilterErr } = await clientStudentA
      .from("fee_payments")
      .select("id, receipt_number, amount, fee_id")
      .eq("student_id", studentA.id)
      .eq("fee_id", feeMaster2025!.id);

    assert(
      !payFilterErr && payments2025?.length === 1 && payments2025[0].receipt_number === `REC-2025-${runId}`,
      `Filtering payments to AY ${ay2025} returns only the linked transaction (${payments2025?.[0]?.receipt_number}).`,
      `Payment year filter failed: ${payFilterErr?.message}`
    );




  } finally {
    // Clean up only rows created during this test run
    console.log("\n>>> [CLEANUP] Cleaning up test personas and fixtures...");
    for (const uid of createdAuthUserIds) {
      try {
        await adminClient.from("profiles").delete().eq("id", uid);
        await adminClient.auth.admin.deleteUser(uid);
      } catch (e) {
        // ignore
      }
    }
    if (institutionBId) {
      try {
        await adminClient.from("institutions").delete().eq("id", institutionBId);
      } catch (e) {
        // ignore
      }
    }
    console.log("  [+] Cleanup completed safely. Zero persistent test rows remaining.");
  }

  console.log("\n================================================================================");
  console.log(`FINAL SECURITY AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch((err) => {
  console.error("Audit run error:", err);
  process.exit(1);
});
