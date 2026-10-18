import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { parseOfficialWorkbook, storePreview } from "@/lib/timetable/import";

export const runtime = "nodejs";

// Dry-run only: parses and validates the workbook, writes nothing to the database.
export async function POST(req: Request) {
  try {
    await requireRole(["admin", "principal"]);
  } catch {
    return NextResponse.json({ errors: ["Not authorised"] }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get("timetableFile");
    if (!(file instanceof File)) {
      return NextResponse.json({ errors: ["No file uploaded"] }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ errors: ["Upload an .xlsx file under 10 MB"] }, { status: 400 });
    }

    const preview = parseOfficialWorkbook(Buffer.from(await file.arrayBuffer()));
    if (preview.errors.length) {
      return NextResponse.json({ errors: preview.errors, preview: null });
    }
    storePreview(preview);
    // Return summary only; full entries stay server-side
    return NextResponse.json({
      errors: [],
      preview: { id: preview.id, sheets: preview.sheets, warnings: preview.warnings.slice(0, 50) },
    });
  } catch (e) {
    console.error("timetable import parse failed", e);
    return NextResponse.json({ errors: ["Could not read the workbook"] }, { status: 500 });
  }
}
