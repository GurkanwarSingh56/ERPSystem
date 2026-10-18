import { generateDemoTimetableAction } from "../src/app/actions/timetable";
import { DEMO_SECTIONS, DEMO_ALLOCATIONS, DEMO_FACULTY, DEMO_ROOMS, DEMO_SLOTS } from "../src/lib/timetable/demoFixture";

async function runDemoTestSuite() {
  console.log("================================================================================");
  console.log("PHASE 14.4.3 SYNTHETIC DEMO TIMETABLE END-TO-END TEST SUITE");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(desc: string, cond: boolean) {
    if (cond) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Fixture properties
  console.log("\n--- PART 1: FIXTURE & ISOLATION AUDIT ---");
  assert("Demo has 8 sections (2 depts x 2 semesters x 2 sections)", DEMO_SECTIONS.length === 8);
  assert("Demo has 8 faculty with load caps", DEMO_FACULTY.length === 8 && DEMO_FACULTY.every(f => f.max_weekly_load > 0));
  assert("Demo has 4 classrooms and 2 labs", DEMO_ROOMS.length === 6 && DEMO_ROOMS.filter(r => r.type === "lab").length === 2);
  assert("Demo slots reflect official college hours (9 slots, slot 5 is lunch recess)", DEMO_SLOTS.length === 9 && DEMO_SLOTS[4].is_break === true);

  // 2. Action execution
  console.log("\n--- PART 2: SOLVER INVOCATION & TIMINGS ---");
  const t0 = Date.now();
  const res = await generateDemoTimetableAction();
  const elapsed = (Date.now() - t0) / 1000;

  assert("Action execution succeeds", res.success === true);
  assert("Action returns data object", !!res.data);
  const data = res.data!;
  assert("Solver status is OPTIMAL or FEASIBLE", data.solverStatus === "OPTIMAL" || data.solverStatus === "FEASIBLE");
  assert(`Solver solved in under 10s (got ${data.wallTimeSeconds.toFixed(2)}s, total ${elapsed.toFixed(2)}s)`, data.wallTimeSeconds < 10);
  assert(`Scheduled exact 144 periods (8 sections x 18 periods)`, data.totalPeriodsScheduled === 144);

  // 3. Collision and Constraint Checks
  console.log("\n--- PART 3: CONSTRAINT & COLLISION AUDIT ---");
  const entries = data.entries || [];
  const secBusy = new Set<string>();
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  let collisions = 0;

  for (const e of entries) {
    const timeKey = `${e.day_of_week}_${e.slot_number}`;
    const sKey = `${e.section_id}_${timeKey}`;
    const tKey = `${e.teacher_id}_${timeKey}`;
    const rKey = `${e.room_id}_${timeKey}`;

    if (secBusy.has(sKey)) collisions++;
    if (teacherBusy.has(tKey)) collisions++;
    if (roomBusy.has(rKey)) collisions++;

    secBusy.add(sKey);
    teacherBusy.add(tKey);
    roomBusy.add(rKey);
  }
  assert("Zero section, teacher, or room collisions", collisions === 0);

  // 4. Practical Lab Checks
  console.log("\n--- PART 4: LAB FACILITY & BLOCK PLACEMENT ---");
  const labEntries = entries.filter((e: any) => e.subjects?.type === "practical");
  assert("16 lab sessions scheduled (8 sections x 2-period lab block)", labEntries.length === 16);
  assert("All lab sessions scheduled in designated DEMO_LAB_01 or DEMO_LAB_02", labEntries.every((e: any) => ["DEMO_LAB_01", "DEMO_LAB_02"].includes(e.room_number)));

  // Check 2-period consecutive adjacency on same day
  const labsBySecDay = new Map<string, number[]>();
  for (const le of labEntries) {
    const k = `${le.section_id}_${le.day_of_week}`;
    const arr = labsBySecDay.get(k) || [];
    arr.push(le.slot_number);
    labsBySecDay.set(k, arr);
  }
  let adjacentLabs = true;
  for (const [, slots] of labsBySecDay.entries()) {
    slots.sort((a, b) => a - b);
    if (slots.length !== 2 || slots[1] !== slots[0] + 1) adjacentLabs = false;
  }
  assert("All lab blocks are strictly consecutive (slot N and N+1 on the same day)", adjacentLabs);

  // 5. Anti-Repetition Rule
  console.log("\n--- PART 5: ANTI-REPETITION (MAX 1 THEORY / DAY) ---");
  const theoryMap = new Map<string, number>();
  for (const e of entries) {
    if (e.subjects?.type === "theory") {
      const k = `${e.section_id}_${e.subject_id}_${e.day_of_week}`;
      theoryMap.set(k, (theoryMap.get(k) || 0) + 1);
    }
  }
  const maxTheoryPerDay = Math.max(...Array.from(theoryMap.values()));
  assert(`Maximum theory periods per subject per day is 1 (got max ${maxTheoryPerDay})`, maxTheoryPerDay <= 1);

  console.log("\n================================================================================");
  console.log(`TEST EXECUTION COMPLETE: Passed: ${passed} | Failed: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) process.exit(1);
}

runDemoTestSuite();
