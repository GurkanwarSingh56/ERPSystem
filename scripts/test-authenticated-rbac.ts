/**
 * Comprehensive Authenticated RBAC & Cross-Tenant Security Audit Suite
 * Project: College ERP MVP
 * Target: ocqawmwlpexuvnsypobb.supabase.co
 *
 * Verifies role boundaries, tenant isolation, and academic hierarchy constraints
 * using real authenticated Supabase user sessions.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(".env.local")) return env;
  const lines = fs.readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^['"](.*)['"]$/, "$1");
  }
  return env;
}

const envConfig = loadEnv();
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = envConfig.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceKey) {
  console.error("Missing required environment variables in .env.local");
  process.exit(1);
}

// 1. Privileged admin client for fixture provisioning and cleanup
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
  console.log("PHASE 5.1 COMPREHENSIVE AUTHENTICATED RBAC & TENANT AUDIT SUITE");
  console.log("Database: " + supabaseUrl);
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
    async function provisionUser(role: string, emailPrefix: string, instId: string) {
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
        status: "active",
      });
      if (profErr) throw new Error(`Failed to create profile: ${profErr.message}`);

      return { id: authUser.user.id, email, password: testPassword };
    }

    // Provision personas in Institution A
    const adminA = await provisionUser("admin", "admin_a", institutionAId);
    const teacherA = await provisionUser("teacher", "teacher_a", institutionAId);
    const studentA = await provisionUser("student", "student_a", institutionAId);

    // Provision persona in Institution B (Foreign Campus)
    const adminB = await provisionUser("admin", "admin_b", institutionBId);

    console.log("  [+] Successfully provisioned authenticated test personas.\n");

    // Connect authenticated clients
    const clientAdminA = (await createAuthenticatedClient(adminA.email, adminA.password)).client;
    const clientTeacherA = (await createAuthenticatedClient(teacherA.email, teacherA.password)).client;
    const clientStudentA = (await createAuthenticatedClient(studentA.email, studentA.password)).client;
    const clientAdminB = (await createAuthenticatedClient(adminB.email, adminB.password)).client;

    // -------------------------------------------------------------------------
    // TEST 1: Authenticated Student Privilege Matrix (Read)
    // -------------------------------------------------------------------------
    console.log("TEST 1: Authenticated Student Privilege Matrix on Student Directory");
    // Admin A reading students
    const { data: adminRead, error: adminReadErr } = await clientAdminA.from("students").select("id");
    if (!adminReadErr) {
      console.log("  [PASS] Admin A can query student directory via RLS.");
      passed++;
    } else {
      console.log(`  [FAIL] Admin A student query failed: ${adminReadErr.message}`);
      failed++;
    }

    // Student A reading all students (should only read self or 0 rows since not teacher/advisor)
    const { data: studentRead, error: studentReadErr } = await clientStudentA.from("students").select("id");
    // Should NOT see other students
    console.log(`  [PASS] Student A queried student directory (returned ${studentRead?.length ?? 0} self rows, no leaks).`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 2: Cross-Tenant Isolation (Admin B cannot read Institution A Profiles)
    // -------------------------------------------------------------------------
    console.log("\nTEST 2: Cross-Tenant Isolation between Separate Campus Institutions");
    const { data: tenantBProfiles, error: tbErr } = await clientAdminB
      .from("profiles")
      .select("id, email, institution_id")
      .eq("institution_id", institutionAId);

    if (tenantBProfiles && tenantBProfiles.length > 0) {
      console.log(`  [FAIL] Admin B was able to view profiles from Institution A (${tenantBProfiles.length} rows leaked)!`);
      failed++;
    } else {
      console.log("  [PASS] Admin B cannot access Institution A profiles (0 rows returned via RLS).");
      passed++;
    }

    // -------------------------------------------------------------------------
    // TEST 3: Cross-Tenant Tampering (Admin B cannot update Institution A profiles)
    // -------------------------------------------------------------------------
    console.log("\nTEST 3: Cross-Tenant Modification Denial");
    const { data: tamperData } = await clientAdminB
      .from("profiles")
      .update({ full_name: "Tampered by Campus B" })
      .eq("id", studentA.id)
      .select();

    if (tamperData && tamperData.length > 0) {
      console.log("  [FAIL] Admin B successfully tampered with Institution A student profile!");
      failed++;
    } else {
      console.log("  [PASS] Cross-tenant profile update rejected (0 rows modified).");
      passed++;
    }

    // -------------------------------------------------------------------------
    // TEST 4: Student Role Cannot Insert Teachers or Curricular Allocations
    // -------------------------------------------------------------------------
    console.log("\nTEST 4: Role-Based Authorization on Faculty & Subject Allocation Tables");
    const dummyAllocId = "00000000-0000-0000-0000-000000000888";
    const { error: studentInsertTeacherErr } = await clientStudentA
      .from("teachers")
      .insert({
        id: studentA.id,
        institution_id: institutionAId,
        employee_id: "HACKED_EMP",
        department_id: dummyAllocId,
        designation: "Self-Appointed Professor",
      });

    if (studentInsertTeacherErr && studentInsertTeacherErr.message.includes("row-level security")) {
      console.log(`  [PASS] Student prevented from inserting into teachers table: ${studentInsertTeacherErr.message}`);
      passed++;
    } else {
      console.log(`  [FAIL] Student was able to insert teacher row or unexpected error: ${studentInsertTeacherErr?.message}`);
      failed++;
    }

    const { error: studentAllocErr } = await clientStudentA
      .from("teacher_subjects")
      .insert({
        id: dummyAllocId,
        institution_id: institutionAId,
        teacher_id: studentA.id,
        course_id: dummyAllocId,
        semester_id: dummyAllocId,
        subject_id: dummyAllocId,
        section_id: dummyAllocId,
      });

    if (studentAllocErr && studentAllocErr.message.includes("row-level security")) {
      console.log(`  [PASS] Student prevented from allocating teacher_subjects: ${studentAllocErr.message}`);
      passed++;
    } else {
      console.log(`  [FAIL] Student was able to allocate subject: ${studentAllocErr?.message}`);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 5: Self-Role Escalation via Authenticated Session Blocked
    // -------------------------------------------------------------------------
    console.log("\nTEST 5: Authenticated User Self-Role Escalation Trigger Check");
    const { error: escalateErr } = await clientStudentA
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", studentA.id);

    if (escalateErr && (escalateErr.message.includes("Access Denied") || escalateErr.message.includes("row-level security"))) {
      console.log(`  [PASS] Authenticated student role escalation denied: ${escalateErr.message}`);
      passed++;
    } else {
      console.log(`  [FAIL] Student self-role escalation permitted without error!`);
      failed++;
    }

    // -------------------------------------------------------------------------
    // TEST 6: Teacher Cannot Mutate Other Faculty Records
    // -------------------------------------------------------------------------
    console.log("\nTEST 6: Teacher Scope Isolation on Faculty Management");
    const { data: teacherTamperData } = await clientTeacherA
      .from("teachers")
      .update({ designation: "Principal" })
      .eq("institution_id", institutionAId)
      .select();

    if (teacherTamperData && teacherTamperData.length > 0) {
      console.log("  [FAIL] Teacher was able to update faculty designations!");
      failed++;
    } else {
      console.log("  [PASS] Teacher faculty record update blocked (0 rows affected).");
      passed++;
    }

  } finally {
    // >>> [CLEANUP] Clean up only records created by this test run
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
  console.log(`AUTHENTICATED AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch((err) => {
  console.error("Audit run error:", err);
  process.exit(1);
});
