const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_KEY;

import { generateDepartmentTimetableAction } from "../src/app/actions/timetable";
import { createAdminClient } from "../src/lib/supabase/admin";

async function runDepartmentTimetableTest() {
  console.log("================================================================================");
  console.log("PHASE 14 DEPARTMENT-WIDE TIMETABLE SCHEDULING TEST");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  const supabase = createAdminClient();

  // Find real CSE department
  const { data: dept } = await supabase
    .from("departments")
    .select("id, name, code")
    .eq("code", "CSE")
    .single();

  assert(!!dept, `CSE department exists (id: ${dept?.id})`);

  if (!dept) {
    console.error("Cannot proceed without CSE department.");
    process.exit(1);
  }

  // Check timing slots
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("*")
    .order("slot_number", { ascending: true });

  assert(Boolean(slots && slots.length === 9), `9 college timing slots configured (found: ${slots?.length})`);
  const recessSlot = slots?.find((s) => s.slot_number === 5);
  assert(
    Boolean(recessSlot && recessSlot.is_break && recessSlot.start_time.startsWith("12:20")),
    `Recess slot begins at 12:20 PM and marked is_break=true`
  );

  // Execute Department-Wide Generation
  console.log("\n--- EXECUTING DEPARTMENT-WIDE SCHEDULE GENERATION ---");
  const genRes = await generateDepartmentTimetableAction({
    departmentId: dept.id,
    academicYear: "2026-2027",
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  });

  assert(Boolean(genRes.success), `Department timetable generation executed successfully: ${genRes.error || "OK"}`);
  assert(
    Boolean(genRes.data && genRes.data.successfulSections >= 4),
    `All 4 CSE sections generated successfully (success count: ${genRes.data?.successfulSections})`
  );

  // Verify Conflict Prevention across all generated sections
  console.log("\n--- CROSS-SECTION CONFLICT AUDIT ---");
  const { data: entries } = await supabase
    .from("timetable_entries")
    .select(`
      id,
      day_of_week,
      slot_number,
      subject_id,
      teacher_id,
      room_number,
      batch_group,
      timetables!inner (
        academic_year,
        section_id,
        sections (name)
      )
    `)
    .eq("timetables.academic_year", "2026-2027");

  assert(Boolean(entries && entries.length > 0), `Total timetable entries scheduled: ${entries?.length}`);

  // 1. Audit Teacher Collisions across sections
  const teacherDaySlot = new Map<string, string[]>();
  // 2. Audit Room Collisions across sections
  const roomDaySlot = new Map<string, string[]>();

  let teacherConflicts = 0;
  let roomConflicts = 0;

  for (const entry of entries || []) {
    const tKey = `${entry.teacher_id}_${entry.day_of_week}_${entry.slot_number}`;
    const rKey = `${entry.room_number}_${entry.day_of_week}_${entry.slot_number}`;

    const tList = teacherDaySlot.get(tKey) || [];
    tList.push(entry.id);
    teacherDaySlot.set(tKey, tList);
    if (tList.length > 1) teacherConflicts++;

    if (entry.room_number) {
      const rList = roomDaySlot.get(rKey) || [];
      rList.push(entry.id);
      roomDaySlot.set(rKey, rList);
      if (rList.length > 1) roomConflicts++;
    }
  }

  assert(teacherConflicts === 0, `Zero cross-section teacher collisions detected (conflicts: ${teacherConflicts})`);
  assert(roomConflicts === 0, `Zero cross-section room collisions detected (conflicts: ${roomConflicts})`);

  console.log("\n================================================================================");
  console.log(`TEST EXECUTION COMPLETE: Passed: ${passed} | Failed: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) process.exit(1);
}

runDepartmentTimetableTest();
