import { runOrToolsSolver, SolverPayload } from "../src/lib/timetable/pythonBridge";

async function testOrToolsConstraints() {
  console.log("================================================================================");
  console.log("PHASE 14.3 OR-TOOLS CP-SAT CONSTRAINT ENGINE TESTS");
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

  // TEST 1: Anti-repetition (No same theory subject >1 time per day)
  console.log("\n--- TEST 1: ANTI-REPETITION (MAX 1 THEORY PERIOD PER DAY) ---");
  const payload1: SolverPayload = {
    sections: [{ id: "sec-test", name: "CSE 5A" }],
    slots: [
      { slot_number: 1, is_break: false },
      { slot_number: 2, is_break: false },
      { slot_number: 3, is_break: false },
      { slot_number: 4, is_break: false },
      { slot_number: 5, is_break: true },
      { slot_number: 6, is_break: false },
      { slot_number: 7, is_break: false },
      { slot_number: 8, is_break: false },
      { slot_number: 9, is_break: false },
    ],
    rooms: [
      { id: "r-cls", room_number: "B-211", type: "classroom", is_available: true },
      { id: "r-lab", room_number: "CL-2", type: "lab", is_available: true },
    ],
    working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allocations: [
      {
        section_id: "sec-test",
        subject_id: "sub-wt",
        subject_name: "Web Technologies",
        subject_code: "CS505",
        subject_type: "theory",
        teacher_id: "fac-rk",
        teacher_name: "Er. Rajveer Kaur",
        weekly_hours: 3,
      },
    ],
    preferences: { max_theory_per_day: 1 },
  };

  const res1 = await runOrToolsSolver(payload1);
  assert(res1.status === "OPTIMAL", `Solver status is OPTIMAL (got ${res1.status})`);
  assert(res1.entries?.length === 3, `Scheduled exactly 3 theory periods (got ${res1.entries?.length})`);

  // Verify daily frequency
  const daysUsed = new Set(res1.entries?.map((e) => e.day_of_week));
  assert(daysUsed.size === 3, `All 3 periods placed on separate days (days: ${Array.from(daysUsed).join(", ")})`);

  // TEST 2: Consecutive 2-period Lab in Specialized Laboratory
  console.log("\n--- TEST 2: CONSECUTIVE 2-PERIOD LAB IN LAB FACILITY ---");
  const payload2: SolverPayload = {
    ...payload1,
    allocations: [
      {
        section_id: "sec-test",
        subject_id: "sub-wt-lab",
        subject_name: "Web Technologies Lab",
        subject_code: "CS505P",
        subject_type: "practical",
        teacher_id: "fac-rk",
        teacher_name: "Er. Rajveer Kaur",
        weekly_hours: 2,
        batch_group: "G1",
      },
    ],
  };

  const res2 = await runOrToolsSolver(payload2);
  assert(res2.status === "OPTIMAL", `Solver status is OPTIMAL for lab (got ${res2.status})`);
  assert(res2.entries?.length === 2, `Scheduled exactly 2 lab periods`);
  const labEntries = res2.entries || [];
  assert(labEntries[0]?.day_of_week === labEntries[1]?.day_of_week, `Both lab periods scheduled on the same day`);
  const s1 = labEntries[0]?.slot_number;
  const s2 = labEntries[1]?.slot_number;
  assert(Math.abs(s1 - s2) === 1, `Lab periods are strictly adjacent (slots ${s1} and ${s2})`);
  assert(labEntries[0]?.room_number === "CL-2", `Lab placed in dedicated laboratory CL-2`);

  // TEST 3: Infeasible Detection (Over-capacity)
  console.log("\n--- TEST 3: STRUCTURED INFEASIBILITY DIAGNOSTICS ---");
  const payload3: SolverPayload = {
    ...payload1,
    allocations: [
      {
        section_id: "sec-test",
        subject_id: "sub-excessive",
        subject_name: "Infinite Theory",
        subject_code: "INF101",
        subject_type: "theory",
        teacher_id: "fac-rk",
        teacher_name: "Er. Rajveer Kaur",
        weekly_hours: 50, // 5 days * 8 slots = 40 max
      },
    ],
  };

  const res3 = await runOrToolsSolver(payload3);
  assert(res3.status === "INFEASIBLE", `Solver detected INFEASIBLE schedule (got ${res3.status})`);
  assert(
    res3.diagnostics?.reason === "SECTION_CAPACITY_EXCEEDED",
    `Diagnostic identifies capacity overload: ${res3.diagnostics?.reason}`
  );

  console.log("\n================================================================================");
  console.log(`TEST EXECUTION COMPLETE: Passed: ${passed} | Failed: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) process.exit(1);
}

testOrToolsConstraints();
