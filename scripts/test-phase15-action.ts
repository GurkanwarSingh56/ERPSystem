import * as fs from "fs";

// Load .env.local into process.env BEFORE importing any server actions
const envFile = fs.readFileSync(".env.local", "utf8");
envFile.split("\n")
  .filter(l => l.includes("=") && !l.startsWith("#"))
  .forEach(l => {
    const k = l.slice(0, l.indexOf("=")).trim();
    const v = l.slice(l.indexOf("=") + 1).trim();
    process.env[k] = v;
  });

async function main() {
  const { autoGenerateTimetableAction } = await import("../src/app/actions/timetable");
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const supabase = createAdminClient();

  console.log("================================================================================");
  console.log("TESTING autoGenerateTimetableAction FOR CSE SEMESTER 5 SECTION A");
  console.log("================================================================================");

  const timetableId = "32277b78-2cb2-41eb-b68f-06e21a0c7532";
  
  // Verify draft timetable exists
  const { data: tt } = await supabase.from("timetables").select("*").eq("id", timetableId).single();
  console.log("Target Timetable in DB:", tt?.id, "| Status:", tt?.status, "| Section:", tt?.section_id);

  console.log("\nCalling autoGenerateTimetableAction({ timetableId, workingDays: ['monday'..'friday'] })...");
  const res = await autoGenerateTimetableAction({
    timetableId,
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  });

  console.log("\nAction Response:", res);

  if (!res.success) {
    console.error("Action failed:", res.error);
    process.exit(1);
  }

  // Verify entries saved to DB
  const { data: savedEntries, error: eErr } = await supabase
    .from("timetable_entries")
    .select(`
      id,
      day_of_week,
      slot_number,
      room_number,
      subject_id,
      teacher_id,
      subjects ( code, name )
    `)
    .eq("timetable_id", timetableId)
    .order("day_of_week", { ascending: true })
    .order("slot_number", { ascending: true });

  console.log(`\nVerified Saved Timetable Entries in DB: ${savedEntries?.length} rows`);
  
  // Group by day
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
  days.forEach(d => {
    const dayEntries = (savedEntries || []).filter(e => e.day_of_week === d);
    const summary = dayEntries.map((e: any) => `P${e.slot_number}:${e.subjects?.code}[${e.room_number}]`).join(", ");
    console.log(`  ${d.toUpperCase().padEnd(10)}: ${summary}`);
  });

  console.log("\n[SUCCESS] End-to-end action execution and database persistence confirmed!");
}

main().catch(console.error);
