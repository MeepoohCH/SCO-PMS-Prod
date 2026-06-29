// ExcelImport.tsx — SheetJS Excel parser for PMS PUF Production Schedule
// Imported by SLScreen; pure utility functions, no React components

import { BLENDER_CODES_EXCEL, FIELD_MAP_EXCEL } from "./constants";

// ── Types ──────────────────────────────────────────────────────

export interface ShiftData {
  day: string;
  shift_label: string;
  shift_key: string;
  [key: string]: string;
}

export interface BlenderSchedule {
  blender: string;
  blender_cap: string;
  dept: "PUF" | "IBC";
  rn_ref: string;
  date: string;
  has_data: boolean;
  shifts: Record<string, ShiftData>;
}

export interface ExcelParseResult {
  blenders: BlenderSchedule[];
  sheet_name: string;
}

interface XLSXLib {
  read: (buf: ArrayBuffer, opts: { type: string; cellDates: boolean }) => XLSXWorkbook;
  utils: {
    sheet_to_json: (sheet: unknown, opts: { header: 1; defval: string }) => unknown[][];
  };
}

interface XLSXWorkbook {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}

declare global {
  interface Window { XLSX?: XLSXLib; }
}

// ── SheetJS CDN loader ────────────────────────────────────────
let _xlsxLib: XLSXLib | null = null;

export function loadSheetJSLib(): Promise<XLSXLib> {
  if (_xlsxLib) return Promise.resolve(_xlsxLib);
  return new Promise((resolve, reject) => {
    if (window.XLSX) { _xlsxLib = window.XLSX; resolve(_xlsxLib); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => {
      _xlsxLib = window.XLSX ?? null;
      if (_xlsxLib) resolve(_xlsxLib);
      else reject(new Error("SheetJS loaded but window.XLSX not set"));
    };
    s.onerror = () => reject(new Error("โหลด SheetJS ไม่ได้"));
    document.head.appendChild(s);
  });
}

// ── Constants ─────────────────────────────────────────────────
const SHIFT_NORM: Record<string, string> = { "เช้า": "morning", "บ่าย": "afternoon", "ดึก": "night" };

// ── Cell cleaner ──────────────────────────────────────────────
function cleanXlsxCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v).replace(/\r\n|\r/g, " ").replace(/\n/g, " ").trim();
  if (s === "nan" || s === "None" || s === "") return "";
  return s.endsWith(" 00:00:00") ? s.slice(0, 10) : s;
}

// ── Per-field cleaner ─────────────────────────────────────────
function cleanField(key: string, raw: unknown): string {
  if (raw == null || raw === "") return "";
  // Production order: Excel stores as float due to precision artifact
  if (key === "production_order" && typeof raw === "number") {
    return String(Math.trunc(raw));
  }
  let s = cleanXlsxCell(raw);
  if (!s) return "";
  // GMID: strip "GMID :" prefix
  if (key === "gmid") s = s.replace(/^GMID\s*:?\s*/i, "").trim();
  return s;
}

// ── Day column value → ISO date ───────────────────────────────
function dayValToISO(val: unknown, sheetName: string): string {
  const n = typeof val === "number" ? val : parseFloat(String(val ?? ""));
  if (isNaN(n) || n <= 0) return "";
  // Excel serial date (> 25000 covers dates after 1968)
  if (n > 25000) return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  // Day-of-month integer: derive year/month from sheet name
  if (n >= 1 && n <= 31) {
    const lower = sheetName.toLowerCase();
    const MONTHS: [string, number][] = [
      ["jan", 0], ["feb", 1], ["mar", 2], ["apr", 3], ["may", 4], ["jun", 5],
      ["jul", 6], ["aug", 7], ["sep", 8], ["oct", 9], ["nov", 10], ["dec", 11],
    ];
    const yearM = lower.match(/\b(20\d{2})\b/);
    const year = yearM ? parseInt(yearM[1]) : new Date().getUTCFullYear();
    let month = 0;
    for (const [abbr, idx] of MONTHS) { if (lower.includes(abbr)) { month = idx; break; } }
    return new Date(Date.UTC(year, month, Math.trunc(n))).toISOString().slice(0, 10);
  }
  return "";
}

// ── Blender matcher (known codes + regex fallback) ────────────
function matchBlender(raw: string): { code: string; cap: string; dept: "PUF" | "IBC" } | null {
  const cell = raw.replace(/\r?\n/g, " ").trim();
  if (!cell) return null;
  const capFrom = (s: string) => {
    const m = s.match(/[(\s](\d+(?:\.\d+)?)\s*(?:mt|dr)/i);
    return m ? m[1] : "0";
  };
  for (const code of BLENDER_CODES_EXCEL) {
    if (cell.includes(code)) {
      const key = code.includes("IBC") ? "IBC Mixer" : code;
      return { code: key, cap: capFrom(cell), dept: key === "IBC Mixer" ? "IBC" : "PUF" };
    }
  }
  const vm = cell.match(/\bV-\d{4,}\b/);
  if (vm) return { code: vm[0], cap: capFrom(cell), dept: "PUF" };
  if (/\bIBC\b/i.test(cell)) return { code: "IBC Mixer", cap: capFrom(cell), dept: "IBC" };
  return null;
}

// ── Schedule parser ───────────────────────────────────────────
// Produces 1 BlenderSchedule per (blender × date).
// Row layout: row[shiftHeaderRow-1] = day numbers, row[shiftHeaderRow] = เช้า/บ่าย/ดึก headers.
export function parseScheduleAOA(aoa: unknown[][], sheetName = ""): BlenderSchedule[] {
  const nRows = aoa.length;
  const SHIFT_SET = new Set(["เช้า", "บ่าย", "ดึก"]);

  // Find the shift header row (first row containing 3+ of เช้า/บ่าย/ดึก)
  let shiftHeaderRow = -1;
  for (let i = 0; i < Math.min(nRows, 20); i++) {
    const row = (aoa[i] as unknown[]) || [];
    if (row.filter(v => SHIFT_SET.has(String(v ?? "").trim())).length >= 3) {
      shiftHeaderRow = i;
      break;
    }
  }
  if (shiftHeaderRow === -1) throw new Error("ไม่พบ header เช้า/บ่าย/ดึก — กรุณาตรวจสอบ format");

  const dayHeaderRow = Math.max(0, shiftHeaderRow - 1);
  const shiftRow = (aoa[shiftHeaderRow] as unknown[]) || [];
  const dayRow   = (aoa[dayHeaderRow]   as unknown[]) || [];

  // Build per-column descriptor for every shift column
  interface ColInfo { col: number; shiftKey: string; shiftLabel: string; date: string; }
  const colInfos: ColInfo[] = [];
  for (let j = 0; j < shiftRow.length; j++) {
    const h = String(shiftRow[j] ?? "").trim();
    if (!SHIFT_SET.has(h)) continue;
    colInfos.push({
      col:        j,
      shiftKey:   SHIFT_NORM[h] ?? h,
      shiftLabel: h,
      date:       dayValToISO(dayRow[j], sheetName),
    });
  }

  // Unique dates in column order
  const dateOrder: string[] = [];
  const seenDates = new Set<string>();
  for (const c of colInfos) {
    if (!seenDates.has(c.date)) { seenDates.add(c.date); dateOrder.push(c.date); }
  }
  const dates = dateOrder.length ? dateOrder : [""];

  // Detect blender start rows using fixed 15-row stride.
  // After finding a blender at row i, jump to i+15 — never scan inside the block.
  const BLOCK_SIZE = 15;
  const blenderRows: { row: number; code: string; cap: string; dept: "PUF" | "IBC" }[] = [];
  let i = shiftHeaderRow + 1;
  while (i < nRows) {
    const raw = String(((aoa[i] as unknown[])?.[0]) ?? "");
    const match = matchBlender(raw);
    if (match) {
      console.log(`[ExcelImport] Blender: ${match.code} rows: ${i} - ${i + BLOCK_SIZE - 1}`);
      console.log(`[ExcelImport] Row 0 product:`, (aoa[i] as unknown[])?.[3]);
      console.log(`[ExcelImport] Row 14 amount:`, (aoa[i + BLOCK_SIZE - 1] as unknown[])?.[3]);
      blenderRows.push({ row: i, ...match });
      i += BLOCK_SIZE;
    } else {
      i++;
    }
  }
  if (!blenderRows.length) throw new Error("ไม่พบ Blender ใดใน column A");

  // Emit 1 BlenderSchedule per (blender × date)
  const result: BlenderSchedule[] = [];
  for (const b of blenderRows) {
    for (const date of dates) {
      const dateCols = colInfos.filter(c => c.date === date);
      const shifts: Record<string, ShiftData> = {};
      for (const c of dateCols) {
        const sd: ShiftData = { day: date, shift_label: c.shiftLabel, shift_key: c.shiftKey };
        for (const { offset, key } of FIELD_MAP_EXCEL) {
          if (!key) continue;
          const r = b.row + offset;
          sd[key] = cleanField(key, r < nRows ? (aoa[r] as unknown[])?.[c.col] : undefined);
        }
        shifts[c.shiftKey] = sd;
      }
      result.push({
        blender:     b.code,
        blender_cap: b.cap,
        dept:        b.dept,
        rn_ref:      "",
        date,
        has_data:    Object.values(shifts).some(s => !!s.product_name && String(s.product_name).trim() !== ""),
        shifts,
      });
    }
  }
  return result;
}

// ── File reader entry point ───────────────────────────────────
export async function parseExcelFileForSL(file: File): Promise<ExcelParseResult> {
  const XLSX  = await loadSheetJSLib();
  const buf   = await file.arrayBuffer();
  const wb    = XLSX.read(buf, { type: "array", cellDates: false });
  const sheet = wb.SheetNames.find(n => /jan/i.test(n) || /2026/i.test(n)) ?? wb.SheetNames[0];
  const aoa   = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" });
  const blenders = parseScheduleAOA(aoa, sheet);
  const withData = blenders.filter(b => b.has_data);
  console.log(`[ExcelImport] Sheet: "${sheet}" | Schedules: ${blenders.length} | With data: ${withData.length}`);
  console.log(`[ExcelImport] Blenders:`, [...new Set(blenders.map(b => `${b.blender} (${b.dept}, cap ${b.blender_cap})`))]);
  return { blenders, sheet_name: sheet };
}
