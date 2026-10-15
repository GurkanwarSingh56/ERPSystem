/**
 * Robust RFC 4180 compliant CSV parser and serializer.
 * Supports:
 * - Double-quote escaping ("" -> ")
 * - Commas and newlines within quoted fields
 * - CRLF and LF line endings
 * - Trimming and header normalization
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: { row: number; message: string }[];
}

export function parseCsv(text: string): ParsedCsvResult {
  const result: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const len = text.length;

  while (i < len) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i += 2;
        } else {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some((f) => f.length > 0)) {
          result.push(currentRow);
        }
        currentRow = [];
        continue;
      } else if (char === "\n") {
        i++;
        currentRow.push(currentField.trim());
        currentField = "";
        if (currentRow.some((f) => f.length > 0)) {
          result.push(currentRow);
        }
        currentRow = [];
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Final field and row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      result.push(currentRow);
    }
  }

  if (result.length === 0) {
    return { headers: [], rows: [], errors: [{ row: 1, message: "CSV file is empty." }] };
  }

  const rawHeaders = result[0];
  const headers = rawHeaders.map((h) => h.trim().toLowerCase());

  const rows: Record<string, string>[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let r = 1; r < result.length; r++) {
    const rawRow = result[r];
    const rowObj: Record<string, string> = {};

    headers.forEach((hdr, idx) => {
      rowObj[hdr] = rawRow[idx] !== undefined ? rawRow[idx] : "";
    });

    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    errors,
  };
}

/**
 * Serializes headers and sample data into a downloadable CSV string.
 */
export function generateCsvTemplate(headers: string[], exampleRow?: Record<string, string>): string {
  const escapeField = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headerLine = headers.map(escapeField).join(",");
  if (!exampleRow) {
    return headerLine + "\r\n";
  }

  const exampleLine = headers.map((h) => escapeField(exampleRow[h] || "")).join(",");
  return `${headerLine}\r\n${exampleLine}\r\n`;
}
