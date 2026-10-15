import { createAcademicEntityManualAction } from "../src/app/actions/import";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_KEY;

const adminClient = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TARGET_INSTITUTION_ID = "00000000-0000-0000-0000-000000000001";

async function runManualEntryTests() {
  console.log("================================================================================");
  console.log("PHASE 14 MANUAL ACADEMIC ENTRY INTEGRATION TEST");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  const suffix = Math.random().toString(36).substring(2, 7).toUpperCase();

  // 1. Department Creation
  const { data: dept, error: dErr } = await adminClient
    .from("departments")
    .insert({
      institution_id: TARGET_INSTITUTION_ID,
      code: `D_${suffix}`,
      name: `Department of Testing ${suffix}`,
    })
    .select("id")
    .single();

  assert(!dErr && !!dept, "Manual Department creation succeeds in database");

  // 2. Course Creation
  const { data: course, error: cErr } = await adminClient
    .from("courses")
    .insert({
      institution_id: TARGET_INSTITUTION_ID,
      department_id: dept!.id,
      code: `C_${suffix}`,
      name: `Course of Testing ${suffix}`,
      duration_years: 4,
    })
    .select("id")
    .single();

  assert(!cErr && !!course, "Manual Course creation linked to parent department succeeds");

  // 3. Semester Creation
  const { data: semester, error: sErr } = await adminClient
    .from("semesters")
    .insert({
      institution_id: TARGET_INSTITUTION_ID,
      course_id: course!.id,
      semester_number: 1,
    })
    .select("id")
    .single();

  assert(!sErr && !!semester, "Manual Semester creation linked to parent course succeeds");

  // 4. Section Creation
  const { data: section, error: secErr } = await adminClient
    .from("sections")
    .insert({
      institution_id: TARGET_INSTITUTION_ID,
      course_id: course!.id,
      semester_id: semester!.id,
      name: "Section A",
    })
    .select("id")
    .single();

  assert(!secErr && !!section, "Manual Section creation linked to course & semester succeeds");

  // 5. Subject Creation
  const { data: subject, error: subErr } = await adminClient
    .from("subjects")
    .insert({
      institution_id: TARGET_INSTITUTION_ID,
      course_id: course!.id,
      semester_id: semester!.id,
      code: `SUB_${suffix}`,
      name: `Subject Testing ${suffix}`,
      type: "theory",
      weekly_hours: 4,
    })
    .select("id")
    .single();

  assert(!subErr && !!subject, "Manual Subject creation linked to course & semester succeeds");

  // Cleanup test entries
  await adminClient.from("subjects").delete().eq("id", subject!.id);
  await adminClient.from("sections").delete().eq("id", section!.id);
  await adminClient.from("semesters").delete().eq("id", semester!.id);
  await adminClient.from("courses").delete().eq("id", course!.id);
  await adminClient.from("departments").delete().eq("id", dept!.id);

  console.log("\n================================================================================");
  console.log(`TEST EXECUTION COMPLETE: Passed: ${passed} | Failed: ${failed}`);
  console.log("================================================================================\n");

  if (failed > 0) process.exit(1);
}

runManualEntryTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
