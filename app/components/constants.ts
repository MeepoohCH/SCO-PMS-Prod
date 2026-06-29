// =============================================================
// constants.ts — PMS Dow Chemical (Thailand) Ltd.
// Shared constants ใช้ร่วมกันทุกไฟล์ (SL, Packer, PackLead)
// =============================================================

// ── Types ─────────────────────────────────────────────────────

export type DeptKey = 'PUF' | 'PU' | 'IBC' | 'Latex';
export type DeptSrc = 'upload' | 'manual';

export interface BadgeStyle {
  bg: string;
  color: string;
}

export interface DeptConfig {
  label: string;
  src: DeptSrc;
  badge: BadgeStyle;
  accent: string;
  icon?: string;
}

export type StatusKey =
  | 'draft'
  | 'waiting'
  | 'in_progress'
  | 'pl_review'
  | 'paused_shift_end'
  | 'paused_issue'
  | 'paused_emergency'
  | 'submitted'
  | 'head_approved'
  | 'sl_rejected'
  | 'completed'
  | 'rejected';

/** Alias used by Packer / PackLead screens */
export type LotStatus = StatusKey;

export interface StatusConfig {
  bg: string;
  color: string;
  label: string;
}

export type RoleKey = 'admin' | 'sl' | 'pk' | 'pl';

export interface RoleConfig {
  label: string;
  color: string;
}

export type ShiftKey = 'morning' | 'afternoon' | 'night' | 'evening' | 'custom';

export interface ShiftRow {
  shift_name: string;
  product_name: string;
  gmid: string;
  customer: string;
  production_order: string;
  lot_no: string;
  packaging_type: string;
  country_label: string;
}

export interface WtRefEntry {
  l: string;
  ref: number;
  tol: number;
}

// ── Structured MDU weight-standard lookup ─────────────────────
export type MduMachine     = 'MDU2450' | 'MDU2451/52'
export type LocalExportIbc = 'Local' | 'Export' | 'IBC Tote'
export type DrumMmType     = 'Drum 1.0mm' | 'Drum 1.2mm' | 'Drum 1.5mm'

export interface WtStandard { ref: number; tol: number }

export const MDU_MACHINE_OPTS:     MduMachine[]     = ['MDU2450', 'MDU2451/52']
export const LOCAL_EXPORT_IBC_OPTS: LocalExportIbc[] = ['Local', 'Export', 'IBC Tote']
export const DRUM_MM_OPTS:          DrumMmType[]     = ['Drum 1.0mm', 'Drum 1.2mm', 'Drum 1.5mm']

/**
 * Returns the standard weight for a given MDU + category + drum-type combo,
 * or null if the selection is incomplete.
 *
 * ibcSubChoice is required only when machine === 'MDU2451/52' AND
 * category === 'IBC Tote' (that combination still splits by Local/Export).
 */
export function getWtStandard(
  machine:      MduMachine,
  category:     LocalExportIbc,
  drumType:     DrumMmType | null,
  ibcSubChoice?: 'Local' | 'Export',
): WtStandard | null {
  if (machine === 'MDU2451/52') {
    if (category === 'IBC Tote') {
      if (!ibcSubChoice) return null
      return ibcSubChoice === 'Local' ? { ref: 1060, tol: 3 } : { ref: 760, tol: 3 }
    }
    if (!drumType) return null
    const table: Record<'Local' | 'Export', Record<DrumMmType, number>> = {
      Local:  { 'Drum 1.0mm': 938, 'Drum 1.2mm': 942, 'Drum 1.5mm': 963 },
      Export: { 'Drum 1.0mm': 928, 'Drum 1.2mm': 932, 'Drum 1.5mm': 953 },
    }
    return { ref: table[category as 'Local' | 'Export'][drumType], tol: 3 }
  }
  // MDU2450
  if (category === 'IBC Tote') return { ref: 1000, tol: 0.5 }
  return { ref: category === 'Local' ? 840 : 760, tol: 2 }
}

export interface ChecklistItem {
  k: string;
  t: string;
  o: string[];
  note?: string;
}

export interface Checklists {
  pre: Record<DeptKey, ChecklistItem[]>;
  post: ChecklistItem[];
}

export interface FieldMapEntry {
  offset: number;
  key: string | null;
}

// ── Dept config ──────────────────────────────────────────────
export const DEPT: Record<DeptKey, DeptConfig> = {
  PUF:   { label: 'PUF Drumming',   src: 'manual', badge: { bg: '#EEEDFE', color: '#26215C' }, accent: '#534AB7' },
  PU:    { label: 'PU Drumming',    src: 'manual', badge: { bg: '#E6F1FB', color: '#042C53' }, accent: '#185FA5' },
  IBC:   { label: 'IBC Record',     src: 'manual', badge: { bg: '#FCEBEB', color: '#501313' }, accent: '#D97706' },
  Latex: { label: 'Latex Drumming', src: 'manual', badge: { bg: '#E1F5EE', color: '#04342C' }, accent: '#0891B2' },
};

// ── Lot status config ─────────────────────────────────────────
export const STATUS: Record<StatusKey, StatusConfig> = {
  draft:            { bg: '#F1EFE8', color: '#5F5E5A', label: 'Draft'        },
  waiting:          { bg: '#FEF3C7', color: '#633806', label: 'Waiting'      },
  in_progress:      { bg: '#E6F1FB', color: '#042C53', label: 'In progress'  },
  pl_review:        { bg: '#EEEDFE', color: '#534AB7', label: 'PL Review'    },
  paused_shift_end: { bg: '#FEF3C7', color: '#633806', label: 'Shift ended'  },
  paused_issue:     { bg: '#FCEBEB', color: '#501313', label: 'Issue paused' },
  paused_emergency: { bg: '#FCEBEB', color: '#501313', label: 'Emergency'    },
  submitted:        { bg: '#EEEDFE', color: '#26215C', label: 'Submitted'    },
  head_approved:    { bg: '#E1F5EE', color: '#04342C', label: 'Final Check'  },
  sl_rejected:      { bg: '#FCEBEB', color: '#791F1F', label: 'SL Rejected'  },
  completed:        { bg: '#EAF3DE', color: '#173404', label: 'Completed'    },
  rejected:         { bg: '#FCEBEB', color: '#501313', label: 'Rejected'     },
};

// ── Role metadata ─────────────────────────────────────────────
export const ROLE_META: Record<RoleKey, RoleConfig> = {
  admin: { label: 'Admin',          color: '#E24B4A' },
  sl:    { label: 'Site Logistics', color: '#185FA5' },
  pk:    { label: 'Packer',         color: '#0F6E56' },
  pl:    { label: 'Pack Lead',      color: '#534AB7' },
};

// ── Shift labels ──────────────────────────────────────────────
export const SHIFT_LABELS: Record<ShiftKey, string> = {
  morning:   'Morning',
  afternoon: 'Afternoon',
  night:     'Night',
  evening:   'Evening',
  custom:    'Custom',
};

export function emptyShift(name = ''): ShiftRow {
  return {
    shift_name:       name,
    product_name:     '',
    gmid:             '',
    customer:         '',
    production_order: '',
    lot_no:           '',
    packaging_type:   '',
    country_label:    '',
  };
}

export const DEFAULT_SHIFTS: ShiftKey[] = ['morning', 'afternoon', 'night'];

// ── Scale weight reference (Packer MDU) ──────────────────────
export const WT_REF: WtRefEntry[] = [
  // ── MDU2451 / MDU2452 ──
  { l: 'MDU2451/52 · Local + Drum 1.0 mm',  ref: 938,  tol: 3   },
  { l: 'MDU2451/52 · Local + Drum 1.2 mm',  ref: 942,  tol: 3   },
  { l: 'MDU2451/52 · Local + Drum 1.5 mm',  ref: 963,  tol: 3   },
  { l: 'MDU2451/52 · Local + IBC Tote',     ref: 1060, tol: 3   },
  { l: 'MDU2451/52 · Export + Drum 1.0 mm', ref: 928,  tol: 3   },
  { l: 'MDU2451/52 · Export + Drum 1.2 mm', ref: 932,  tol: 3   },
  { l: 'MDU2451/52 · Export + Drum 1.5 mm', ref: 953,  tol: 3   },
  { l: 'MDU2451/52 · Export + IBC Tote',    ref: 760,  tol: 3   },
  // ── MDU2450 ──
  { l: 'MDU2450 · Local/Export pallet',     ref: 840,  tol: 2   },
  { l: 'MDU2450 · Export pallet',           ref: 760,  tol: 2   },
  { l: 'MDU2450 · IBC Tote',                ref: 1000, tol: 0.5 },
];

// ── Pre-check checklist items ─────────────────────────────────
const _PRE_BASE: ChecklistItem[] = [
  { k: 'container', t: 'ตรวจสอบภาชนะบรรจุก่อน Drumming ว่าถูกชนิดตามใบงานหรือไม่ รวมถึงความสะอาด ไม่มีรอยรั่ว', o: ['Yes', 'No'] },
  { k: 'label',     t: 'ตรวจสอบลาเบลก่อน Drumming ว่าถูกต้องตามใบงานหรือไม่ (Grade/Lot/Weight/Version)',            o: ['Yes', 'No'] },
  { k: 'flush_wt',  t: 'บันทึกน้ำหนักถังเปล่าก่อนนำมา Flush line (น้ำหนักถังต้องไม่เกิน 20 kg)',                   o: ['Yes', 'No'] },
];

const _PRE_PUF_PU: ChecklistItem[] = [
  ..._PRE_BASE,
  { k: 'first_drum', t: 'Product ที่ pack ออกมา Tote/Drum แรก ต้องไม่มีสีอื่นเจือปน',                              o: ['Yes', 'No', 'NA'], note: 'ทำหลังถังแรก — PUF/PU only'   },
  { k: 'sample',     t: 'เก็บ Sample ส่ง Lab (Polyol=250ml / Rigid FM=500ml / Specflex NF=1000ml)',                  o: ['Yes', 'No', 'NA'], note: 'ทำหลังข้อ 4 ผ่าน — PUF/PU only' },
];

// ── Post-check checklist items ────────────────────────────────
const _POST: ChecklistItem[] = [
  { k: 'purge_n2', t: 'ตรวจสอบว่าระบบได้มีการ purge ในโตรเจนไล่ Product ค้างท่อ หลัง Drumming แล้ว', o: ['Yes', 'No', 'NA'] },
];

export const CHECKLISTS: Checklists = {
  pre: {
    PUF:   _PRE_PUF_PU,
    PU:    _PRE_PUF_PU,
    IBC:   _PRE_PUF_PU,
    Latex: _PRE_BASE,
  },
  post: _POST,
};

// ── Excel parser constants (PUF import) ──────────────────────
export const FIELD_MAP_EXCEL: FieldMapEntry[] = [
  { offset: 0,  key: 'product_name'     },
  { offset: 1,  key: 'gmid'             },
  { offset: 2,  key: 'customer'         },
  { offset: 3,  key: null               },
  { offset: 4,  key: 'production_order' },
  { offset: 5,  key: 'lot_no'           },
  { offset: 6,  key: null               },
  { offset: 7,  key: null               },
  { offset: 8,  key: null               },
  { offset: 9,  key: 'packaging_type'   },
  { offset: 10, key: null               },
  { offset: 11, key: 'country_label'    },
  { offset: 12, key: null               },
  { offset: 13, key: null               },
  { offset: 14, key: null               },
];

// These 2 checklist items are fixed, per-pallet questions asked only after Pallet #1
// completes (not lot-level Pre-check items). Identified by label match since there is
// no dedicated DB flag — do not rename these item_label values in the database without
// updating this constant.
export const PER_PALLET_CHECKLIST_LABELS = [
  'Product ที่ pack ออกมา Tote/Drum แรก ต้องไม่มีสีอื่นเจือปน',
  'เก็บ Sample ส่ง Lab',
] as const

export function isPerPalletChecklistItem(itemLabel: string): boolean {
  return PER_PALLET_CHECKLIST_LABELS.some(l => itemLabel.includes(l))
}

export const BLENDER_CODES_EXCEL = [
  'V-2300', 'V-2310', 'V-2320', 'V-2800', 'V-2330', 'IBC Mixer',
] as const;

export type BlenderCode = typeof BLENDER_CODES_EXCEL[number];

// ── SL shift-table field definitions ─────────────────────────

export interface FieldDef {
  k: string;
  l: string;
  req?: boolean;
  mono?: boolean;
  combo?: boolean;
  chk?: boolean;
  btns?: string[];
  opts?: string[];
  num?: boolean;
  type?: string;
}

export const SFIELDS: FieldDef[] = [
  { k: "product_name",     l: "Product Name",    req: true },
  { k: "gmid",             l: "GMID",            mono: true },
  { k: "customer",         l: "Customer",        req: true, combo: true },
  { k: "production_order", l: "Production Order", req: true, mono: true },
  { k: "lot_no",           l: "Lot No",          req: true, mono: true },
  { k: "packaging_type",   l: "Packaging Type",  req: true, combo: true, opts: ["ISO-TANK", "Drum 1.0 mm", "Drum 1.2 mm", "Drum 1.5 mm", "TOTE", "IBC", "PE Drum", "Flexibag"] },
  { k: "country_label",    l: "Country Label",   req: true, combo: true },
];
