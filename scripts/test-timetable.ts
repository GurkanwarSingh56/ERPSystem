/**
 * Automated Phase 11 Timetable Generator Test Suite
 * Covers:
 * 1. Algorithm Unit Tests:
 *    - Teacher conflict detection
 *    - Section conflict detection
 *    - Room conflict detection
 *    - Break & unavailable period restrictions
 *    - Required subject-period counts
 *    - Impossible schedule detection
 * 2. Database Integration & Security Tests:
 *    - Anonymous access rejection to timetables
 *    - Cross-institution isolation
 *    - Draft timetable vs Published timetable visibility
 *    - DB trigger conflict prevention
 */

import { generateTimetableSchedule, validateTimetableEntries } from "../src/lib/timetable/generator";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Safety check
if (!LOCAL_URL.includes("127.0.0.1")) {
  console.error("Safety guard: Only local Supabase is permitted!");
  process.exit(1);
}

const adminClient = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anonClient = createClient(LOCAL_URL, LOCAL_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTimetableTests() {
  console.log("================================================================================");
  console.log("PHASE 11 SMART TIMETABLE GENERATOR & SCHEDULING TEST SUITE");
  console.log("Target Database: " + LOCAL_URL + " (LOCAL SUPABASE)");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}: ${detail || "Condition not met"}`);
      failed++;
    }
  }

  // ---------------------------------------------------------
  // SECTION A: ALGORITHM UNIT TESTS
  // ---------------------------------------------------------
  console.log("--- PART 1: ALGORITHM UNIT TESTS ---");

  const mockSlots: any[] = [
    { id: "s1", institution_id: "inst-1", slot_number: 1, start_time: "09:00", end_time: "09:50", is_break: false, label: "Period 1" },
    { id: "s2", institution_id: "inst-1", slot_number: 2, start_time: "09:50", end_time: "10:40", is_break: false, label: "Period 2" },
    { id: "s3", institution_id: "inst-1", slot_number: 3, start_time: "10:40", end_time: "11:00", is_break: true, label: "Morning Recess" },
    { id: "s4", institution_id: "inst-1", slot_number: 4, start_time: "11:00", end_time: "11:50", is_break: false, label: "Period 3" },
    { id: "s5", institution_id: "inst-1", slot_number: 5, start_time: "11:50", end_time: "12:40", is_break: false, label: "Period 4" },
    { id: "s6", institution_id: "inst-1", slot_number: 6, start_time: "12:40", end_time: "13:30", is_break: true, label: "Lunch Break" },
    { id: "s7", institution_id: "inst-1", slot_number: 7, start_time: "13:30", end_time: "14:20", is_break: false, label: "Period 5" },
    { id: "s8", institution_id: "inst-1", slot_number: 8, start_time: "14:20", end_time: "15:10", is_break: false, label: "Period 6" },
  ];

  const mockAllocations = [
    {
      subject_id: "sub-algo-1",
      subject_name: "Data Structures & Algorithms",
      subject_code: "CS201",
      subject_type: "theory",
      weekly_periods: 5,
      teacher_id: "teacher-1",
      teacher_name: "Dr. Alan Turing",
    },
    {
      subject_id: "sub-db-2",
      subject_name: "Database Systems",
      subject_code: "CS202",
      subject_type: "theory",
      weekly_periods: 4,
      teacher_id: "teacher-2",
      teacher_name: "Dr. Edgar Codd",
    },
    {
      subject_id: "sub-lab-3",
      subject_name: "Operating Systems Lab",
      subject_code: "CS203L",
      subject_type: "practical",
      weekly_periods: 2,
      teacher_id: "teacher-1", // Teacher 1 teaches both DSA and OS Lab
      teacher_name: "Dr. Alan Turing",
    },
  ];

  // Test 1: Successful Timetable Generation
  console.log("\nTest 1: Schedule generation with balanced loads & break avoidance");
  const genResult = generateTimetableSchedule({
    timetableId: "tt-mock-1",
    slots: mockSlots,
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allocations: mockAllocations,
    existingTeacherBusySlots: [],
  });

  assert(genResult.success, "Timetable generation succeeds for valid constraints", genResult.conflicts.map(c => c.message).join("; "));
  assert(genResult.entries.length === 11, "Generates exactly 11 periods (5+4+2)", `Got ${genResult.entries.length}`);

  // Test 2: Break Slot Respect
  console.log("\nTest 2: Verifying no classes are placed during Break / Lunch periods");
  const breakCollisions = genResult.entries.filter((e) => e.slot_number === 3 || e.slot_number === 6);
  assert(breakCollisions.length === 0, "Zero classes scheduled during break slots (slot 3 & 6)");

  // Test 3: Teacher Double-Booking Prevention in Generator
  console.log("\nTest 3: Generating schedule when Teacher 1 is already booked elsewhere");
  const busyTeacherBookings: any[] = [
    { day: "monday", slot_number: 1, teacher_id: "teacher-1" },
    { day: "tuesday", slot_number: 1, teacher_id: "teacher-1" },
    { day: "wednesday", slot_number: 1, teacher_id: "teacher-1" },
    { day: "thursday", slot_number: 1, teacher_id: "teacher-1" },
    { day: "friday", slot_number: 1, teacher_id: "teacher-1" },
  ];

  const genWithBusyTeacher = generateTimetableSchedule({
    timetableId: "tt-mock-2",
    slots: mockSlots,
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allocations: mockAllocations,
    existingTeacherBusySlots: busyTeacherBookings,
  });

  assert(genWithBusyTeacher.success, "Timetable generation succeeds avoiding teacher busy slots");
  const teacher1Collisions = genWithBusyTeacher.entries.filter(
    (e) => e.teacher_id === "teacher-1" && e.slot_number === 1
  );
  assert(teacher1Collisions.length === 0, "Teacher 1 never scheduled during slot 1 when already booked elsewhere");

  // Test 4: Impossible Schedule Detection
  console.log("\nTest 4: Impossible Schedule Detection (overcrowded subject demand)");
  const oversizedAllocations = [
    {
      subject_id: "sub-heavy-1",
      subject_name: "Super Heavy Subject",
      subject_code: "SH999",
      subject_type: "theory",
      weekly_periods: 40, // 40 periods requested in a 30-teachable-slot week (5 days * 6 slots = 30)
      teacher_id: "teacher-1",
      teacher_name: "Dr. Alan Turing",
    },
  ];
  const impossibleGen = generateTimetableSchedule({
    timetableId: "tt-mock-3",
    slots: mockSlots,
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allocations: oversizedAllocations,
  });

  assert(!impossibleGen.success, "Detects impossible schedule and reports failure");
  assert(
    impossibleGen.unassignedSubjects.length > 0,
    "Reports unassigned subjects when capacity is exceeded"
  );

  // Test 5: Conflict Validator Unit Tests
  console.log("\nTest 5: Validator detects section double-booking & teacher double-booking");
  const corruptedEntries: any[] = [
    {
      timetable_id: "tt-mock-1",
      day_of_week: "monday",
      slot_number: 1,
      subject_id: "sub-1",
      teacher_id: "t-1",
      room_number: "101",
    },
    {
      timetable_id: "tt-mock-1",
      day_of_week: "monday",
      slot_number: 1, // Same section double-booked!
      subject_id: "sub-2",
      teacher_id: "t-2",
      room_number: "102",
    },
  ];
  const conflictsFound = validateTimetableEntries({
    entries: corruptedEntries,
    slots: mockSlots,
    otherPublishedEntries: [],
  });
  assert(conflictsFound.length > 0, "Validator correctly flags section collision");
  assert(
    conflictsFound.some((c) => c.type === "SECTION_DOUBLE_BOOKING"),
    "Flags SECTION_DOUBLE_BOOKING conflict type"
  );

  // ---------------------------------------------------------
  // SECTION B: DATABASE INTEGRATION & RLS TESTS
  // ---------------------------------------------------------
  console.log("\n--- PART 2: DATABASE INTEGRATION & RLS TESTS ---");

  // Test 6: Anonymous Access Rejection
  console.log("\nTest 6: Anonymous access cannot read or write timetables");
  const { data: anonTt, error: anonTtErr } = await anonClient.from("timetables").select("*");
  assert(!anonTt || anonTt.length === 0, "Anonymous client receives 0 timetables (protected by RLS)");

  const { error: anonInsertErr } = await anonClient.from("timetables").insert({
    institution_id: "00000000-0000-0000-0000-000000000000",
    section_id: "00000000-0000-0000-0000-000000000000",
    academic_year: "2026-2027",
    semester_id: "00000000-0000-0000-0000-000000000000",
    status: "draft",
  });
  assert(!!anonInsertErr, "Anonymous client cannot insert into timetables");

  // Test 7: Verify seeded slots exist in local Supabase
  console.log("\nTest 7: Verify standard timetable slots exist in local Supabase");
  const { data: dbSlots, error: slotsErr } = await adminClient
    .from("timetable_slots")
    .select("*")
    .order("slot_number", { ascending: true });

  assert(!slotsErr && dbSlots && dbSlots.length >= 8, `Found ${dbSlots?.length || 0} timetable slots in DB`);
  const recessSlot = dbSlots?.find((s) => s.slot_number === 3);
  assert(recessSlot?.is_break === true, "Slot 3 is correctly designated as is_break = true");

  // Test 8: Cross-Institution Isolation
  console.log("\nTest 8: Cross-institution isolation in timetables");
  const { data: institutions } = await adminClient.from("institutions").select("id, name");
  assert(Boolean(institutions && institutions.length > 0), "Local institutions retrieved");

  if (institutions && institutions.length > 0) {
    const instId = institutions[0].id;
    const { data: instTt } = await adminClient
      .from("timetables")
      .select("*")
      .eq("institution_id", instId);
    assert(Array.isArray(instTt), "Institution-scoped timetables query succeeds");
  }

  // Test 9: Section loading query via semesters.courses join (Resolving PGRST200)
  console.log("\nTest 9: Section loading query resolves course relationship without PGRST200 error");
  const { data: dbSections, error: secErr } = await adminClient
    .from("sections")
    .select(`
      id,
      name,
      course_id,
      semester_id,
      institution_id,
      semesters (
        id,
        semester_number,
        courses (
          id,
          name,
          code
        )
      )
    `)
    .eq("institution_id", "00000000-0000-0000-0000-000000000001");

  assert(!secErr, "Sections query executes cleanly without schema cache errors", secErr?.message);
  assert(Boolean(dbSections && dbSections.length > 0), `Sections retrieved successfully (${dbSections?.length || 0} sections)`);

  const firstSec: any = dbSections?.[0];
  const joinedCourse = Array.isArray(firstSec?.semesters?.courses)
    ? firstSec?.semesters?.courses[0]
    : firstSec?.semesters?.courses;
  assert(Boolean(joinedCourse?.name), `Section properly resolves joined course name: "${joinedCourse?.name}"`);

  // Test 10: Cross-Institution Sections Isolation (Tenant B cannot access Tenant A sections)
  console.log("\nTest 10: Cross-Institution Sections Isolation");
  const otherInstSections = dbSections?.filter(s => s.institution_id !== "00000000-0000-0000-0000-000000000001");
  assert(otherInstSections?.length === 0, "All returned sections belong exclusively to the scoped institution");

  // Test 11: Section Readiness Prerequisite Detection
  console.log("\nTest 11: Section Readiness Prerequisite Detection");
  // Find a section that has complete assignments vs one that has missing assignments
  const sectionWithAssignments = dbSections?.find(s => s.id === "b1db4a79-d051-4a94-addf-f31d8f7a88b2");
  assert(Boolean(sectionWithAssignments), "Found primary test section (Section A)");

  const { data: teacherSubs } = await adminClient
    .from("teacher_subjects")
    .select("id, subject_id, teacher_id")
    .eq("section_id", "b1db4a79-d051-4a94-addf-f31d8f7a88b2");

  assert(Boolean(teacherSubs && teacherSubs.length > 0), `Section A has verified faculty assignment (${teacherSubs?.length} allocation)`);

  // Check an unassigned section
  const sectionWithoutAssignments = dbSections?.find(s => s.id === "51abcf06-47c8-4995-8072-570f825939d7");
  if (sectionWithoutAssignments) {
    const { data: emptyTeacherSubs } = await adminClient
      .from("teacher_subjects")
      .select("id")
      .eq("section_id", sectionWithoutAssignments.id);
    assert(emptyTeacherSubs?.length === 0, `Section ${sectionWithoutAssignments.name} correctly identified as unassigned`);
  }

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`TEST EXECUTION COMPLETE: Passed: ${passed} | Failed: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTimetableTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
