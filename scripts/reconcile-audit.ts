// Read-only reconciliation: official workbook vs local Supabase snapshot. Writes only to backup/.
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { parseOfficialWorkbook, OfficialEntry } from "../src/lib/timetable/import";
import { fetchAll } from "./backup-reconcile";

const snapDir = "backup/" + readdirSync("backup").filter((d) => d.startsWith("reconcile-")).sort().pop();
const J = (t: string) => JSON.parse(readFileSync(`${snapDir}/${t}.json`, "utf8")) as any[];

const wb = parseOfficialWorkbook(readFileSync("tt.xlsx"));
const classE = wb.entries["CLASS WISE"];
const labE = wb.entries["LAB WISE"];
const facE = wb.entries["FACULTY"];

// ---------- DB indexes ----------
const courses = J("courses"), semesters = J("semesters"), sections = J("sections");
const subjects = J("subjects"), teachers = J("teachers"), profiles = J("profiles");
const tsub = J("teacher_subjects"), rooms = J("rooms");
const courseCode = Object.fromEntries(courses.map((c) => [c.id, c.code as string]));
const semNo = Object.fromEntries(semesters.map((s) => [s.id, s.semester_number as number]));
const profName = Object.fromEntries(profiles.map((p) => [p.id, p.full_name as string]));
const secLabel = (s: any) => `${courseCode[s.course_id]} S${semNo[s.semester_id]} ${s.name.replace("Section ", "")}`;
const secById = Object.fromEntries(sections.map((s) => [s.id, s]));
const subById = Object.fromEntries(subjects.map((s) => [s.id, s]));
const tchById = Object.fromEntries(teachers.map((t) => [t.id, { ...t, name: profName[t.id] ?? profName[t.profile_id] ?? "?" }]));

const manifest: any[] = [];
let seq = 0;
const add = (r: any) => manifest.push({ row: ++seq, ...r });

// ---------- normalisers ----------
const nRoom = (s: string) => s.replace(/\s+/g, "").toUpperCase();
const nSub = (s: string) => s.toUpperCase().replace(/\bLAB\b/g, "").replace(/[^A-Z0-9]/g, "");
const stripTitle = (s: string) =>
  s.toUpperCase().replace(/\b(DR|ER|MR|MS|MRS|PROF)\b\.?/g, "").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const PSEUDO = new Set(["HVPE", "EVS", "NCER", "SETUP&LAUNCH(ENP)", "OPS"]);

// ---------- 1. block -> DB section mapping ----------
type BlockMap = { block: string; status: string; targets: string[]; note: string };
function mapBlock(block: string): BlockMap {
  const b = block.toUpperCase();
  if (/M\.TECH|B VOC/.test(b)) return { block, status: "NO_DB_TARGET", targets: [], note: "No M.Tech/B.Voc course in DB" };
  const sem = Number((b.match(/(\d)(ST|ND|RD|TH)/) || b.match(/-(\d)\(/) || [])[1]);
  const sec = (b.match(/\(([AB])\)/) || [])[1];
  const progs: string[] = [];
  if (/CS\/DS/.test(b)) progs.push("CS/DS");
  if (/AIML/.test(b)) progs.push("AI/ML");
  if (/\bIT\b/.test(b)) progs.push("IT");
  if (/\bIOT\b/.test(b)) progs.push("IOT");
  if (/CSE/.test(b)) progs.push("CSE");
  if (!progs.length && /\bCS\b/.test(b)) progs.push("CS");
  if (!progs.length && /\bDS\b/.test(b)) progs.push("DS");
  const find = (code: string, s?: string) =>
    sections.filter((x) => courseCode[x.course_id] === code && semNo[x.semester_id] === sem && (!s || x.name === `Section ${s}`));
  const targets: string[] = [];
  const notes: string[] = [];
  let status = "EXACT";
  for (const p of progs) {
    if (["IOT", "CS", "DS"].includes(p)) {
      const alt = p === "IOT" ? [] : find("CS/DS");
      status = "AMBIGUOUS";
      notes.push(p === "IOT" ? "IOT: no IOT course in DB" : `${p}: DB has combined CS/DS course, workbook has separate CS and DS blocks`);
      alt.forEach((a) => targets.push(a.id));
      continue;
    }
    const want = p === "CSE" ? sec : p === "AI/ML" ? sec : undefined;
    const hit = find(p, want);
    if (!hit.length) { status = status === "EXACT" ? "NO_DB_TARGET" : status; notes.push(`${p} S${sem}${want ? " " + want : ""}: no section in DB`); continue; }
    if (hit.length > 1 && !want) { status = "AMBIGUOUS"; notes.push(`${p} S${sem}: multiple sections`); }
    hit.forEach((h) => targets.push(h.id));
  }
  if (progs.length > 1 && status === "EXACT") { status = "JOINT"; notes.push("Joint class across programs"); }
  if (!progs.length) { status = "NO_DB_TARGET"; notes.push("Unrecognised program"); }
  return { block, status, targets, note: notes.join("; ") };
}
const blockNames = [...new Set(classE.map((e) => e.block))];
const blockMap = Object.fromEntries(blockNames.map((b) => [b, mapBlock(b)]));
for (const b of blockNames) {
  const m = blockMap[b];
  add({ type: "CLASS_HEADING_MAP", table: "sections", record_id: m.targets.join(",") || null, current: m.targets.map((t) => secLabel(secById[t])).join(" | ") || "(none)",
    proposed: m.status === "EXACT" ? "no change" : m.status === "NO_DB_TARGET" ? "CREATE section/course (needs decision)" : "needs decision", evidence: `CLASS WISE heading "${b}"`,
    confidence: m.status === "EXACT" ? "high" : "low", status: m.status, note: m.note });
}

// ---------- 2. faculty initials via (day, period, room) evidence ----------
const facIdx = new Map<string, Set<string>>();
for (const e of facE) {
  if (!e.room) continue;
  const k = `${e.day}|${e.period}|${nRoom(e.room)}`;
  (facIdx.get(k) ?? facIdx.set(k, new Set()).get(k)!).add(e.block);
}
const initialsRe = /^[A-Z]{2,4}$/;
const votes = new Map<string, Map<string, number>>();
const facOf = (e: OfficialEntry) => facIdx.get(`${e.day}|${e.period}|${nRoom(e.room)}`);
for (const e of classE) {
  if (!initialsRe.test(e.faculty)) continue;
  const set = facOf(e);
  if (!set) continue;
  const m = votes.get(e.faculty) ?? votes.set(e.faculty, new Map()).get(e.faculty)!;
  for (const name of set) m.set(name, (m.get(name) ?? 0) + 1);
}
const dbTeacherByName = (facName: string) => {
  const s = stripTitle(facName);
  const first = s.split(" ")[0];
  const exact = Object.values(tchById).filter((t: any) => stripTitle(t.name) === s);
  if (exact.length === 1) return { t: exact[0] as any, how: "exact name" };
  const pref = Object.values(tchById).filter((t: any) => stripTitle(t.name).startsWith(s) || s.startsWith(stripTitle(t.name)));
  if (pref.length === 1) return { t: pref[0] as any, how: "name prefix" };
  return { t: null as any, how: pref.length > 1 ? "ambiguous" : "none" };
};
const initialsToTeacher: Record<string, { facName: string | null; teacher: any; conf: string; note: string }> = {};
for (const [ini, m] of votes) {
  const ranked = [...m.entries()].sort((a, b) => b[1] - a[1]);
  const total = classE.filter((e) => e.faculty === ini && facOf(e)).length;
  const [top, topN] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  // ambiguous when a second person accounts for >=3 cells or >=25% (1-cell noise = FACULTY/CLASS sheet disagreement)
  const ambiguous = second >= 3 || second / total >= 0.25;
  const unique = !ambiguous && (ranked.length === 1 || second < topN);
  const full = topN === total;
  const { t, how } = dbTeacherByName(top);
  initialsToTeacher[ini] = {
    facName: unique ? top : null, teacher: unique ? t : null,
    conf: unique && full && t ? "high" : unique && t ? "medium" : "low",
    note: `${topN}/${total} cells match "${top}"${ranked.length > 1 ? "; also " + ranked.slice(1, 4).map((r) => `${r[0]}(${r[1]})`).join(", ") : ""}; DB match: ${how}${ambiguous ? "; AMBIGUOUS INITIALS shared by multiple people" : ""}`,
    ambiguous,
  } as any;
}
const allInitials = [...new Set(classE.map((e) => e.faculty).filter((f) => initialsRe.test(f)))];
for (const ini of allInitials) {
  const r: any = initialsToTeacher[ini];
  const pseudo = r?.facName && PSEUDO.has(r.facName.toUpperCase());
  const placeholder = r?.facName && /^NF-\d+$/i.test(r.facName);
  add({ type: "FACULTY_INITIALS_MAP", table: "teachers", record_id: r?.teacher?.id ?? null, current: r?.teacher ? `${r.teacher.employee_id} ${r.teacher.name}` : `(no DB teacher for "${ini}")`,
    proposed: r?.ambiguous ? `initials ${ini} AMBIGUOUS – cannot map` : r?.teacher ? `initials ${ini} = ${r.teacher.employee_id}` : pseudo ? `initials ${ini} -> shared block "${r.facName}"` : r?.facName ? `initials ${ini} = workbook faculty "${r.facName}" (not in DB, needs import)` : `initials ${ini}: UNRESOLVED – no evidence`,
    evidence: r ? r.note : "no matching FACULTY-sheet cell at same day/period/room", confidence: r?.ambiguous ? "none" : r?.conf ?? "none",
    status: r?.ambiguous ? "AMBIGUOUS" : r?.teacher ? "MAPPED" : pseudo ? "SHARED_INSTITUTIONAL" : placeholder ? "PLACEHOLDER_FACULTY" : r?.facName ? "TEACHER_MISSING_IN_DB" : "UNRESOLVED" });
}

// ---------- 3. the 42 lecture entries without initials ----------
const noFac = classE.filter((e) => e.kind === "L" && !initialsRe.test(e.faculty));
const fsplit: Record<string, number> = { SHARED_INSTITUTIONAL: 0, RESOLVED_VIA_FACULTY_SHEET: 0, UNRESOLVED: 0 };
for (const e of noFac) {
  const set = facOf(e);
  const names = set ? [...set] : [];
  const pseudo = names.filter((n) => PSEUDO.has(n.toUpperCase()));
  const real = names.filter((n) => !PSEUDO.has(n.toUpperCase()));
  let status = "UNRESOLVED", proposed = "needs decision", conf = "none", evid = "No FACULTY-sheet cell at same day/period/room";
  if (pseudo.length && !real.length) { status = "SHARED_INSTITUTIONAL"; proposed = `shared subject block "${pseudo[0]}" (no individual teacher)`; conf = "high"; evid = `FACULTY sheet block "${pseudo[0]}" occupies same day/period/room`; }
  else if (real.length === 1) { const { t } = dbTeacherByName(real[0]); status = "RESOLVED_VIA_FACULTY_SHEET"; proposed = t ? `teacher ${t.employee_id} ${t.name}` : `"${real[0]}" (not in DB)`; conf = t ? "medium" : "low"; evid = `FACULTY block "${real[0]}" at same day/period/room; initials missing in class cell`; }
  else if (real.length > 1) { evid = `Ambiguous FACULTY blocks: ${real.join(", ")}`; }
  fsplit[status]++;
  add({ type: "LECTURE_WITHOUT_INITIALS", table: "teacher_subjects", record_id: null, current: `${e.block} ${e.day} P${e.period} ${e.raw.replace(/\s+/g, " ")}`, proposed, evidence: evid, confidence: conf, status });
}

// ---------- 4. subject mapping ----------
const subByKey = new Map<string, any[]>();
for (const s of subjects) {
  const k = `${courseCode[s.course_id]}|${semNo[s.semester_id]}|${s.code}`;
  (subByKey.get(k) ?? subByKey.set(k, []).get(k)!).push(s);
}
const sectionSem = (sid: string) => ({ course: courseCode[secById[sid].course_id], sem: semNo[secById[sid].semester_id] });
function findSubject(e: OfficialEntry, sid: string) {
  const { course, sem } = sectionSem(sid);
  const code = nSub(e.subject);
  const lab = /LAB/i.test(e.subject) || ["G1", "G2"].includes(e.kind);
  const hits = subByKey.get(`${course}|${sem}|${code}_S${sem}`) ?? [];
  return { hits, lab, key: `${code}_S${sem}` };
}

// ---------- 5. required allocations from CLASS WISE ----------
type Req = { sid: string; subId: string | null; subKey: string; teacherId: string | null; ini: string; lab: boolean; periods: number; blocks: Set<string> };
const req = new Map<string, Req>();
const roomsDb = new Set(rooms.map((r) => nRoom(r.room_number)));
const missingRooms = new Map<string, number>();
const missingSubjects = new Map<string, number>();
for (const e of classE) {
  const m = blockMap[e.block];
  if (e.room && !roomsDb.has(nRoom(e.room))) missingRooms.set(nRoom(e.room), (missingRooms.get(nRoom(e.room)) ?? 0) + 1);
  if (m.status !== "EXACT") continue; // only unambiguous blocks produce allocations
  for (const sid of m.targets) {
    const { hits, lab, key } = findSubject(e, sid);
    if (lab) continue; // labs handled separately below
    const subId = hits.length === 1 ? hits[0].id : null;
    if (!subId) missingSubjects.set(`${secLabel(secById[sid])} ${key}`, (missingSubjects.get(`${secLabel(secById[sid])} ${key}`) ?? 0) + 1);
    const tid = initialsRe.test(e.faculty) ? initialsToTeacher[e.faculty]?.teacher?.id ?? null : null;
    const k = `${sid}|${subId ?? key}|${tid ?? e.faculty}`;
    const r = req.get(k) ?? req.set(k, { sid, subId, subKey: key, teacherId: tid, ini: e.faculty, lab, periods: 0, blocks: new Set() }).get(k)!;
    r.periods++;
    r.blocks.add(e.block);
  }
}
for (const [room, n] of missingRooms) add({ type: "ROOM_MISSING", table: "rooms", record_id: null, current: "(absent)", proposed: `INSERT room ${room}`, evidence: `${n} CLASS WISE cells use ${room}`, confidence: "high", status: "MISSING" });
for (const [k, n] of missingSubjects) add({ type: "SUBJECT_MISSING", table: "subjects", record_id: null, current: "(absent)", proposed: `INSERT subject for ${k}`, evidence: `${n} CLASS WISE cells`, confidence: "medium", status: "MISSING" });

// ---------- 6. compare with teacher_subjects ----------
const tsKey = (r: any) => `${r.section_id}|${r.subject_id}|${r.teacher_id}`;
const have = new Map<string, any[]>();
for (const r of tsub) (have.get(tsKey(r)) ?? have.set(tsKey(r), []).get(tsKey(r))!).push(r);
const wanted = new Set<string>();
for (const r of req.values()) {
  if (!r.subId || !r.teacherId) {
    add({ type: "ALLOCATION_UNRESOLVED", table: "teacher_subjects", record_id: null, current: "(n/a)", proposed: !r.subId ? `needs subject ${r.subKey}` : `needs teacher for initials "${r.ini}"`,
      evidence: `${secLabel(secById[r.sid])} ${r.periods} periods/wk`, confidence: "none", status: "BLOCKED" });
    continue;
  }
  const k = `${r.sid}|${r.subId}|${r.teacherId}`;
  wanted.add(k);
  if (!have.has(k)) add({ type: "ALLOCATION_MISSING", table: "teacher_subjects", record_id: null, current: "(absent)", proposed: `INSERT ${tchById[r.teacherId].name} -> ${subById[r.subId].code} -> ${secLabel(secById[r.sid])}`,
    evidence: `${r.periods} periods/wk in ${[...r.blocks].join("; ")}`, confidence: initialsToTeacher[r.ini]?.conf ?? "low", status: "MISSING" });
}

// exact duplicate rows
for (const [k, rows] of have) if (rows.length > 1) rows.slice(1).forEach((r) => add({ type: "ALLOCATION_EXACT_DUPLICATE", table: "teacher_subjects", record_id: r.id, current: `dup of ${rows[0].id}`, proposed: "DELETE duplicate row", evidence: "identical section/subject/teacher", confidence: "high", status: "DUPLICATE" }));

// DB rows not in workbook + legacy-subject usage
const legacy = subjects.filter((s) => !/_S\d$/.test(s.code));
const legacyIds = new Set(legacy.map((s) => s.id));
const wantedBySecSub = new Map<string, Set<string>>();
for (const k of wanted) { const [a, b, c] = k.split("|"); (wantedBySecSub.get(`${a}|${b}`) ?? wantedBySecSub.set(`${a}|${b}`, new Set()).get(`${a}|${b}`)!).add(c); }
const aliasHigh: Record<string, string> = { CS501: "DBMS_S5", CS502: "FLAT_S5", CS503: "SE_S5", CS504: "CN_S5", CS505: "WT_S5", CS506: "ERP_S5" };
for (const r of tsub) {
  const k = tsKey(r);
  if (wanted.has(k)) continue;
  const s = subById[r.subject_id], sec = secById[r.section_id], t = tchById[r.teacher_id];
  const cur = `${t?.name} -> ${s?.code} -> ${sec ? secLabel(sec) : "?"}`;
  const want = wantedBySecSub.get(`${r.section_id}|${r.subject_id}`);
  if (want) {
    add({ type: "ALLOCATION_TEACHER_CONFLICT", table: "teacher_subjects", record_id: r.id, current: cur, proposed: `DELETE (workbook teacher: ${[...want].map((x) => tchById[x].name).join(", ")})`,
      evidence: "workbook cells for this section+subject carry a different teacher", confidence: "high", status: "CONFLICT" });
    continue;
  }
  const twin = aliasHigh[(s?.code ?? "").replace(/P$/, "")];
  const twinSub = twin && sec ? subjects.find((x) => x.code === twin && x.semester_id === sec.semester_id) : null;
  const twinRows = twinSub ? tsub.filter((x) => x.section_id === r.section_id && x.subject_id === twinSub.id) : [];
  if (twinRows.length && !/P$/.test(s.code)) {
    const same = twinRows.some((x) => x.teacher_id === r.teacher_id);
    add({ type: "ALLOCATION_SEMANTIC_DUPLICATE", table: "teacher_subjects", record_id: r.id, current: cur,
      proposed: `DELETE (superseded by ${twinSub.code} row ${twinRows.map((x) => x.id.slice(0, 8)).join(",")}${same ? "" : "; teachers differ: " + twinRows.map((x) => tchById[x.teacher_id].name).join(",")})`,
      evidence: `legacy ${s.code} duplicates ${twinSub.code} for the same section`, confidence: "high", status: same ? "DUPLICATE" : "DUPLICATE_TEACHER_DIFFERS" });
    continue;
  }
  add({ type: "ALLOCATION_NOT_IN_WORKBOOK", table: "teacher_subjects", record_id: r.id, current: cur,
    proposed: legacyIds.has(r.subject_id) ? "REVIEW: references legacy subject; re-point to _S subject or retire" : "REVIEW: not present in workbook",
    evidence: legacyIds.has(r.subject_id) ? `legacy subject code ${s?.code}` : "no workbook cell requires it (or block/teacher unresolved)", confidence: "low", status: "REVIEW" });
}

// ---------- 7. legacy subject dependencies (live) ----------
async function main() {
  const [attendance, marks, entries] = await Promise.all([fetchAll("attendance", "id,subject_id"), fetchAll("marks", "id,subject_id"), fetchAll("timetable_entries", "id,subject_id")]);
  writeFileSync(`${snapDir}/attendance.json`, JSON.stringify(attendance));
  writeFileSync(`${snapDir}/marks.json`, JSON.stringify(marks));
  const cnt = (rows: any[], id: string) => rows.filter((r) => r.subject_id === id).length;
  const alias: Record<string, [string, string, string]> = {
    CS501: ["DBMS_S5", "high", "same name Database Management Systems"],
    CS502: ["FLAT_S5", "high", "same name Formal Languages & Automata Theory"],
    CS503: ["SE_S5", "high", "same name Software Engineering"],
    CS504: ["CN_S5", "high", "same name Computer Networks"],
    CS505: ["WT_S5", "high", "same name Web Technologies"],
    CS506: ["ERP_S5", "high", "same name Enterprise Resource Planning"],
    CS507: ["APT_S5|SS_S5", "low", "legacy 'Aptitude & Soft Skills' maps to two workbook subjects"],
    CS301: ["DS_S3", "medium", "Data Structures & Algorithms vs Data Structures"],
    CS302: ["DC_S3", "low", "legacy 'Data Communication' but DC_S3 is named 'Digital Circuits & Systems'"],
    CS303: ["SAQT_S3", "low", "legacy 'Statistical Analysis & Quantitative Techniques' vs SAQT_S3 'Software Architecture & Quality Testing' — same abbreviation, different names"],
    CS304: ["JAVA_S3", "medium", "OOP (C++/Java) vs Java Programming"],
  };
  for (const s of legacy) {
    const base = s.code.replace(/P$/, "");
    const isLab = /P$/.test(s.code);
    const a = alias[base];
    add({ type: "LEGACY_SUBJECT", table: "subjects", record_id: s.id,
      current: `${courseCode[s.course_id]} S${semNo[s.semester_id]} ${s.code} "${s.name}" (${s.type})`,
      proposed: isLab ? `no workbook lab subject yet; keep until lab _S subjects created` : a ? `merge into ${a[0]} then retire` : "REVIEW",
      evidence: `deps: teacher_subjects=${tsub.filter((r) => r.subject_id === s.id).length}, attendance=${cnt(attendance, s.id)}, marks=${cnt(marks, s.id)}, timetable_entries=${cnt(entries, s.id)}; ${a ? a[2] : "lab"}`,
      confidence: isLab ? "medium" : a ? a[1] : "low", status: isLab ? "KEEP_PENDING" : a && a[1] === "high" ? "DUPLICATE" : "AMBIGUOUS" });
  }

  // weekly hours vs workbook periods
  const per = new Map<string, number>();
  for (const r of req.values()) if (r.subId) per.set(r.subId, Math.max(per.get(r.subId) ?? 0, r.periods));
  for (const [sid, n] of per) { const s = subById[sid]; if (s.weekly_hours !== n) add({ type: "WEEKLY_HOURS_MISMATCH", table: "subjects", record_id: sid, current: `weekly_hours=${s.weekly_hours}`, proposed: `weekly_hours=${n}`, evidence: `workbook shows ${n} lecture periods/week for ${s.code}`, confidence: "medium", status: "MISMATCH" }); }

  const summary: Record<string, Record<string, number>> = {};
  for (const m of manifest) { summary[m.type] ??= {}; summary[m.type][m.status] = (summary[m.type][m.status] ?? 0) + 1; }
  writeFileSync(`${snapDir}/manifest.json`, JSON.stringify({ generated: new Date().toISOString(), summary, lecturesWithoutInitials: { total: noFac.length, ...fsplit }, rows: manifest }, null, 1));
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cols = ["row", "type", "table", "record_id", "current", "proposed", "evidence", "confidence", "status", "note"];
  writeFileSync(`${snapDir}/manifest.csv`, [cols.join(","), ...manifest.map((m) => cols.map((c) => esc(m[c])).join(","))].join("\n"));
  console.log(snapDir); console.log(JSON.stringify(summary, null, 1)); console.log("no-initials split", noFac.length, fsplit);
}
main();
