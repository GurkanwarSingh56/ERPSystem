"use client";

import React, { useState } from "react";

type Summary = {
  id: string;
  sheets: Record<string, { blocks: number; entries: number }>;
  warnings: string[];
};

export default function ImportTimetableWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Summary | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const validate = async () => {
    if (!file) return;
    setBusy(true);
    setErrors([]);
    setPreview(null);
    try {
      const form = new FormData();
      form.append("timetableFile", file);
      const res = await fetch("/api/admin/import-timetable", { method: "POST", body: form });
      const data = await res.json();
      if (data.errors?.length) setErrors(data.errors);
      else setPreview(data.preview);
    } catch {
      setErrors(["Upload failed. Please try again."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="official-import" className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-white">Import Official Timetable (dry run)</h2>
      <p className="text-sm text-slate-400">
        Validates the CLASS WISE, LAB WISE, ROOM WISE and FACULTY sheets. Nothing is written to the database.
      </p>
      <input
        id="official-timetable-file"
        type="file"
        accept=".xlsx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        disabled={busy}
        className="block text-sm text-slate-300"
      />
      <button
        id="official-timetable-validate"
        onClick={validate}
        disabled={!file || busy}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Validating…" : "Upload & Validate"}
      </button>

      {errors.length > 0 && (
        <ul className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300 list-disc pl-6">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {preview && (
        <table className="w-full text-sm text-slate-200">
          <thead>
            <tr className="text-left text-slate-400">
              <th>Sheet</th>
              <th>Blocks</th>
              <th>Entries</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(preview.sheets).map(([name, s]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{s.blocks}</td>
                <td>{s.entries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
