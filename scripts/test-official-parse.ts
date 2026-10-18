import { readFileSync } from "fs";
import { parseOfficialWorkbook } from "../src/lib/timetable/import";

const p = parseOfficialWorkbook(readFileSync("tt.xlsx"));
console.log("errors:", p.errors);
console.log("sheets:", p.sheets);
console.log("warnings:", p.warnings.length);
const cls = p.entries["CLASS WISE"] ?? [];
console.log("sample:", cls.slice(0, 6));
const sections = new Set(cls.map((e) => e.block));
console.log("class blocks:", [...sections].slice(0, 40));
const noFac = cls.filter((e) => !e.faculty && e.kind === "L").length;
console.log("lecture entries without faculty initials:", noFac);
