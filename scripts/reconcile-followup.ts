// Phase 14.4.2 follow-up. READ-ONLY. Reuses the verified backup + manifest; B.Voc excluded.
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { read, utils } from "xlsx";
import { parseOfficialWorkbook } from "../src/lib/timetable/import";
import { fetchAll } from "./backup-reconcile";

const dir = "backup/" + readdirSync("backup").filter((d) => d.startsWith("reconcile-")).sort()[0];
const J = (t: string) => JSON.parse(readFileSync(`${dir}/${t}.json`, "utf8")) as any[];
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8")).rows as any[];
const isBvoc = (s: string) => /B\s?VOC/i.test(s);

const wb = parseOfficialWorkbook(readFileSync("tt.xlsx"));
const cls = wb.entries["CLASS WISE"].filter((e) => !isBvoc(e.block));
const lab = wb.entries["LAB WISE"], fac = wb.entries["FACULTY"].filter((e) => !isBvoc(e.block));
const nRoom = (s: string) => s.replace(/\s+/g, "").toUpperCase();
const out: any = { generated: new Date().toISOString(), dir };

async function main() {
  // ---- 1. live drift vs backup ----
  const tables = ["courses", "semesters", "sections", "subjects", "teachers", "profiles", "teacher_subjects", "rooms", "timetable_entries"];
  const drift: Record<string, string> = {};
  const live: Record<string, any[]> = {};
  for (const t of tables) {
    live[t] = await fetchAll(t);
    const a = new Set(J(t).map((r) => JSON.stringify(r))), b = new Set(live[t].map((r) => JSON.stringify(r)));
    drift[t] = [...a].every((x) => b.has(x)) && a.size === b.size ? "unchanged" : "CHANGED";
  }
  out.drift = drift;

  // ---- 2. B.Voc exclusion ----
  const bvocBlocks = [...new Set(wb.entries["CLASS WISE"].filter((e) => isBvoc(e.block)).map((e) => e.block))];
  const bvocFacBlocks = [...new Set(wb.entries["FACULTY"].filter((e) => isBvoc(e.raw) || isBvoc(e.block)).map((e) => e.block))];
  const dbBvoc = live.courses.filter((c) => isBvoc(c.code + " " + c.name));
  out.bvoc = {
    excludedClassBlocks: bvocBlocks,
    excludedCellsInClassWise: wb.entries["CLASS WISE"].length - cls.length,
    dbCoursesMatching: dbBvoc.length,
    manifestRowsMentioningBvoc: manifest.filter((r) => isBvoc(JSON.stringify(r))).length,
    // faculty cells that teach B.Voc rows (their rooms/teachers are still needed only for non-B.Voc work)
    facultyBlocksTeachingBvoc: bvocFacBlocks,
  };

  // ---- 3. deletion candidates: live verification + dependencies ----
  const [att, marks] = [await fetchAll("attendance", "id,subject_id"), await fetchAll("marks", "id,subject_id")];
  const ids = manifest.filter((r) => ["ALLOCATION_SEMANTIC_DUPLICATE", "ALLOCATION_TEACHER_CONFLICT"].includes(r.type));
  const tsLive = new Map(live.teacher_subjects.map((r) => [r.id, r]));
  const sub = new Map(live.subjects.map((s) => [s.id, s]));
  const tch = new Map(live.profiles.map((p) => [p.id, p.full_name]));
  out.deletionCandidates = ids.map((r) => {
    const row = tsLive.get(r.record_id);
    const sid = row?.subject_id;
    return {
      teacher_subjects_id: r.record_id, existsNow: !!row, kind: r.type, current: r.current, proposed: r.proposed,
      subject: sid ? sub.get(sid).code : null,
      dependents: sid ? {
        attendance_on_subject: att.filter((a) => a.subject_id === sid).length,
        marks_on_subject: marks.filter((a) => a.subject_id === sid).length,
        timetable_entries_for_section_subject_teacher: live.timetable_entries.filter((e) => e.subject_id === sid && e.teacher_id === row.teacher_id && e.section_id === row.section_id).length,
      } : null,
    };
  });

  // ---- 4. missing rooms: type from evidence ----
  const roomsDb = new Set(live.rooms.map((r) => nRoom(r.room_number)));
  const used = new Map<string, { n: number; lab: number; blocks: Set<string>; subs: Set<string> }>();
  for (const e of [...cls, ...wb.entries["FACULTY"].filter((x) => !isBvoc(x.block))]) {
    if (!e.room) continue;
    const k = nRoom(e.room);
    const u = used.get(k) ?? used.set(k, { n: 0, lab: 0, blocks: new Set(), subs: new Set() }).get(k)!;
    u.n++; if (/LAB|PROJECT/i.test(e.subject) || ["G1", "G2"].includes(e.kind)) u.lab++;
    u.blocks.add(e.block); u.subs.add(e.subject);
  }
  out.roomCreation = [...used.entries()].filter(([k]) => !roomsDb.has(k)).map(([k, u]) => ({
    room_number: k, cells: u.n, labCells: u.lab, suggestedType: u.lab > u.n / 2 ? "lab" : "classroom",
    evidence: [...u.subs].slice(0, 6).join(", "), needs: "capacity (not in workbook)",
  }));
  // LAB WISE block headings vs rooms
  out.labWiseBlocks = [...new Set(lab.map((e) => e.block))].map((b) => ({ block: b, inDb: roomsDb.has(nRoom(b)) }));

  // ---- 5. missing faculty (unambiguous only) ----
  const sheet = read(readFileSync("tt.xlsx"), { type: "buffer" }).Sheets["FACULTY"];
  const rows = utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
  const loads: Record<string, string> = {};
  for (const r of rows) { const t = r.find((x) => /TOTAL LOAD/i.test(String(x))); if (t && r[0]) loads[String(r[0]).trim()] = String(t).replace(/\D+/g, ""); }
  out.facultyCreation = manifest.filter((r) => r.type === "FACULTY_INITIALS_MAP" && r.status === "TEACHER_MISSING_IN_DB").map((r) => {
    const m = r.proposed.match(/initials (\S+) = workbook faculty "([^"]+)"/);
    return { initials: m?.[1], workbook_name: m?.[2], workbook_total_load: loads[m?.[2] ?? ""] ?? null, evidence: r.evidence,
      missing: ["email (required, unique per institution)", "auth.users account (profiles.id FK)", "employee_id", "department", "designation", "min_load/max_load"],
      action: "BLOCKED until identity data supplied; do not create auth accounts implicitly" };
  });
  out.facultyPlaceholders = manifest.filter((r) => r.type === "FACULTY_INITIALS_MAP" && ["PLACEHOLDER_FACULTY", "SHARED_INSTITUTIONAL"].includes(r.status)).map((r) => r.proposed);

  // ---- 6. RK per class ----
  const facIdx = new Map<string, Set<string>>();
  for (const e of wb.entries["FACULTY"]) if (e.room) { const k = `${e.day}|${e.period}|${nRoom(e.room)}`; (facIdx.get(k) ?? facIdx.set(k, new Set()).get(k)!).add(e.block); }
  const rk: Record<string, Record<string, number>> = {};
  for (const e of cls.filter((x) => x.faculty === "RK")) {
    const set = facIdx.get(`${e.day}|${e.period}|${nRoom(e.room)}`);
    const key = `${e.block} :: ${e.subject}`;
    rk[key] ??= {};
    for (const n of set ?? ["(no FACULTY-sheet match)"]) rk[key][n] = (rk[key][n] ?? 0) + 1;
  }
  out.rkEvidence = rk;

  // ---- 7. joint / CS / DS / IOT block evidence ----
  const blockInfo = (re: RegExp) => {
    const es = cls.filter((e) => re.test(e.block));
    return { blocks: [...new Set(es.map((e) => e.block))], subjects: [...new Set(es.map((e) => `${e.subject}${e.kind ? "[" + e.kind + "]" : ""}:${e.faculty || "-"}`))].slice(0, 40) };
  };
  out.pendingBlockEvidence = {
    "CSE (B) & AIML 1ST": blockInfo(/CSE \(B\) & AIML 1ST/), "AIML (A)/(B) 1ST": blockInfo(/AIML \((A|B)\) 1ST/),
    "CSE (B)/IT 3RD": blockInfo(/CSE \(B\)\/IT 3RD/), "CS 5TH": blockInfo(/CS 5TH/), "DS 5TH": blockInfo(/DS 5TH/), "IOT 5TH": blockInfo(/IOT 5TH/),
  };

  // ---- 8. expected totals per applicable block (B.Voc excluded) ----
  const tot: any[] = [];
  for (const b of [...new Set(cls.map((e) => e.block))]) {
    const es = cls.filter((e) => e.block === b);
    const lect = es.filter((e) => e.kind === "L" || e.kind === "");
    const labs = es.filter((e) => e.kind !== "L" && e.kind !== "");
    // lab groups run in parallel: count distinct (day, period) lab slots
    const labSlots = new Set(labs.map((e) => `${e.day}|${e.period}|${e.subject}`));
    tot.push({ block: b, theorySubjects: new Set(lect.map((e) => e.subject)).size, theoryPeriodsPerWeek: lect.length,
      labSubjects: new Set(labs.map((e) => e.subject)).size, labSessionsPerWeek: labSlots.size });
  }
  out.expectedTotals = tot;
  out.expectedGrand = { blocks: tot.length, theoryPeriods: tot.reduce((a, b) => a + b.theoryPeriodsPerWeek, 0), labSessions: tot.reduce((a, b) => a + b.labSessionsPerWeek, 0) };

  writeFileSync(`${dir}/followup-14-4-2.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
main();
