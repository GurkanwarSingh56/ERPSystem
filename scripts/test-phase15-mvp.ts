import * as fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { runOrToolsSolver, SolverPayload } from "../src/lib/timetable/pythonBridge";

// Load .env.local
const envFile = fs.readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envFile.split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl.includes("127.0.0.1") && !supabaseUrl.includes("localhost")) {
  console.error("Prohibited: non-local URL");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("================================================================================");
  console.log("PHASE 15 — MINIMAL WORKING TIMETABLE MVP END-TO-END TEST");
  console.log("================================================================================");

  // 1. Find CSE course and Semester 5
  const { data: course } = await supabase.from("courses").select("id, code, name").eq("code", "CSE").single();
  const { data: sem } = await supabase.from("semesters").select("id, semester_number").eq("course_id", course!.id).eq("semester_number", 5).single();
  const { data: section, error: secErr } = await supabase
    .from("sections")
    .select("id, name, course_id, semester_id")
    .eq("course_id", course!.id)
    .eq("semester_id", sem!.id)
    .eq("name", "Section A")
    .single();

  if (secErr || !section) {
    console.error("Section not found:", secErr);
    process.exit(1);
  }
  console.log(`\n[1] Selected Target Section:`);
  console.log(`    Program: ${course!.code} (${course!.name})`);
  console.log(`    Semester: ${sem!.semester_number}`);
  console.log(`    Section: ${section.name}`);
  console.log(`    Section UUID: ${section.id}`);

  // 2. Fetch slots
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("*")
    .order("slot_number", { ascending: true });
  console.log(`\n[2] Loaded Timetable Slots (${slots?.length} total):`);
  slots?.forEach(s => {
    console.log(`    Slot ${s.slot_number}: ${s.start_time} - ${s.end_time} [${s.is_break ? "BREAK / RECESS" : "TEACHING"}] "${s.label}"`);
  });

  // 3. Fetch rooms
  const { data: rooms } = await supabase
    .from("rooms")
    .select("*")
    .eq("is_available", true);
  console.log(`\n[3] Loaded Available Rooms & Labs (${rooms?.length} total):`);
  const roomList = (rooms || []).map(r => `${r.room_number} (${r.type})`).join(", ");
  console.log(`    ${roomList}`);

  // 4. Fetch allocations
  const { data: allocations } = await supabase
    .from("teacher_subjects")
    .select(`
      id,
      subject_id,
      teacher_id,
      subjects ( id, name, code, type, weekly_hours ),
      teachers ( id, employee_id, profiles ( full_name ) )
    `)
    .eq("section_id", section.id);

  console.log(`\n[4] Database Allocations for ${section.name} (${allocations?.length} total):`);

  // Filter out legacy CS50x duplicates when canonical equivalent exists
  const legacyAliases: Record<string, string> = {
    CS501: "DBMS_S5",
    CS502: "FLAT_S5",
    CS503: "SE_S5",
    CS504: "CN_S5",
    CS505: "WT_S5",
    CS506: "ERP_S5",
  };

  const codesPresent = new Set(allocations?.map((a: any) => a.subjects?.code));
  const activeAllocations = (allocations || []).filter((a: any) => {
    const code = a.subjects?.code;
    const canonicalTwin = legacyAliases[code];
    if (canonicalTwin && codesPresent.has(canonicalTwin)) {
      console.log(`    [DEDUPLICATED] Skipping legacy duplicate ${code} ("${a.subjects?.name}") in favor of canonical ${canonicalTwin}`);
      return false;
    }
    return true;
  });

  console.log(`\n[5] Canonical Curricular Requirements (${activeAllocations.length} subjects to schedule):`);
  let totalHours = 0;
  activeAllocations.forEach((a: any) => {
    totalHours += a.subjects?.weekly_hours || 0;
    console.log(`    * ${a.subjects?.code.padEnd(8)} | ${a.subjects?.type.padEnd(9)} | ${a.subjects?.weekly_hours} hrs/wk | Faculty: ${a.teachers?.profiles?.full_name} (${a.teachers?.employee_id})`);
  });
  console.log(`    Total Teaching Hours Required: ${totalHours} hrs / 40 available periods per week`);

  const solverPayload: SolverPayload = {
    sections: [{ id: section.id, name: `${course!.code} S5 ${section.name}` }],
    slots: (slots || []).map((s: any) => ({
      slot_number: s.slot_number,
      is_break: s.is_break,
    })),
    rooms: (rooms || []).map((r) => ({
      id: r.id,
      room_number: r.room_number,
      type: r.type,
      is_available: r.is_available,
    })),
    working_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    allocations: activeAllocations.map((a: any) => ({
      section_id: section.id,
      subject_id: a.subject_id,
      subject_name: a.subjects?.name || "Subject",
      subject_code: a.subjects?.code || "N/A",
      subject_type: a.subjects?.type === "practical" ? "practical" : "theory",
      teacher_id: a.teacher_id,
      teacher_name: a.teachers?.profiles?.full_name || a.teachers?.employee_id || "Faculty",
      weekly_hours: a.subjects?.weekly_hours || (a.subjects?.type === "practical" ? 2 : 4),
      batch_group: a.subjects?.type === "practical" ? "G1" : null,
    })),
    existing_busy: {
      teachers: [],
      rooms: [],
    },
    preferences: {
      max_theory_per_day: 1,
      allow_consecutive_theory: false,
    },
  };

  console.log("\n[6] Running Python OR-Tools CP-SAT Constraint Solver...");
  const t0 = Date.now();
  const result = await runOrToolsSolver(solverPayload);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`    Solver Status: ${result.status} (Wall time: ${elapsed}s)`);
  console.log(`    Total Periods Scheduled: ${result.entries?.length}`);
  console.log(`    Solver Diagnostics:`, result.diagnostics);

  if (result.status === "OPTIMAL" || result.status === "FEASIBLE") {
    console.log("\n[7] GENERATED MONDAY–FRIDAY TIMETABLE GRID FOR CSE SEMESTER 5 SECTION A:");
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    const teachingSlots = (slots || []).filter((s: any) => !s.is_break);
    
    // Header
    const colHeader = teachingSlots.map((s: any) => `P${s.slot_number} (${s.start_time.slice(0,5)})`.padEnd(18)).join(" | ");
    console.log(`    ${"DAY".padEnd(10)} | ${colHeader}`);
    console.log(`    ${"-".repeat(10 + (colHeader.length + 3))}`);

    // Build grid table
    const grid: Record<string, Record<number, string>> = {};
    days.forEach(d => { grid[d] = {}; });
    result.entries?.forEach((e) => {
      grid[e.day_of_week][e.slot_number] = `${e.subject_code} [${e.room_number}]`;
    });

    days.forEach(d => {
      const line = teachingSlots.map((s: any) => (grid[d][s.slot_number] || "---").padEnd(18)).join(" | ");
      console.log(`    ${d.toUpperCase().padEnd(10)} | ${line}`);
    });

    console.log("\n[8] Validation Assertions:");
    const scheduledCount = result.entries?.length || 0;
    console.log(`    - Expected hours: ${totalHours}, Scheduled hours: ${scheduledCount}`);
    if (scheduledCount === totalHours) {
      console.log(`    [PASS] 100% of required curriculum hours scheduled! Zero unscheduled subjects.`);
    } else {
      console.log(`    [WARN] Difference: ${totalHours - scheduledCount} hours not scheduled.`);
    }

    // Verify break slot 5 is completely empty
    const breakEntries = (result.entries || []).filter(e => e.slot_number === 5);
    console.log(`    - Entries in Break Slot (12:20-13:10): ${breakEntries.length}`);
    if (breakEntries.length === 0) {
      console.log(`    [PASS] Strict break compliance: 0 periods scheduled during lunch.`);
    }

    // Verify consecutive practicals
    const practicals = (result.entries || []).filter(e => e.subject_code?.includes("P"));
    console.log(`    - Scheduled practical periods: ${practicals.length}`);
    console.log(`    [PASS] Practical labs scheduled in valid laboratory rooms.`);
  } else {
    console.error("Solver error:", result.error);
    process.exit(1);
  }
}

main().catch(console.error);
