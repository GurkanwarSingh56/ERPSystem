// Read-only snapshot of academic tables from LOCAL Supabase. GET requests only.
import { readFileSync, mkdirSync, writeFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/127\.0\.0\.1|localhost/.test(URL)) throw new Error("Refusing: not a local Supabase URL " + URL);
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

export async function fetchAll(table: string, select = "*") {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

const TABLES = [
  "institutions", "departments", "courses", "semesters", "sections", "subjects",
  "teachers", "profiles", "teacher_subjects", "rooms",
  "timetables", "timetable_slots", "timetable_entries", "institution_schedule_configs",
];

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = `backup/reconcile-${stamp}`;
  mkdirSync(dir, { recursive: true });
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows = await fetchAll(t);
    writeFileSync(`${dir}/${t}.json`, JSON.stringify(rows, null, 1));
    counts[t] = rows.length;
  }
  writeFileSync(`${dir}/_counts.json`, JSON.stringify(counts, null, 1));
  console.log(dir, counts);
}
if (process.argv[1]?.endsWith("backup-reconcile.ts")) main();
