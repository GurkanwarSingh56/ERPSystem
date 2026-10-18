import { read, utils } from "xlsx";

export type OfficialEntry = {
  block: string; // class / lab / room / faculty heading
  day: string;
  period: number; // 1..9 (5 = recess)
  raw: string;
  subject: string;
  kind: string; // L, T, P, G1, G2 ...
  faculty: string;
  room: string;
};

export type OfficialPreview = {
  id: string;
  sheets: Record<string, { blocks: number; entries: number }>;
  entries: Record<string, OfficialEntry[]>;
  errors: string[];
  warnings: string[];
};

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const SHEETS = ["CLASS WISE", "LAB WISE", "ROOM WISE", "FACULTY"];
const ROOM_RE = /\b([A-Z]{1,3})\s?-?\s?(\d{1,3}[A-Z]?)\b/g;
const NON_TEACHING = new Set(["LIBRARY", "BREAK", "RECESS", "LUNCH", ""]);

export function parseCell(raw: string) {
  const text = raw.replace(/\s+/g, " ").trim();
  if (NON_TEACHING.has(text.toUpperCase())) return null;
  // Last room-like token wins (cells like "B-B-207A" or "T-3 B-205"); needs a hyphen/space or >=3 digits
  const roomMatches = [...text.matchAll(ROOM_RE)].filter((m) => /[-\s]/.test(m[0]) || m[2].length >= 3);
  const roomMatch = roomMatches.length ? roomMatches[roomMatches.length - 1] : null;
  const room = roomMatch ? `${roomMatch[1]}-${roomMatch[2]}` : "";
  const kindMatch = text.match(/\[([^\]]*)\]/);
  const kind = kindMatch ? kindMatch[1].trim() : "";
  const subject = text.split("[")[0].trim();
  let rest = text.replace(/\[[^\]]*\]/g, " ");
  if (roomMatch) rest = rest.replace(roomMatch[0], " ");
  rest = rest.replace(subject, " ").replace(/\b[A-Z]-(?=\s|$)/g, " ").replace(/(^|\s)-(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
  return { subject, kind, faculty: rest, room };
}

export function parseOfficialWorkbook(buffer: Buffer): OfficialPreview {
  const wb = read(buffer, { type: "buffer" });
  const preview: OfficialPreview = {
    id: crypto.randomUUID(),
    sheets: {},
    entries: {},
    errors: [],
    warnings: [],
  };

  for (const name of SHEETS) {
    const ws = wb.Sheets[name];
    if (!ws) {
      preview.errors.push(`Missing required sheet: ${name}`);
      continue;
    }
    const rows = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
    const entries: OfficialEntry[] = [];
    const blocks = new Set<string>();
    let block = "";
    let day = "";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map((c) => String(c ?? ""));
      const first = row[0].trim();
      const next = rows[i + 1]?.map((c) => String(c ?? "")) ?? [];

      // block title: a non-empty first cell followed by the LECTURE header row
      if (first && next[0]?.trim().toUpperCase() === "LECTURE") {
        block = first;
        blocks.add(block);
        day = "";
        continue;
      }
      if (!block || first.toUpperCase() === "LECTURE" || first.toUpperCase() === "DAY") continue;
      if (DAYS.includes(first.toUpperCase())) day = first.toUpperCase();
      if (!day) continue;

      for (let p = 1; p <= 9; p++) {
        const raw = row[p] ?? "";
        const parsed = parseCell(raw);
        if (!parsed) continue;
        entries.push({ block, day, period: p, raw: raw.trim(), ...parsed });
        if (p === 5) preview.warnings.push(`${name} ${block} ${day}: class in recess slot (period 5)`);
      }
    }

    if (!blocks.size) preview.errors.push(`Sheet "${name}" has no recognisable blocks`);
    preview.sheets[name] = { blocks: blocks.size, entries: entries.length };
    preview.entries[name] = entries;
  }
  return preview;
}

// In-memory store for dry-run previews (server process lifetime only)
const store = new Map<string, OfficialPreview>();
export const storePreview = (p: OfficialPreview) => void store.set(p.id, p);
export const getPreview = (id: string) => store.get(id);
export const deletePreview = (id: string) => void store.delete(id);
