"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Trash2, LayoutGrid, FileText, Clock, Play, AlertTriangle, AlertOctagon, CheckCircle, CheckCircle2, XCircle, Check, Search, ChevronDown, ArrowDown, ArrowUp, PencilLine, Copy, Shuffle, Pencil, UserPlus, PauseCircle } from "lucide-react";
import PKFormViewer from "@/app/components/PKFormViewer";
import { formatDate } from "@/lib/utils";
import { DEPT, STATUS, SFIELDS } from "../components/constants";
import type { DeptKey, FieldDef } from "../components/constants";
export type { FieldDef };
export { SFIELDS };
import { Badge, DeptBadge, Card, Btn, SectionLabel } from "../components/shared";
import { SuccessTab, AdminEditLot } from "./Login";


// ── Types ──────────────────────────────────────────────────────

export interface Lot {
  id: string | number;
  dept: string;
  product: string;
  lot: string;
  customer: string;
  blender: string;
  packing_date: string;
  status: string;
  target_mt: number | string;
  actual_mt: number | string;
  drum_serial_start?: string | number;
  drum_serial_end?: string | number;
  label_pkg_type?: string;
  reject_remark?: string;
  cut_off_date?: string;
  [key: string]: unknown;
}

interface AdminScreenProps {
  lots: Lot[];
  setLots: React.Dispatch<React.SetStateAction<Lot[]>>;
}

interface RowData {
  l: string; // label
  v: string | number; // value
}

interface RoleCardData {
  role: string;
  icon?: React.ReactNode;
  color: string;
  border?: string;
  rows: RowData[];
}

type ViewType = "dashboard" | "db" | "success" | "edit_lot" | "packer_progress";
type DbTabKey = "users" | "products" | "blenders" | "packaging" | "customers" | "checklist_items";

type DBRow = {
  id?: number | string;
  is_active?: boolean;
  dept?: string;
  status?: string;
  [key: string]: unknown;
};

type AdminDB = Record<DbTabKey, DBRow[]>;

interface EditingState {
  idx: number;
  row: DBRow;
}

interface RoleCardRow { l: string; v: number; }
interface RoleCard { role: string; color: string; border: string; icon?: string; rows: RoleCardRow[]; }

interface LabelCalcResult {
  total: number; pallets: number; perPallet: number;
  unit: string; isTote: boolean; rem: number;
}


// ── DB tab & field definitions ─────────────────────────────────
const DB_TABS: { k: DbTabKey; l: string }[] = [
  { k: "users", l: "Users" },
  { k: "products", l: "Products" },
  { k: "blenders", l: "Blenders" },
  { k: "packaging", l: "Packaging" },
  { k: "customers", l: "Customers" },
  { k: "checklist_items", l: "Checklist" },
];

const FDS: Record<DbTabKey, FieldDef[]> = {
  users: [{ k: "username", l: "Username", req: true }, { k: "full_name", l: "Full name", req: true }, { k: "roles", l: "Roles" }, { k: "allowed_depts", l: "Departments" }, { k: "pack_lead_id", l: "Pack Lead" }, { k: "is_active", l: "Active", opts: ["true", "false"] }],
  products: [{ k: "product_name", l: "Product name" }, { k: "gmid", l: "GMID" }, { k: "dept", l: "Department", opts: ["PUF", "PU", "IBC", "Latex"] }, { k: "is_active", l: "Active", opts: ["true", "false"] }],
  blenders: [{ k: "code", l: "Code" }, { k: "capacity_mt", l: "Capacity (MT) (optional)" }, { k: "dept", l: "Department", opts: ["PUF", "PU", "IBC", "Latex"] }, { k: "status", l: "Status", opts: ["active", "maintenance", "retired"] }],
  packaging: [{ k: "name", l: "Package name (ถ้าไม่เลือก Category จะ auto-detect จากชื่อ)" }, { k: "standard_weight_kg", l: "Standard weight (kg)" }, { k: "drums_per_pallet", l: "Units/pallet" }, { k: "packaging_category", l: "Category", opts: ["drum", "tote", "ibc", "isotank", "flexibag"] }, { k: "is_active", l: "Active", opts: ["true", "false"] }],
  customers: [{ k: "country_label", l: "Country label" }, { k: "is_active", l: "Active", opts: ["true", "false"] }],
  checklist_items: [{ k: "form_type", l: "Department" }, { k: "phase", l: "Phase", opts: ["pre", "post"] }, { k: "item_label", l: "Label" }, { k: "response_type", l: "Type", opts: ["yes_no", "select", "text"] }, { k: "select_options", l: "Options" }, { k: "is_required", l: "Required", opts: ["true", "false"] }, { k: "is_active", l: "Active", opts: ["true", "false"] }],
};

// ── calcLabel ─────────────────────────────────────────────────
function calcLabel(start: string | number, end: string | number, packagingType: string): LabelCalcResult | null {
  const s = parseInt(String(start), 10);
  const e = parseInt(String(end), 10);
  if (!start || !end || isNaN(s) || isNaN(e) || e < s) return null;
  const total = e - s + 1;
  const isTote = (packagingType ?? "").toLowerCase().includes("tote");
  const perPallet = isTote ? 1 : 4;
  const unit = isTote ? "totes" : "drums";
  const pallets = Math.ceil(total / perPallet);
  const rem = total % perPallet;
  return { total, pallets, perPallet, unit, isTote, rem };
}

// ── LabelCalcBox ──────────────────────────────────────────────
export function LabelCalcBox({ start, end, packagingType }: { start?: string | number; end?: string | number; packagingType: string }) {
  const r = start != null && end != null ? calcLabel(start, end, packagingType) : null;
  if (!r) return (
    <div className="mt-2 text-[11px] text-[#9BA3BA]">
      {start && end && parseInt(String(end)) < parseInt(String(start))
        ? "End must be greater than start"
        : "Fill both Label no. to calculate"}
    </div>
  );
  return (
    <div className="mt-2.5 bg-white border border-amber-300 rounded-lg px-3.5 py-2.5">
      <div className="flex gap-4 flex-wrap items-center">
        <div className="text-center">
          <div className="text-[22px] font-extrabold text-amber-800    leading-none">{r.total}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">{r.unit}</div>
        </div>
        <div className="text-[18px] text-[#DDE2EE]">÷</div>
        <div className="text-center">
          <div className="text-[22px] font-extrabold text-amber-800    leading-none">{r.perPallet}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">{r.unit}/pallet</div>
        </div>
        <div className="text-[18px] text-[#DDE2EE]">=</div>
        <div className="text-center">
          <div className="text-[28px] font-extrabold text-[#185FA5]    leading-none">{r.pallets}</div>
          <div className="text-[10px] text-[#185FA5] mt-0.5">pallets</div>
        </div>
        {r.rem > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-md px-2.5 py-1 text-[11px] text-amber-800">
            last pallet has {r.rem} {r.unit} only
          </div>
        )}
      </div>
    </div>
  );
}

// ── EmergencyIssueRow ─────────────────────────────────────────
export interface EmergencyLot extends Lot { }
export interface EmergencyIssueRowProps {
  lots: EmergencyLot[];
  type: "emergency" | "issue";
  onDetail: (lot: EmergencyLot) => void;
}

export function EmergencyIssueRow({ lots, type, onDetail }: EmergencyIssueRowProps) {
  const [open, setOpen] = useState(false);
  const isEmg = type === "emergency";
  const bg = isEmg ? "#FCEBEB" : "#FEF3C7";
  const border = isEmg ? "#E24B4A" : "#EF9F27";
  const color = isEmg ? "#791F1F" : "#633806";
  const label = isEmg ? "Emergency" : "Issue";

  return (
    <div className="rounded-xl mb-2.5 overflow-hidden border-[1.5px]" style={{ background: bg, borderColor: border }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center px-3.5 py-2.5 bg-transparent border-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold" style={{ color }}>{label}</span>
          <span className="text-white text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: border }}>
            {lots.length}
          </span>
          <span className="text-[11px] opacity-70" style={{ color }}>
            {lots.map(l => String(l.lot ?? "")).join(", ")}
          </span>
        </div>
        <span className="text-[12px] font-semibold" style={{ color }}>{open ? "▲ Hide" : "▼ View List"}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5">
          {lots.map(lot => (
            <div key={String(lot.id)}
              onClick={() => onDetail(lot)}
              className="flex justify-between items-center px-2.5 py-2 rounded-lg bg-white mb-1.5 cursor-pointer border-[0.5px]"
              style={{ borderColor: border }}
            >
              <div>
                <span className="text-[12px] font-semibold" style={{ color: isEmg ? "#501313" : "#854F0B" }}>
                  {lot.product}
                </span>
                <span className="text-[11px] text-[#9BA3BA] ml-2   ">
                  <span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot}
                </span>
              </div>
              <span className="text-[11px] font-medium" style={{ color }}>Detail &gt;</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface StatusFilter {
  k: string;
  l: string;
  cnt: number;
  icon: React.ReactNode;
  col: string;
  bg: string;
}

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  admin: { bg: "#FCEBEB", color: "#E24B4A", border: "#E24B4A" },
  sl: { bg: "#E6F1FB", color: "#185FA5", border: "#185FA5" },
  pl: { bg: "#EEEDFE", color: "#534AB7", border: "#534AB7" },
  packer: { bg: "#E1F5EE", color: "#0F6E56", border: "#0F6E56" },
  staff: { bg: "#F4F5F7", color: "#6B7280", border: "#6B7280" },
};
const ALL_ROLES = ["admin", "sl", "pl", "packer", "staff"] as const;

const DEPT_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  all: { bg: "#F4F5F7", color: "#5A617A", border: "#DDE2EE" },
  PUF: { bg: "#EEEDFE", color: "#26215C", border: "#534AB7" },
  PU: { bg: "#E6F1FB", color: "#042C53", border: "#185FA5" },
  IBC: { bg: "#FFF7ED", color: "#7C2D12", border: "#D97706" },
  Latex: { bg: "#E1F5EE", color: "#04342C", border: "#0F6E56" },
};
const ALL_DEPTS = ["all", "PUF", "PU", "IBC", "Latex"] as const;
const ALL_FORM_TYPES = ["PUF", "PU", "IBC", "Latex"] as const;

const API_PATH: Record<DbTabKey, string> = {
  users: "users",
  products: "products",
  blenders: "blenders",
  packaging: "packaging-types",
  customers: "customers",
  checklist_items: "checklist-items",
};

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (Array.isArray(val)) return val.join(", ") || "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

// ── OptionsTagInput ───────────────────────────────────────────
function OptionsTagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = React.useState('')
  function addTag() {
    const v = input.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setInput('')
  }
  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mb-2">
        {value.map(opt => (
          <span key={opt} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F4F5F7] border border-[#DDE2EE]">
            {opt}
            <button type="button" onClick={() => onChange(value.filter(o => o !== opt))}
              className="text-[#9BA3BA] hover:text-[#E24B4A] cursor-pointer bg-transparent border-none p-0 ml-0.5">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder="พิมพ์ตัวเลือก แล้วกด Enter..."
          className="flex-1 h-9 px-2.5 text-[12px] border border-[#DDE2EE] rounded-md"
        />
        <button type="button" onClick={addTag}
          className="px-3 h-9 rounded-md text-[12px] font-medium bg-[#F4F5F7] border border-[#DDE2EE] cursor-pointer">
          + Add
        </button>
      </div>
    </div>
  )
}

// ── AdminScreen ───────────────────────────────────────────────
export default function AdminScreen({ lots, setLots }: AdminScreenProps) {
  const [view, setView] = useState<ViewType>("dashboard");
  const [editLot, setEditLot] = useState<Lot | null>(null);
  const [progressLot, setProgressLot] = useState<Lot | null>(null);
  const [dbTab, setDbTab] = useState<DbTabKey>("users");
  const [db, setDb] = useState<AdminDB>({ users: [], products: [], blenders: [], packaging: [], customers: [], checklist_items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const [users, products, blenders, packaging, customers, checklist] = await Promise.all([
        fetch("/api/users").then(r => r.json()),
        fetch("/api/products").then(r => r.json()),
        fetch("/api/blenders").then(r => r.json()),
        fetch("/api/packaging-types").then(r => r.json()),
        fetch("/api/customers").then(r => r.json()),
        fetch("/api/checklist-items").then(r => r.json()),
      ]);
      setDb({
        users: Array.isArray(users) ? users : [],
        products: Array.isArray(products) ? products : [],
        blenders: Array.isArray(blenders) ? blenders : [],
        packaging: Array.isArray(packaging) ? packaging : [],
        customers: Array.isArray(customers) ? customers : [],
        checklist_items: Array.isArray(checklist) ? checklist : [],
      });
      setLoading(false);
    }
    fetchAll();
  }, []);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ idx: number; id: string | number; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedFormTypes, setSelectedFormTypes] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  function toggleRow(idx: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleRole(role: string) {
    setSelectedRoles(prev => {
      if (prev.includes(role)) return prev.filter(r => r !== role);
      if (prev.length >= 2) return prev;
      return [...prev, role];
    });
  }

  function toggleDept(dept: string) {
    if (dept === "all") { setSelectedDepts(["all"]); return; }
    setSelectedDepts(prev => {
      const withoutAll = prev.filter(d => d !== "all");
      if (withoutAll.includes(dept)) {
        const result = withoutAll.filter(d => d !== dept);
        return result.length === 0 ? ["all"] : result;
      }
      const newDepts = [...withoutAll, dept];
      if (newDepts.length >= 4) return ["all"];
      return newDepts;
    });
  }

  function toggleFormType(dept: string) {
    if (dept === "all") { setSelectedFormTypes(["PUF", "PU", "IBC", "Latex"]); return; }
    setSelectedFormTypes(prev => {
      if (prev.includes(dept)) {
        const result = prev.filter(d => d !== dept);
        return result.length === 0 ? [] : result;
      }
      const newTypes = [...prev, dept];
      if (newTypes.length >= 4) return ["PUF", "PU", "IBC", "Latex"];
      return newTypes;
    });
  }


  const [dbDeptFilter, setDbDeptFilter] = useState("all");
  const [dbPhaseFilter, setDbPhaseFilter] = useState<'all' | 'pre' | 'post'>('all');
  const [dbSearch, setDbSearch] = useState("");
  const [dbSortOrder, setDbSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [adminLotFilter, setAdminLotFilter] = useState("all");
  const [adminDeptFilter, setAdminDeptFilter] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [resetModal, setResetModal] = useState<{
    open: boolean; user: DBRow | null; mode: 'temp' | 'manual' | null;
    manualPw: string; manualPwConfirm: string;
  }>({ open: false, user: null, mode: null, manualPw: '', manualPwConfirm: '' });
  const [tempPasswordModal, setTempPasswordModal] = useState<{ open: boolean; username: string; password: string }>({ open: false, username: '', password: '' });
  const [successModal, setSuccessModal] = useState<{
    open: boolean; username: string; message: string;
  }>({ open: false, username: '', message: '' });

  const fds = FDS[dbTab] ?? [];

  async function delRow(_idx: number, id: string | number) {
    console.log('[Admin delRow] tab:', dbTab, 'id:', id);
    const res = await fetch(`/api/${API_PATH[dbTab]}/${id}`, { method: 'DELETE' })
    console.log('[Admin delRow] DELETE status:', res.status);
    if (res.ok) {
      // ทุก tab รวม checklist_items — ลบออกจาก state เลย
      setDb(p => ({
        ...p,
        [dbTab]: p[dbTab].filter(r => String(r.id) !== String(id))
      }))
    } else {
      const err = await res.json().catch(() => ({}))
      console.error('[Admin delRow] error:', err);
      alert(`Delete failed: ${err.error || res.status}`)
    }
  }
  async function saveEdit() {
    if (!editing) return;
    const payload = dbTab === "users"
      ? { ...editing.row, roles: selectedRoles, allowed_depts: selectedDepts.join(",") || "all" }
      : dbTab === "checklist_items"
        ? { ...editing.row, form_type: selectedFormTypes.join(",") }
        : editing.row;
    console.log('[Admin saveEdit] tab:', dbTab, 'id:', editing.row.id);
    console.log('[Admin saveEdit] payload:', JSON.stringify(payload));
    const res = await fetch(`/api/${API_PATH[dbTab]}/${editing.row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const updated = await res.json();
    console.log('[Admin saveEdit] PATCH status:', res.status);
    if (res.ok) {
      // ← แก้ตรงนี้: filter by id ไม่ใช่ index
      setDb(p => ({
        ...p,
        [dbTab]: p[dbTab].map(r => String(r.id) === String(editing.row.id) ? updated : r)
      }));
      setEditing(null); setSelectedRoles([]); setSelectedDepts([]); setSelectedFormTypes([]);
    } else {
      console.error('[Admin saveEdit] error:', updated);
      alert('Save failed: ' + (updated.error || res.status));
    }
  }

  async function addRow() {
    // ประกาศ type ตรงๆ เป็น Record<string, any> — ถ้าปล่อยให้ TS อนุมานเองจาก ternary
    // จะได้ type เฉพาะของแต่ละ branch (ไม่มี index signature ครอบคลุมทุก key)
    // ทำให้ payload.name / payload.capacity_mt ที่ใช้ต่อด้านล่าง error และ assign null ไม่ได้
    let payload: Record<string, any> = dbTab === "users"
      ? { ...newRow, roles: selectedRoles, allowed_depts: selectedDepts.join(",") || "all" }
      : dbTab === "checklist_items"
        ? { ...newRow, form_type: selectedFormTypes.join(",") }
        : newRow;

    // Auto-detect packaging_category จากชื่อ — เฉพาะตอนที่ Admin ไม่ได้เลือกเองจาก dropdown เท่านั้น
    // (เดิม override payload.packaging_category ทับทุกครั้งไม่ว่า Admin จะเลือกอะไรมาก็ตาม)
    if (dbTab === "packaging" && !payload.packaging_category) {
      const name = (payload.name || "").toLowerCase()
      const category = name.includes("tote") ? "tote"
        : name.includes("ibc") ? "ibc"
          : name.includes("isotank") ? "isotank"
            : name.includes("flexibag") ? "flexibag"
              : "drum"
      payload = { ...payload, packaging_category: category }
    }

    // capacity_mt = null ถ้าไม่ได้กรอก
    if (dbTab === "blenders" && !payload.capacity_mt) {
      payload = { ...payload, capacity_mt: null }
    }
    console.log('[Admin addRow] tab:', dbTab);
    console.log('[Admin addRow] payload:', JSON.stringify(payload));
    const res = await fetch(`/api/${API_PATH[dbTab]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const created = await res.json();
    console.log('[Admin addRow] POST status:', res.status);
    if (res.ok) {
      setDb(p => ({ ...p, [dbTab]: [...p[dbTab], created] }));
      setNewRow({}); setSelectedRoles([]); setSelectedDepts([]); setSelectedFormTypes([]); setAddMode(false);
      if (dbTab === "users" && created.temp_password) {
        setTempPasswordModal({ open: true, username: String(created.username ?? ""), password: String(created.temp_password) });
      }
    } else {
      console.error('[Admin addRow] error:', created);
      alert('Add failed: ' + (created.error || res.status));
    }
  }

  async function toggleActive(idx: number, row: DBRow) {
    console.log('[Admin toggleActive] tab:', dbTab, 'id:', row.id, 'is_active →', !row.is_active);
    const res = await fetch(`/api/${API_PATH[dbTab]}/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !row.is_active }),
    });
    console.log('[Admin toggleActive] PATCH status:', res.status);
    if (res.ok) {
      setDb(p => ({ ...p, [dbTab]: p[dbTab].map((r, i) => i === idx ? { ...r, is_active: !r.is_active } : r) }));
    }
  }

  const roleCards: RoleCard[] = [
    {
      role: "Site Logistics",
      color: "#185FA5",
      border: "#185FA5",
      rows: [
        { l: "Draft", v: lots.filter(l => l.status === "draft").length },
        { l: "Pending Final", v: lots.filter(l => l.status === "head_approved").length },
        { l: "Complete", v: lots.filter(l => l.status === "completed").length },
      ],
    },
    {
      role: "Packer",
      color: "#018f35",
      border: "#019638",
      rows: [
        { l: "Pending", v: lots.filter(l => l.status === "waiting").length },
        {
          l: "Packing",
          v: lots.filter(l =>
            [
              "in_progress",
              "paused_shift_end",
              "paused_issue",
              "paused_emergency",
            ].includes(l.status)
          ).length,
        },
        { l: "Rejected", v: lots.filter(l => l.status === "rejected").length },
      ],
    },
    {
      role: "Pack Lead",
      color: "#4d01d1",
      border: "#4d01d1",
      rows: [
        { l: "Pending Review", v: lots.filter(l => l.status === "submitted").length },
        { l: "Approved", v: lots.filter(l => l.status === "head_approved").length },
        { l: "Complete", v: lots.filter(l => l.status === "completed").length },
      ],
    },
  ];

  const statusFilters: StatusFilter[] = ([
    { k: "all", l: "All", icon: <LayoutGrid size={14} />, col: "#0E1117", bg: "#F4F5F7" },
    { k: "draft", l: "Draft", icon: <FileText size={14} />, col: "#5F5E5A", bg: "#F1EFE8" },
    { k: "waiting", l: "Waiting", icon: <Clock size={14} />, col: "#633806", bg: "#FEF3C7" },
    { k: "in_progress", l: "In Progress", icon: <Play size={14} />, col: "#185FA5", bg: "#E6F1FB" },
    { k: "paused_shift_end", l: "Shift End", icon: <PauseCircle size={14} />, col: "#854F0B", bg: "#FEF3C7" },
    { k: "paused_issue", l: "Issue", icon: <AlertTriangle size={14} />, col: "#791F1F", bg: "#FCEBEB" },
    // { k: "paused_emergency", l: "Emergency", icon: <AlertOctagon size={14} />, col: "#501313", bg: "#FCEBEB" },
    { k: "rejected", l: "Rejected", icon: <XCircle size={14} />, col: "#791F1F", bg: "#FCEBEB" },
    { k: "submitted", l: "Submitted", icon: <CheckCircle size={14} />, col: "#534AB7", bg: "#EEEDFE" },
    { k: "head_approved", l: "PL Approved", icon: <CheckCircle2 size={14} />, col: "#854F0B", bg: "#FEF3C7" },
    { k: "completed", l: "Complete", icon: <Check size={14} />, col: "#27500A", bg: "#EAF3DE" },
  ] as Omit<StatusFilter, "cnt">[]).map(def => ({
    ...def,
    cnt: def.k === "all" ? lots.length : lots.filter(l => l.status === def.k).length,
  }));

  const filteredLots = lots.filter(l => {
    const statusOk = adminLotFilter === "all" || l.status === adminLotFilter;
    const deptOk = adminDeptFilter.length === 0 || adminDeptFilter.includes(l.dept);
    return statusOk && deptOk;
  });

  const sortedLots = [...filteredLots].sort((a, b) => {
    const dateA = new Date(a.packing_date || 0).getTime();
    const dateB = new Date(b.packing_date || 0).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const DC: Record<string, { bg: string; c: string }> = {
    PUF: { bg: "#EEEDFE", c: "#26215C" },
    PU: { bg: "#E6F1FB", c: "#042C53" },
    IBC: { bg: "#FCEBEB", c: "#501313" },
    Latex: { bg: "#E1F5EE", c: "#04342C" },
  };

  const dbRows = (db[dbTab] ?? []).filter(row => {
    const deptOk = dbDeptFilter === "all"
      || (dbTab === "checklist_items"
        ? String(row.form_type ?? "").split(",").map(s => s.trim()).includes(dbDeptFilter)
        : row.dept === dbDeptFilter);
    const tabHasDeptFilter = dbTab === "products" || dbTab === "blenders" || dbTab === "checklist_items";
    const searchOk = !dbSearch || Object.values(row).some(v => String(v ?? "").toLowerCase().includes(dbSearch.toLowerCase()));
    return (!tabHasDeptFilter || deptOk) && searchOk;
  });

  const filteredDbRows = dbTab === "checklist_items"
    ? dbRows.filter(row => dbPhaseFilter === 'all' || row.phase === dbPhaseFilter)
    : dbRows;

  const sortedDbRows = [...filteredDbRows].sort((a, b) => {
    const dateA = new Date(String(a.created_at ?? 0)).getTime();
    const dateB = new Date(String(b.created_at ?? 0)).getTime();
    return dbSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });


  return (
    <div className="font-sans">
      {/* ── View navigation ── */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          ["dashboard", "Dashboard", "#E24B4A"],
          ["db", "Database Management", "#E24B4A"],
          ["success", "Success / History", "#27500A"],
          ["edit_lot", "Edit Lot", "#534AB7"],
        ] as [ViewType, string, string][]).map(([v, label, activeColor]) => (
          <Btn key={v} label={label} sm
            color={view === v ? activeColor : "#9BA3BA"}
            outline={view !== v}
            onClick={() => setView(v)}
          />
        ))}
      </div>

      {/* ── Success / History view ── */}
      {view === "success" && (
        <div>
          <div className="text-[16px] font-semibold text-[#0E1117] mb-1">Success / History</div>
          <div className="text-[12px] text-[#9BA3BA] mb-4">Completed lots — query by date range, dept, keyword</div>
          <SuccessTab
            lots={lots as any}
            isAdmin={true}
            onEdit={(lot) => { setEditLot(lot as Lot); setView("edit_lot"); }}
            onViewProgress={(lot) => { setProgressLot(lot as any); setView("packer_progress"); }}
          />
        </div>
      )}

      {/* ── Edit Lot view ── */}
      {view === "edit_lot" && (
        <AdminEditLot
          lots={lots as any}
          setLots={setLots as any}
          editLot={editLot as any}
          setEditLot={setEditLot as any}
        />
      )}

      {/* ── Packer Progress view ── */}
      {view === "packer_progress" && progressLot && (
        <PKFormViewer
          lot={progressLot as any}
          onBack={() => { setView("dashboard"); setProgressLot(null); }}
          currentUser=""
          setLots={setLots as any}
          readOnly={true}
        />
      )}

      {/* ── Dashboard view ── */}
      {view === "dashboard" && (
        <>
          {/* Role cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {roleCards.map((rc, ri) => (
              <Card key={ri} className="px-[18px] py-4" accentTop={rc.border}>
                <div className="flex items-center gap-2 mb-3.5">
                  {rc.icon && <span className="text-[20px]">{rc.icon}</span>}
                  <span className="text-[15px] font-semibold" style={{ color: rc.color }}>{rc.role}</span>
                </div>
                {rc.rows.map((row, i) => (
                  <div key={i} className={`flex justify-between items-center py-2.5 ${i > 0 ? "border-t border-[#DDE2EE]" : ""}`}>
                    <span className="text-[13px] text-[#5A617A]">{row.l}</span>
                    <span className="text-[16px] font-bold   " style={{ color: rc.color }}>{row.v}</span>
                  </div>
                ))}
              </Card>
            ))}
          </div>

          <SectionLabel>All Lots</SectionLabel>

          {/* Status + Dept filter */}
          <div className="bg-white border-[0.5px] border-[#DDE2EE] rounded-xl px-3 py-2.5 mb-3.5">
            <div
              className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b-[0.5px] border-[#DDE2EE]"
            >

              {statusFilters.map(({ k, l, cnt, icon, col, bg }) => {
                const active = adminLotFilter === k;
                return (
                  <button key={k} onClick={() => setAdminLotFilter(k)}
                    className="flex-shrink-0 flex items-center gap-[5px] px-3 py-1.5 rounded-[20px] text-xs cursor-pointer transition-all whitespace-nowrap"
                    style={{
                      fontWeight: active ? 600 : 400,
                      background: active ? bg : "transparent",
                      color: active ? col : "#9BA3BA",
                      border: `0.5px solid ${active ? col : "transparent"}`,
                    }}>
                    <span className="text-[13px]">{icon}</span>
                    {l}
                    <span className="text-[10px] font-bold px-1.5 py-px rounded-[10px] min-w-[16px] text-center"
                      style={{ background: active ? col : "#DDE2EE", color: active ? "#fff" : "#9BA3BA" }}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-[#9BA3BA] mr-0.5">Dept:</span>
              {(["PUF", "PU", "IBC", "Latex"] as DeptKey[]).map(d => {
                const on = adminDeptFilter.includes(d);
                const dc = DEPT[d]?.accent || "#185FA5";
                return (
                  <button key={d}
                    onClick={() => setAdminDeptFilter(prev =>
                      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
                    )}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer border-[0.5px]"
                    style={{
                      borderColor: on ? dc : "#DDE2EE",
                      background: on ? DEPT[d].badge.bg : "#F4F5F7",
                      color: on ? dc : "#9BA3BA",
                    }}>
                    {on && <span className="text-[10px] font-bold" style={{ color: dc }}>✓</span>}
                    {DEPT[d]?.icon} {d}
                  </button>
                );
              })}
              {adminDeptFilter.length > 0 && (
                <button onClick={() => setAdminDeptFilter([])}
                  className="text-[11px] text-[#9BA3BA] bg-transparent border-none cursor-pointer px-1.5 py-1">
                  Clear ×
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setSortOrder(p => p === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-[#0F2347] font-medium border-[0.5px] border-[#DDE2EE] bg-white cursor-pointer"
                >
                  {sortOrder === 'newest'
                    ? <><ArrowDown size={12} /> Newest</>
                    : <><ArrowUp size={12} /> Oldest</>
                  }
                </button>
                <span className="text-[11px] text-[#9BA3BA]">{filteredLots.length} lot{filteredLots.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          {/* Lot table */}
          <div className="border border-[#DDE2EE] rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[36px_1fr_68px_90px_68px_130px_36px] gap-x-2 px-3 py-2.5 bg-[#0F2347]">
              {["ID", "PRODUCT / LOT", "DEPT", "DATE", "TARGET", "STATUS", ""].map(h => (
                <div key={h} className="text-[11px] font-bold text-white/50 uppercase tracking-wide">{h}</div>
              ))}
            </div>
            {/* Rows */}
            {sortedLots.map((l, i) => (
              <div key={String(l.id)}
                onClick={() => { setProgressLot(l); setView("packer_progress"); }}
                className={[
                  "grid grid-cols-[36px_1fr_68px_90px_68px_130px_36px] gap-x-2 px-3 py-3 items-center cursor-pointer hover:bg-[#F4F5F7] transition-colors border-t border-[#DDE2EE]",
                  i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]",
                ].join(" ")}
              >
                {/* ID */}
                <div className="text-[11px] text-[#9BA3BA]">#{(l as any).display_no ?? l.id}</div>

                {/* Product / Lot / Creator */}
                <div className="min-w-0">
                  {/* Lot ID badge */}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold text-[#185FA5] bg-[#E6F1FB] px-1.5 py-0.5 rounded font-mono">
                      {l.lot || (l as any).lot_no || '—'}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-[#0E1117] truncate">{l.product}</div>
                  <div className="text-[11px] text-[#9BA3BA] flex items-center gap-2 mt-0.5 truncate">
                    {/* ส่วนของคนสร้าง */}
                    {(l as any).plan_created_by && (
                      <span className="flex items-center gap-1">
                        <UserPlus className="w-3 h-3 flex-shrink-0 opacity-70" />
                        <span className="truncate">{(l as any).plan_created_by}</span>
                      </span>
                    )}

                    {/* จุดคั่นกลาง (แสดงเมื่อมีทั้งคนสร้างและคนอัปเดต และต้องไม่ซ้ำกัน) */}
                    {(l as any).plan_updated_by && (l as any).plan_updated_by !== (l as any).plan_created_by && (l as any).plan_created_by && (
                      <span className="text-[#DDE2EE]">•</span>
                    )}

                    {/* ส่วนของคนอัปเดต */}
                    {(l as any).plan_updated_by && (l as any).plan_updated_by !== (l as any).plan_created_by && (
                      <span className="flex items-center gap-1 text-[#78829D]"> {/* ใช้สีเข้มขึ้นนิดนึงให้เห็นความต่าง */}
                        <Pencil className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
                        <span className="truncate">{(l as any).plan_updated_by}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Dept */}
                <div className="flex items-center"><DeptBadge dept={l.dept} /></div>

                {/* Date */}
                <div className="text-[12px] text-[#5A617A]">{formatDate(l.packing_date)}</div>

                {/* Target */}
                <div className="text-[13px] font-bold"
                  style={{ color: (l.dept in DEPT ? DEPT[l.dept as DeptKey].accent : "#185FA5") }}>
                  {l.target_mt} MT
                </div>

                {/* Status */}
                <div className="flex items-center overflow-hidden">
                  <Badge s={l.status} />
                </div>

                {/* Edit */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={e => { e.stopPropagation(); setEditLot(l); setView("edit_lot"); }}
                    className="p-1.5 rounded-lg hover:bg-[#E6F1FB] transition-colors cursor-pointer border-none bg-transparent"
                  >
                    <PencilLine size={14} className="text-[#185FA5]" />
                  </button>
                </div>
              </div>
            ))}
            {sortedLots.length === 0 && (
              <div className="text-center py-8 text-[#9BA3BA] text-[13px] border-t border-[#DDE2EE]">No lots in this status</div>
            )}
          </div>
        </>
      )}

      {/* ── Database management view ── */}
      {view === "db" && (
        loading ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-sm">Loading data...</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3.5">
              <div className="text-[16px] font-medium text-[#0E1117]">Database Management</div>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={dbSearch}
                    onChange={e => { setDbSearch(e.target.value); setEditing(null); }}
                    placeholder="Search..."
                    className="h-10 pl-8 pr-3 text-[13px] border border-[#DDE2EE] rounded-lg outline-none w-44 focus:border-[#0F2347]"
                  />
                </div>

                {/* Sort */}
                <button
                  onClick={() => setDbSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
                  className="flex items-center gap-1.5 h-10 px-3 text-[12px] font-medium border border-[#DDE2EE] rounded-lg cursor-pointer bg-white text-[#0F2347]"
                >
                  {dbSortOrder === 'newest'
                    ? <><ArrowDown size={12} /> Newest first</>
                    : <><ArrowUp size={12} /> Oldest first</>
                  }
                </button>

                {/* Add */}
                {!addMode && (
                  <Btn
                    label={`+ Add ${DB_TABS.find(t => t.k === dbTab)?.l || 'Row'}`}
                    color="#E24B4A"
                    sm
                    onClick={() => {
                      setAddMode(true)
                      if (dbTab === "checklist_items") {
                        setNewRow(p => ({ ...p, is_required: "true" }))
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* DB tab bar */}

            <div className="flex gap-0 border-b border-[#DDE2EE] mb-3">
              {DB_TABS.map(t => (
                <button key={t.k}
                  onClick={() => { setDbTab(t.k); setEditing(null); setAddMode(false); setDbDeptFilter("all"); setDbPhaseFilter('all'); setDbSearch(""); setDbSortOrder('newest'); setSelectedFormTypes([]); }}
                  className={[
                    "px-4 py-2 text-[13px] border-b-2 cursor-pointer bg-transparent border-x-0 border-t-0 -mb-px",
                    dbTab === t.k
                      ? "text-[#E24B4A] font-medium border-[#E24B4A]"
                      : "text-[#9BA3BA] font-normal border-transparent",
                  ].join(" ")}
                >
                  {t.l}
                </button>
              ))}
            </div>

            {/* Dept filter (products, blenders & checklist_items) */}
            {(dbTab === "products" || dbTab === "blenders" || dbTab === "checklist_items") && (
              <div className="flex gap-1.5 mb-3 flex-wrap items-center">
                <span className="text-[11px] text-[#9BA3BA] font-medium mr-0.5">Dept:</span>
                {["all", "PUF", "PU", "IBC", "Latex"].map(d => {
                  const active = dbDeptFilter === d;
                  const dc = DC[d] ?? { bg: "#F4F5F7", c: "#5A617A" };
                  return (
                    <button key={d} onClick={() => setDbDeptFilter(d)}
                      className="px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer"
                      style={{
                        background: active ? dc.bg : "transparent",
                        color: active ? dc.c : "#9BA3BA",
                        border: `0.5px solid ${active ? dc.c : "#DDE2EE"}`,
                      }}
                    >
                      {d === "all" ? "All Depts" : d}
                    </button>
                  );
                })}
                {dbTab === "checklist_items" && (
                  <>
                    <span className="text-[#DDE2EE] mx-0.5 select-none">|</span>
                    <span className="text-[11px] text-[#9BA3BA] font-medium">Phase:</span>
                    {([
                      { v: "all", l: "All", bg: "#F4F5F7", c: "#5A617A", border: "#DDE2EE" },
                      { v: "pre", l: "Pre-check", bg: "#E6F1FB", c: "#185FA5", border: "#185FA5" },
                      { v: "post", l: "Post-check", bg: "#EAF3DE", c: "#27500A", border: "#27500A" },
                    ] as const).map(({ v, l, bg, c, border }) => {
                      const active = dbPhaseFilter === v;
                      return (
                        <button key={v} onClick={() => setDbPhaseFilter(v)}
                          className="px-3 py-1 rounded-full text-[11px] font-medium cursor-pointer"
                          style={{
                            background: active ? bg : "transparent",
                            color: active ? c : "#9BA3BA",
                            border: `0.5px solid ${active ? border : "#DDE2EE"}`,
                          }}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </>
                )}
                <span className="text-[11px] text-[#9BA3BA] ml-1">
                  {sortedDbRows.length} items
                </span>
              </div>
            )}

            {/* Add row — shown above the table */}
            {addMode && (
              <Card className="border border-[#E24B4A] mb-3">
                <div className="text-[13px] font-medium text-[#E24B4A] mb-3">
                  Add New {DB_TABS.find(t => t.k === dbTab)?.l || 'Row'}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {fds.map(f => (
                    <div key={f.k}>
                      <div className="text-[12px] text-[#5A617A] mb-1">
                        {f.l}{f.req && <span className="text-[#E24B4A] ml-0.5">*</span>}
                      </div>
                      {f.k === "roles" ? (
                        <>
                          <div className="flex gap-1.5 flex-wrap pt-1">
                            {ALL_ROLES.map(role => {
                              const on = selectedRoles.includes(role);
                              const disabled = !on && selectedRoles.length >= 2;
                              const c = ROLE_COLORS[role];
                              return (
                                <button key={role} onClick={() => !disabled && toggleRole(role)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px]"
                                  style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer", background: on ? c.bg : "#F4F5F7", color: on ? c.color : "#9BA3BA", borderColor: on ? c.border : "#DDE2EE" }}>
                                  {on && <CheckCircle2 size={12} />}{role}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-[#9BA3BA] mt-1.5">
                            Max 2 roles ({selectedRoles.length}/2)
                            {selectedRoles.length >= 2 && <span className="text-[#CC0000] ml-1">— Maxed out</span>}
                          </div>
                        </>
                      ) : f.k === "allowed_depts" ? (
                        <>
                          <div className="flex gap-1.5 flex-wrap pt-1">
                            {ALL_DEPTS.map(dept => {
                              const on = selectedDepts.includes(dept);
                              const c = DEPT_COLORS[dept];
                              return (
                                <button key={dept} onClick={() => toggleDept(dept)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                                  style={{ background: on ? c.bg : "#F4F5F7", color: on ? c.color : "#9BA3BA", borderColor: on ? c.border : "#DDE2EE" }}>
                                  {on && <CheckCircle2 size={12} />}
                                  {dept === "all" ? "All Depts" : dept}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-[#9BA3BA] mt-1.5">
                            Select "All" or specific departments ({selectedDepts.join(", ") || "none"})
                          </div>
                        </>
                      ) : f.k === "allowed_form_types" ? (
                        <>
                          <div className="flex gap-1.5 flex-wrap pt-1">
                            <button onClick={() => toggleFormType("all")}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                              style={{ background: selectedFormTypes.length === 4 ? DEPT_COLORS.all.bg : "#F4F5F7", color: selectedFormTypes.length === 4 ? DEPT_COLORS.all.color : "#9BA3BA", borderColor: selectedFormTypes.length === 4 ? DEPT_COLORS.all.border : "#DDE2EE" }}>
                              {selectedFormTypes.length === 4 && <CheckCircle2 size={12} />} All Depts
                            </button>
                            {ALL_FORM_TYPES.map(dept => {
                              const on = selectedFormTypes.includes(dept);
                              const c = DEPT_COLORS[dept];
                              return (
                                <button key={dept} onClick={() => toggleFormType(dept)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                                  style={{ background: on ? c.bg : "#F4F5F7", color: on ? c.color : "#9BA3BA", borderColor: on ? c.border : "#DDE2EE" }}>
                                  {on && <CheckCircle2 size={12} />}{dept}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-[#9BA3BA] mt-1.5">Selected: {selectedFormTypes.join(", ") || "none"}</div>
                        </>
                      ) : f.k === "form_type" ? (
                        <>
                          <div className="flex gap-1.5 flex-wrap pt-1">
                            <button onClick={() => toggleFormType("all")}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                              style={{ background: selectedFormTypes.length === 4 ? DEPT_COLORS.all.bg : "#F4F5F7", color: selectedFormTypes.length === 4 ? DEPT_COLORS.all.color : "#9BA3BA", borderColor: selectedFormTypes.length === 4 ? DEPT_COLORS.all.border : "#DDE2EE" }}>
                              {selectedFormTypes.length === 4 && <CheckCircle2 size={12} />} All Depts
                            </button>
                            {ALL_FORM_TYPES.map(dept => {
                              const on = selectedFormTypes.includes(dept);
                              const c = DEPT_COLORS[dept];
                              return (
                                <button key={dept} onClick={() => toggleFormType(dept)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                                  style={{ background: on ? c.bg : "#F4F5F7", color: on ? c.color : "#9BA3BA", borderColor: on ? c.border : "#DDE2EE" }}>
                                  {on && <CheckCircle2 size={12} />}{dept}
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-[#9BA3BA] mt-1.5">Selected: {selectedFormTypes.join(", ") || "none"}</div>
                          {dbTab === "checklist_items" && selectedFormTypes.length === 0 && (
                            <div className="text-[11px] text-[#E24B4A] mt-1.5">
                              เลือกอย่างน้อย 1 แผนก
                            </div>
                          )}
                        </>
                      ) : f.k === "pack_lead_id" ? (
                        <select
                          value={newRow[f.k] ?? ""}
                          onChange={e => setNewRow(p => ({ ...p, pack_lead_id: e.target.value }))}
                          className="w-full h-12 px-2.5 text-[12px] border border-[#DDE2EE] rounded-lg box-border"
                        >
                          <option value="">Select Pack Lead...</option>
                          {db.users
                            .filter(u => {
                              const roles = Array.isArray(u.roles) ? u.roles as string[] : String(u.roles ?? "").split(",");
                              return roles.some(r => r.trim() === "pl");
                            })
                            .map(u => (
                              <option key={String(u.id)} value={String(u.id)}>{String(u.full_name || u.username || "")}</option>
                            ))
                          }
                        </select>
                      ) : f.k === "select_options" ? (
                        <OptionsTagInput
                          value={(() => { try { return JSON.parse(newRow.select_options || '[]') } catch { return [] } })()}
                          onChange={opts => setNewRow(p => ({ ...p, select_options: JSON.stringify(opts) }))}
                        />
                      ) : f.opts ? (
                        <select
                          value={newRow[f.k] ?? ""}
                          onChange={e => setNewRow(p => ({ ...p, [f.k]: e.target.value }))}
                          className="w-full h-12 px-2.5 text-[12px] border border-[#DDE2EE] rounded-lg box-border"
                        >
                          <option value="">— select —</option>
                          {f.opts.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <>
                          <input
                            type={f.type || "text"}
                            value={newRow[f.k] ?? ""}
                            placeholder={f.l}
                            onChange={e => setNewRow(p => ({ ...p, [f.k]: e.target.value }))}
                            className="w-full h-12 px-2.5 text-[12px] border border-[#DDE2EE] rounded-lg box-border"
                          />
                          {f.k === "password" && (
                            <div className="text-[11px] text-[#9BA3BA] mt-1">
                              At least 8 characters, containing numbers and uppercase letters.
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Btn label="Add" color="#E24B4A" sm disabled={dbTab === "checklist_items" && selectedFormTypes.length === 0} onClick={addRow} />
                  <Btn label="Cancel" color="#9BA3BA" outline sm onClick={() => { setAddMode(false); setNewRow({}); setSelectedRoles([]); setSelectedDepts([]); setSelectedFormTypes([]); }} />
                </div>
              </Card>
            )}

            {/* DB table */}
            <div className="overflow-x-auto mb-3">
              <div className={dbTab !== "users" ? "min-w-[1200px]" : ""}>
                <div className="bg-white border border-[#DDE2EE] rounded-xl overflow-hidden">
                  {/* Header — non-users tabs only */}
                  {dbTab !== "users" && (
                    <div className="flex bg-[#0F2347] px-3.5 py-2.5 gap-2">
                      {fds.map(f => (
                        <div key={f.k} className="flex-1 text-[10px] font-medium text-white/45 uppercase">{f.l}</div>
                      ))}
                      <div className="text-[10px] text-white/45 w-[130px]">Actions</div>
                    </div>
                  )}


                  {/* Data rows */}

                  {sortedDbRows.map((row, idx) => (
                    dbTab === "users" ? (
                      /* ── USERS: collapsible card ── */
                      <div key={String(row.id ?? idx)} className="border-b border-[#DDE2EE]">
                        <div className="flex items-center px-3.5 py-2.5 gap-2 cursor-pointer hover:bg-blue-50 transition-colors"
                          style={{ background: idx % 2 === 0 ? "#fff" : "#f9fafb" }}
                          onClick={() => toggleRow(idx)}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: "#185FA5" }}>
                            {String(row.full_name ?? row.username ?? "?")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-[#0E1117] truncate">{String(row.full_name ?? "")}</div>
                            <div className="text-[11px] text-[#9BA3BA] ">{String(row.username ?? "")}</div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {(Array.isArray(row.roles) ? row.roles as string[] : String(row.roles ?? "").split(",").filter(Boolean)).map(role => {
                              const c = ROLE_COLORS[role.trim()] ?? { bg: "#F4F5F7", color: "#5A617A", border: "#DDE2EE" };
                              return <span key={role} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border-[1px]" style={{ background: c.bg, color: c.color, borderColor: c.border }}>{role.trim()}</span>;
                            })}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {String(row.allowed_depts ?? "all").split(",").filter(Boolean).slice(0, 2).map(dept => {
                              const c = DEPT_COLORS[dept.trim()] ?? DEPT_COLORS.all;
                              return <span key={dept} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border-[1px]" style={{ background: c.bg, color: c.color, borderColor: c.border }}>{dept.trim()}</span>;
                            })}
                          </div>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${row.is_active ? "bg-[#EAF3DE] text-[#27500A]" : "bg-[#FCEBEB] text-[#791F1F]"}`}>
                            {row.is_active ? "Active" : "Inactive"}
                          </span>
                          <ChevronDown size={16} className="text-[#9BA3BA] flex-shrink-0 transition-transform"
                            style={{ transform: (expandedRows.has(idx) || editing?.idx === idx) ? "rotate(180deg)" : "rotate(0deg)" }} />
                        </div>
                        {(expandedRows.has(idx) || editing?.idx === idx) && (
                          <div className="px-3.5 py-3 bg-[#F8FAFC] border-t border-[#DDE2EE]">
                            {editing?.idx === idx ? (
                              <div className="flex flex-wrap gap-2">
                                {fds.map((f, fi) => {
                                  const colW = (["w-[120px]", "w-[120px]", "w-[140px]", "w-[160px]", "w-[120px]", "w-[80px]"][fi] ?? "flex-1");
                                  return (
                                    <div key={f.k} className={colW}>
                                      <div className="text-[10px] text-[#9BA3BA] mb-1 uppercase">{f.l}</div>
                                      {f.k === "pack_lead_id" ? (
                                        <select value={String(editing.row[f.k] ?? "")} onChange={e => setEditing(p => p ? { ...p, row: { ...p.row, pack_lead_id: e.target.value } } : null)} className="w-full h-10 px-2 text-[12px] border border-[#DDE2EE] rounded-md">
                                          <option value="">Select Pack Lead...</option>
                                          {db.users.filter(u => { const r = Array.isArray(u.roles) ? u.roles as string[] : String(u.roles ?? "").split(","); return r.some(x => x.trim() === "pl"); }).map(u => <option key={String(u.id)} value={String(u.id)}>{String(u.full_name || u.username || "")}</option>)}
                                        </select>
                                      ) : f.opts ? (
                                        <select value={editing.row[f.k] == null ? "" : String(editing.row[f.k])} onChange={e => setEditing(p => p ? { ...p, row: { ...p.row, [f.k]: e.target.value } } : null)} className="w-full h-10 px-2 text-[12px] border border-[#DDE2EE] rounded-md">
                                          {f.opts.map(o => <option key={o}>{o}</option>)}
                                        </select>
                                      ) : f.k === "roles" ? (
                                        <>
                                          <div className="flex gap-1.5 flex-wrap pt-1">
                                            {ALL_ROLES.map(role => {
                                              const on = selectedRoles.includes(role);
                                              const disabled = !on && selectedRoles.length >= 2;
                                              const c = ROLE_COLORS[role];
                                              return <button key={role} onClick={() => !disabled && toggleRole(role)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border-[1.5px]" style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer", background: on ? c.bg : "#F4F5F7", color: on ? c.color : "#9BA3BA", borderColor: on ? c.border : "#DDE2EE" }}>{on && <CheckCircle2 size={11} />}{role}</button>;
                                            })}
                                          </div>
                                          <div className="text-[11px] text-[#9BA3BA] mt-1.5">Max 2 roles ({selectedRoles.length}/2){selectedRoles.length >= 2 && <span className="text-[#CC0000] ml-1">— Maxed out</span>}</div>
                                        </>
                                      ) : f.k === "allowed_depts" ? (
                                        <>
                                          <div className="flex gap-1.5 flex-wrap pt-1">
                                            {ALL_DEPTS.map(dept => {
                                              const on = selectedDepts.includes(dept);
                                              const c = DEPT_COLORS[dept];
                                              return <button key={dept} onClick={() => toggleDept(dept)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer" style={{ background: on ? c.bg : "#F4F5F7", color: on ? c.color : "#9BA3BA", borderColor: on ? c.border : "#DDE2EE" }}>{on && <CheckCircle2 size={11} />}{dept === "all" ? "All Depts" : dept}</button>;
                                            })}
                                          </div>
                                          <div className="text-[11px] text-[#9BA3BA] mt-1.5">Select "All" or specific departments ({selectedDepts.join(", ") || "none"})</div>
                                        </>
                                      ) : (
                                        <input type={f.type || "text"} value={safeStr(editing.row[f.k])} onChange={e => setEditing(p => p ? { ...p, row: { ...p.row, [f.k]: e.target.value } } : null)} className="w-full h-10 px-2 text-[12px] border border-[#DDE2EE] rounded-md" />
                                      )}
                                    </div>
                                  );
                                })}
                                <div className="flex gap-1 items-end pb-1">
                                  <Btn label="Save" color="#27500A" sm onClick={saveEdit} />
                                  <Btn label="Cancel" color="#9BA3BA" outline sm onClick={() => { setEditing(null); setSelectedRoles([]); setSelectedDepts([]); setSelectedFormTypes([]); }} />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 gap-2 mb-3">
                                  {([
                                    { l: "Pack Lead", v: (() => { const pl = db.users.find(u => String(u.id) === String(row.pack_lead_id)); return pl ? String(pl.full_name ?? pl.username ?? "—") : "—"; })() },
                                  ] as { l: string; v: string }[]).map(({ l, v }) => (
                                    <div key={l} className="bg-white rounded-lg px-3 py-2 border border-[#DDE2EE]">
                                      <div className="text-[10px] text-[#9BA3BA] mb-0.5">{l}</div>
                                      <div className="text-[12px] font-medium text-[#0E1117]">{v}</div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <Btn label="Edit" color="#534AB7" sm onClick={() => {
                                    setEditing({ idx, row: { ...row } })

                                    const rolesVal = Array.isArray(row.roles)
                                      ? row.roles as string[]
                                      : String(row.roles ?? "").split(",").filter(Boolean)
                                    setSelectedRoles(rolesVal)

                                    const deptsVal = Array.isArray(row.allowed_depts)
                                      ? row.allowed_depts as string[]
                                      : String(row.allowed_depts ?? 'all').split(',').filter(Boolean)
                                    setSelectedDepts(deptsVal.length > 0 ? deptsVal : ['all'])

                                    setExpandedRows(prev => {
                                      const next = new Set(prev)
                                      next.add(idx)
                                      return next
                                    })
                                  }} />
                                  <button onClick={() => toggleActive(idx, row)} className={`h-9 px-3 rounded-lg text-[11px] font-medium cursor-pointer border ${row.is_active ? "bg-[#FCEBEB] text-[#791F1F] border-[#E24B4A]" : "bg-[#EAF3DE] text-[#27500A] border-[#27500A]"}`}>
                                    {row.is_active ? "Deactivate" : "Activate"}
                                  </button>
                                  <button
                                    className="h-9 px-3 rounded-lg text-[11px] font-medium cursor-pointer bg-[#FEF3C7] text-[#633806] border border-[#EF9F27]"
                                    onClick={() => setResetModal({ open: true, user: row, mode: null, manualPw: '', manualPwConfirm: '' })}
                                  >
                                    Reset Password
                                  </button>
                                  <Btn label="Delete" danger sm onClick={() => setDeleteTarget({ idx, id: row.id ?? idx, label: String(row.full_name || row.product_name || row.name || row.code || row.country_label || row.item_label || row.id) })} />
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── OTHER TABS: flat row ── */
                      <div key={String(row.id ?? idx)} className={`flex items-start px-3.5 py-2.5 gap-2 border-b border-[#DDE2EE] ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                        {fds.map(f => (
                          editing?.idx === idx ? (
                            <div key={f.k} className="flex-1">
                              {f.k === "allowed_form_types" ? (
                                <>
                                  <div className="flex gap-1.5 flex-wrap pt-1">
                                    <button onClick={() => toggleFormType("all")}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                                      style={{ background: selectedFormTypes.length === 4 ? DEPT_COLORS.all.bg : "#F4F5F7", color: selectedFormTypes.length === 4 ? DEPT_COLORS.all.color : "#9BA3BA", borderColor: selectedFormTypes.length === 4 ? DEPT_COLORS.all.border : "#DDE2EE" }}>
                                      {selectedFormTypes.length === 4 && <CheckCircle2 size={11} />} All Depts
                                    </button>
                                    {ALL_FORM_TYPES.map(dept => {
                                      const on = selectedFormTypes.includes(dept);
                                      const c = DEPT_COLORS[dept];
                                      return (
                                        <button key={dept} onClick={() => toggleFormType(dept)}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                                          style={{ background: on ? c.bg : "#F4F5F7", color: on ? c.color : "#9BA3BA", borderColor: on ? c.border : "#DDE2EE" }}>
                                          {on && <CheckCircle2 size={11} />}{dept}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="text-[11px] text-[#9BA3BA] mt-1.5">Selected: {selectedFormTypes.join(", ") || "none"}</div>
                                </>
                              ) : f.k === "form_type" ? (
                                <>
                                  <div className="flex gap-1.5 flex-wrap pt-1">
                                    <button onClick={() => toggleFormType("all")}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                                      style={{ background: selectedFormTypes.length === 4 ? DEPT_COLORS.all.bg : "#F4F5F7", color: selectedFormTypes.length === 4 ? DEPT_COLORS.all.color : "#9BA3BA", borderColor: selectedFormTypes.length === 4 ? DEPT_COLORS.all.border : "#DDE2EE" }}>
                                      {selectedFormTypes.length === 4 && <CheckCircle2 size={11} />} All Depts
                                    </button>
                                    {ALL_FORM_TYPES.map(dept => {
                                      const on = selectedFormTypes.includes(dept);
                                      const c = DEPT_COLORS[dept];
                                      return (
                                        <button key={dept} onClick={() => toggleFormType(dept)}
                                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] cursor-pointer"
                                          style={{ background: on ? c.bg : "#F4F5F7", color: on ? c.color : "#9BA3BA", borderColor: on ? c.border : "#DDE2EE" }}>
                                          {on && <CheckCircle2 size={11} />}{dept}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="text-[11px] text-[#9BA3BA] mt-1.5">Selected: {selectedFormTypes.join(", ") || "none"}</div>
                                  {dbTab === "checklist_items" && selectedFormTypes.length === 0 && (
                                    <div className="text-[11px] text-[#E24B4A] mt-1.5">
                                      เลือกอย่างน้อย 1 แผนก
                                    </div>
                                  )}
                                </>
                              ) : f.k === "select_options" ? (
                                <OptionsTagInput
                                  value={(() => {
                                    const v = editing.row.select_options
                                    if (Array.isArray(v)) return v as string[]
                                    try { return JSON.parse(String(v || '[]')) } catch { return [] }
                                  })()}
                                  onChange={opts => setEditing(p => p ? { ...p, row: { ...p.row, select_options: JSON.stringify(opts) } } : null)}
                                />
                              ) : f.opts ? (
                                <select value={editing.row[f.k] == null ? "" : String(editing.row[f.k])} onChange={e => setEditing(p => p ? { ...p, row: { ...p.row, [f.k]: e.target.value } } : null)} className="w-full h-10 px-2 text-[12px] border border-[#DDE2EE] rounded-md">
                                  {f.opts.map(o => <option key={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input type={f.type || "text"} value={safeStr(editing.row[f.k])} onChange={e => setEditing(p => p ? { ...p, row: { ...p.row, [f.k]: e.target.value } } : null)} className="w-full h-10 px-2 text-[12px] border border-[#DDE2EE] rounded-md" />
                              )}
                            </div>
                          ) : (
                            <div key={f.k} className="flex-1 text-[12px] text-[#0E1117] pt-1">
                              {f.k === "allowed_form_types" ? (
                                <div className="flex gap-1 flex-wrap">
                                  {(Array.isArray(row[f.k])
                                    ? row[f.k] as string[]
                                    : typeof row[f.k] === "string" && row[f.k]
                                      ? (() => { try { return JSON.parse(row[f.k] as string); } catch { return []; } })()
                                      : []
                                  ).map((dept: string) => {
                                    const c = DEPT_COLORS[dept] ?? DEPT_COLORS.all;
                                    return <span key={dept} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border-[1px]" style={{ background: c.bg, color: c.color, borderColor: c.border }}>{dept}</span>;
                                  })}
                                </div>
                              ) : f.k === "form_type" ? (
                                <div className="flex gap-1 flex-wrap">
                                  {String(row[f.k] ?? "").split(",").map(s => s.trim()).filter(Boolean).map((dept: string) => {
                                    const c = DEPT_COLORS[dept] ?? DEPT_COLORS.all;
                                    return <span key={dept} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border-[1px]" style={{ background: c.bg, color: c.color, borderColor: c.border }}>{dept}</span>;
                                  })}
                                </div>
                              ) : f.k === "select_options" ? (
                                <div className="flex gap-1 flex-wrap">
                                  {(Array.isArray(row[f.k]) ? row[f.k] as string[] : []).map((opt: string) => (
                                    <span key={opt} className="text-[10px] px-1.5 py-0.5 rounded bg-[#F4F5F7] border border-[#DDE2EE]">{opt}</span>
                                  ))}
                                </div>
                              ) : f.k === "is_active" || f.k === "status" ? (
                                <span className={`text-[11px] px-2 py-0.5 rounded-full ${safeStr(row[f.k]) === "true" || row[f.k] === "active" ? "bg-[#EAF3DE] text-[#27500A]" : "bg-[#FCEBEB] text-[#791F1F]"}`}>
                                  {safeStr(row[f.k]) === "true" || row[f.k] === "active" ? "Active" : "Inactive"}
                                </span>
                              ) : (
                                <span className={f.k === "gmid" || f.k === "code" ? "text-[11px]" : ""}>{safeStr(row[f.k])}</span>
                              )}
                            </div>
                          )
                        ))}
                        <div className="flex gap-1 flex-wrap items-start pt-0.5 w-[130px]">
                          {editing?.idx === idx ? (
                            <>
                              <Btn label="Save" color="#27500A" sm onClick={saveEdit} />
                              <Btn label="Cancel" color="#9BA3BA" outline sm onClick={() => { setEditing(null); setSelectedRoles([]); setSelectedDepts([]); setSelectedFormTypes([]); }} />
                            </>
                          ) : (
                            <>
                              <Btn label="Edit" color="#534AB7" sm onClick={() => {
                                setEditing({ idx, row: { ...row } });
                                if (dbTab === "checklist_items") {
                                  const ft = typeof row.form_type === "string" && row.form_type
                                    ? row.form_type.split(",").map(s => s.trim()).filter(Boolean)
                                    : Array.isArray(row.form_type) ? row.form_type as string[] : [];
                                  setSelectedFormTypes(ft);
                                }
                              }} />

                              <Btn label="Del" danger sm onClick={() => setDeleteTarget({ idx, id: row.id ?? idx, label: String(row.full_name || row.product_name || row.name || row.code || row.country_label || row.item_label || row.id) })} />
                            </>
                          )}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>

          </>
        )
      )}


      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5 backdrop-blur-sm"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl p-8 w-full max-w-[400px] shadow-2xl border border-gray-100 flex flex-col items-center text-center relative"
            onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
          >
            <button
              disabled={isDeleting}
              onClick={() => setDeleteTarget(null)}
              className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="text-[26px] font-light leading-none relative -top-[2px]">&times;</span>
            </button>

            <div className="w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center mb-5">
              <Trash2 size={44} className="text-[#E24B4A]" />
            </div>
            <h3 className="text-[22px] font-bold text-[#0F2347] mb-2 tracking-tight">
              Are you sure?
            </h3>

            <p className="text-[14px] text-[#5A617A] leading-relaxed mb-6 max-w-[320px] break-words">
              Do you really want to delete &ldquo;
              <span className="font-semibold text-[#0E1117]">
                {deleteTarget.label}
              </span>
              &rdquo;?<br /> This process cannot be undone.
            </p>

            <div className="grid grid-cols-2 gap-3 w-full mt-2">
              <Btn
                label="Cancel"
                color="#9BA3BA"
                outline
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
              />
              <Btn
                label={isDeleting ? "Deleting..." : "Delete"}
                danger
                full
                disabled={isDeleting}
                onClick={async (): Promise<void> => {
                  setIsDeleting(true);
                  try {
                    await delRow(deleteTarget.idx, deleteTarget.id);
                    setDeleteTarget(null);
                  } catch (error) {
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
      {/* ── Temp Password Modal ── */}
      {tempPasswordModal.open && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[400px]">
            <div className="flex items-center gap-2.5 mb-1">
              <KeyRound size={22} className="text-[#27500A]" />
              <div>
                <div className="text-[15px] font-semibold text-[#0E1117]">Temporary Password</div>
                <div className="text-[12px] text-[#9BA3BA]">{tempPasswordModal.username}</div>
              </div>
            </div>
            <div className="h-px bg-[#DDE2EE] my-3.5" />
            <div className="text-[12px] text-[#5A617A] mb-3">
              Share this password with the user directly. They must change it on first login.
            </div>
            <div className="font-mono text-[22px] font-bold text-[#185FA5] bg-[#E6F1FB] px-4 py-3 rounded-xl text-center tracking-widest mb-3 select-all">
              {tempPasswordModal.password}
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText(tempPasswordModal.password)}
              className="w-full h-11 mb-3 flex items-center justify-center gap-2 rounded-xl text-[13px] font-medium cursor-pointer bg-gray-100 text-[#5A617A] border border-[#DDE2EE]"
            >
              <Copy size={14} /> Copy to clipboard
            </button>
            <div className="bg-[#FEF3C7] border border-[#EF9F27] rounded-lg px-3 py-2.5 text-[12px] text-[#633806] mb-4">
              The system does not send automatic email. Notify the user directly.
            </div>
            <Btn label="Done" color="#185FA5" full onClick={() => setTempPasswordModal({ open: false, username: '', password: '' })} />
          </div>
        </div>
      )}
      {/* ── Success Modal (manual password reset) ── */}
      {successModal.open && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-8 w-full max-w-[380px] shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <div className="text-[18px] font-bold text-[#0F2347] mb-1">Password Updated</div>
            <div className="text-[13px] text-[#9BA3BA] mb-4">{successModal.username}</div>
            <div className="bg-[#F4F5F7] rounded-xl p-3 mb-5 text-[13px] text-[#5A617A]">
              {successModal.message}
            </div>
            <Btn
              label="Done"
              color="#27500A"
              full
              onClick={() => setSuccessModal({ open: false, username: '', message: '' })}
            />
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetModal.open && resetModal.user && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#DDE2EE]">
              <div className="w-10 h-10 bg-[#E6F1FB] rounded-full flex items-center justify-center">
                <KeyRound size={20} className="text-[#185FA5]" />
              </div>
              <div>
                <div className="text-[15px] font-bold text-[#0F2347]">Reset Password</div>
                <div className="text-[12px] text-[#9BA3BA]">
                  {String(resetModal.user.username ?? "")} · {String(resetModal.user.full_name ?? "")}
                </div>
              </div>
            </div>

            {/* Mode selection */}
            {!resetModal.mode && (
              <div className="space-y-3">
                <div className="text-[12px] text-[#5A617A] mb-3">Choose how to reset password:</div>
                <button
                  onClick={() => setResetModal(p => ({ ...p, mode: 'temp' }))}
                  className="w-full p-4 rounded-xl border-2 border-[#DDE2EE] hover:border-[#185FA5] hover:bg-[#E6F1FB] transition-all text-left cursor-pointer bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <Shuffle size={18} className="text-[#185FA5]" />
                    <div>
                      <div className="text-[13px] font-semibold text-[#0F2347]">Generate Temp Password</div>
                      <div className="text-[11px] text-[#9BA3BA] mt-0.5">Auto-generate DOW-xxxxxx password</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setResetModal(p => ({ ...p, mode: 'manual' }))}
                  className="w-full p-4 rounded-xl border-2 border-[#DDE2EE] hover:border-[#534AB7] hover:bg-[#EEEDFE] transition-all text-left cursor-pointer bg-transparent"
                >
                  <div className="flex items-center gap-3">
                    <PencilLine size={18} className="text-[#534AB7]" />
                    <div>
                      <div className="text-[13px] font-semibold text-[#0F2347]">Set Manual Password</div>
                      <div className="text-[11px] text-[#9BA3BA] mt-0.5">Type a custom password for this user</div>
                    </div>
                  </div>
                </button>
                <Btn label="Cancel" color="#9BA3BA" outline full
                  onClick={() => setResetModal({ open: false, user: null, mode: null, manualPw: '', manualPwConfirm: '' })}
                />
              </div>
            )}

            {/* Temp password mode */}
            {resetModal.mode === 'temp' && (
              <div>
                <div className="bg-[#E6F1FB] border border-[#185FA5] rounded-xl p-4 mb-4 text-center">
                  <div className="text-[11px] text-[#185FA5] font-bold uppercase tracking-wide mb-1">A temp password will be generated</div>
                  <div className="text-[12px] text-[#185FA5]">DOW-xxxxxx format · User must change on first login</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Btn label="Back" color="#9BA3BA" outline onClick={() => setResetModal(p => ({ ...p, mode: null }))} />
                  <Btn label="Generate & Reset" color="#185FA5" full
                    onClick={async () => {
                      const res = await fetch(`/api/users/${resetModal.user!.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reset_password: true }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setResetModal({ open: false, user: null, mode: null, manualPw: '', manualPwConfirm: '' })
                        setTempPasswordModal({ open: true, username: String(resetModal.user!.username ?? ""), password: String(data.temp_password ?? "") })
                      } else {
                        const err = await res.json().catch(() => ({}))
                        alert('Reset failed: ' + (String((err as { error?: string }).error ?? "") || res.status))
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Manual password mode */}
            {resetModal.mode === 'manual' && (
              <div>
                <div className="mb-3">
                  <div className="text-[11px] font-medium text-[#5A617A] mb-1.5">
                    New Password <span className="text-red-500">*</span>
                  </div>
                  <input
                    type="password"
                    value={resetModal.manualPw}
                    onChange={e => setResetModal(p => ({ ...p, manualPw: e.target.value }))}
                    placeholder="At least 8 characters"
                    className="w-full text-sm px-3 py-2.5 border border-[#DDE2EE] rounded-lg outline-none min-h-[44px]"
                  />
                </div>
                <div className="mb-4">
                  <div className="text-[11px] font-medium text-[#5A617A] mb-1.5">
                    Confirm Password <span className="text-red-500">*</span>
                  </div>
                  <input
                    type="password"
                    value={resetModal.manualPwConfirm}
                    onChange={e => setResetModal(p => ({ ...p, manualPwConfirm: e.target.value }))}
                    placeholder="Re-enter password"
                    className="w-full text-sm px-3 py-2.5 rounded-lg outline-none min-h-[44px]"
                    style={{ borderWidth: 1, borderStyle: 'solid', borderColor: resetModal.manualPwConfirm ? (resetModal.manualPw === resetModal.manualPwConfirm ? '#27500A' : '#E24B4A') : '#DDE2EE' }}
                  />
                  {resetModal.manualPwConfirm && resetModal.manualPw !== resetModal.manualPwConfirm && (
                    <div className="text-[11px] text-red-500 mt-1">Passwords do not match</div>
                  )}
                </div>
                <div className="bg-[#F4F5F7] rounded-xl p-3 mb-4">
                  <div className="text-[10px] font-bold text-[#9BA3BA] uppercase tracking-wide mb-1.5">Requirements</div>
                  {[
                    { ok: resetModal.manualPw.length >= 8, l: 'At least 8 characters' },
                    { ok: /[A-Z]/.test(resetModal.manualPw), l: 'Contains uppercase letter' },
                    { ok: /[0-9]/.test(resetModal.manualPw), l: 'Contains number' },
                  ].map(({ ok, l }) => (
                    <div key={l} className="flex items-center gap-2 mb-1">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: ok ? '#27500A' : '#DDE2EE' }}>
                        {ok && <span className="text-white text-[9px]">✓</span>}
                      </div>
                      <div className="text-[11px]" style={{ color: ok ? '#27500A' : '#9BA3BA' }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Btn label="Back" color="#9BA3BA" outline
                    onClick={() => setResetModal(p => ({ ...p, mode: null, manualPw: '', manualPwConfirm: '' }))}
                  />
                  <Btn label="Set Password" color="#534AB7" full
                    disabled={
                      resetModal.manualPw.length < 8 ||
                      !/[A-Z]/.test(resetModal.manualPw) ||
                      !/[0-9]/.test(resetModal.manualPw) ||
                      resetModal.manualPw !== resetModal.manualPwConfirm
                    }
                    onClick={async () => {
                      const res = await fetch(`/api/users/${resetModal.user!.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reset_password: true, manual_password: resetModal.manualPw }),
                      })
                      if (res.ok) {
                        setSuccessModal({
                          open: true,
                          username: String(resetModal.user!.username ?? ''),
                          message: 'Password has been updated successfully.',
                        })
                        setResetModal({ open: false, user: null, mode: null, manualPw: '', manualPwConfirm: '' })
                      } else {
                        const err = await res.json().catch(() => ({}))
                        alert('Reset failed: ' + (String((err as { error?: string }).error ?? "") || res.status))
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}