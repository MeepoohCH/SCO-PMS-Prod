"use client";

import React, { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { useSession } from "next-auth/react";
import {
  LayoutGrid,
  Play,
  CheckCircle,
  FileText,
  Check,
  Clock,
  AlertCircle,
  Search,
  AlertTriangle,
  AlertOctagon,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  PauseCircle,
  XCircle,
  CheckCircle2,
  PencilLine,
  ClipboardCheck,
  Eye,
  UserCircle,
  Trash2,
  X,
  FileEdit,
} from "lucide-react";
import PKFormViewer from "@/app/components/PKFormViewer";
import { formatDate, cleanDate } from "@/lib/utils";
import { DEPT, DEFAULT_SHIFTS, SHIFT_LABELS, emptyShift } from "../components/constants";
import type { DeptKey, DeptConfig } from "../components/constants";
import { Badge, DeptBadge, Card, Inp, Combo, Btn, ConfirmModal } from "../components/shared";
import { LotForm } from "../components/LotForm";
import type { LotPlan } from "../components/LotForm";
import { fetchAndFlattenLots, flattenLot } from "@/lib/fetchLots";
import { SuccessTab } from "./Login";
import { SFIELDS, LabelCalcBox, EmergencyIssueRow } from "./Admin";
import type { Lot, EmergencyLot } from "./Admin";

// ── Types ──────────────────────────────────────────────────────

type SLView = "dashboard" | "dept_select" | "new_plan" | "draft_edit" | "packer_progress" | "packer_progress_final";
type SelDept = DeptConfig & { id: DeptKey };

interface ImportResultItem { lot: string; blender: string; }
interface ImportResult {
  new: number;
  updated: number;
  skipped: number;
  updatedList: ImportResultItem[];
  skippedList: ImportResultItem[];
}

export interface SLPlan extends Lot {
  shifts?: Record<string, Record<string, unknown>>;
  shiftOrder?: string[];
  date?: string;
  blender_cap?: string;
  rn_ref?: string;
  draft_note?: string;
  _finalEdit?: boolean;
  product_name?: string;
  product_id?: number;
  lot_no?: string;
  country_label?: string;
  customer_id?: number;
  operator_name?: string;
  quality_status?: string;
  ibc_residue_kg?: string;
  ibc_empty_before_kg?: string;
  ibc_with_product_kg?: string;
  ibc_product_net_kg?: string;
  packaging_type?: string;
  packaging_type_id?: number;
  blender_id?: number;
  export_on_pallet?: boolean;
  empty_tank?: boolean;
  packaging_size_kg?: string;
  flush_blender?: string;
  planned_pallets?: number;
  done_pallets?: number;
  lot_drumming_start?: string;
  lot_drumming_end?: string;
  op_date?: string;
  batch_size_kg?: string | number;
  container_tote?: string | number;
  container_drum?: string | number;
  cap_large?: string | number;
  cap_small?: string | number;
  empty_drum_wt?: string | number;
  label_no_start?: string | number;
  label_no_end?: string | number;
  flush_kg?: string | number;
  purge_kg?: string | number;
  drain_kg?: string | number;
  label_count?: number;
  scale_type?: string;
  scale_weight?: string | number;
  scale_approved_by?: string;
  packer_name?: string;
  pl_approved_by?: string;
  submitted_at?: string;
  pl_approved_at?: string;
  pauseReason?: string;
  cut_off_date?: string;
}

interface SLScreenProps {
  lots: Lot[];
  setLots: Dispatch<SetStateAction<Lot[]>>;
}



// ── Date/time helpers ─────────────────────────────────────

function calcDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return "-"
  try {
    const diff = new Date(end).getTime() - new Date(start).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  } catch { return "-" }
}

// ════════════════════════════════════════════════════════════
// SLScreen
// ════════════════════════════════════════════════════════════

export default function SLScreen({ lots, setLots }: SLScreenProps) {
  const { data: session } = useSession();
  const allowedDepts = useMemo(() => {
    const d = session?.user?.allowed_depts ?? "all";
    if (!d || d === "all") return ["PUF", "PU", "IBC", "Latex"];
    return d.split(",").map(s => s.trim()).filter(Boolean);
  }, [session?.user?.allowed_depts]);

  const [view, setView] = useState<SLView>("dashboard");
  const [selDept, setSelDept] = useState<SelDept | null>(null);
  const [plan, setPlan] = useState<SLPlan | null>(null);
  const [statusTab, setStatusTab] = useState("all");
  const [deptSel, setDeptSel] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [pausedDetailLot, setPausedDetailLot] = useState<EmergencyLot | null>(null);
  const [progressLot, setProgressLot] = useState<Lot | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; lot: Lot | null }>({ open: false, lot: null });
  const [sendModal, setSendModal] = useState(false);
  const [backModal, setBackModal] = useState(false);


  // ── Status tabs (อัปเดตชุดข้อมูลสีและ Mapping สเตตัสใหม่ตามความต้องการ) ───────────────────────────

  const STATUS_TABS = [
    { k: "all", icon: <LayoutGrid size={12} />, l: "All", col: "#0E1117", bg: "#F4F5F7", statuses: ["draft", "waiting", "in_progress", "paused_shift_end", "paused_issue", "paused_emergency", "rejected", "sl_rejected", "submitted", "head_approved", "pl_review", "completed"] },
    { k: "waiting", icon: <Clock size={12} />, l: "Waiting", col: "#633806", bg: "#FEF3C7", statuses: ["waiting"] },
    { k: "inprog", icon: <Play size={12} />, l: "In Progress", col: "#185FA5", bg: "#E6F1FB", statuses: ["in_progress"] },
    { k: "shiftend", icon: <PauseCircle size={12} />, l: "Shift End", col: "#854F0B", bg: "#FEF3C7", statuses: ["paused_shift_end"] },
    { k: "issue", icon: <AlertTriangle size={12} />, l: "Issue", col: "#791F1F", bg: "#FCEBEB", statuses: ["paused_issue"] },
    // { k: "emerg", icon: <AlertOctagon size={12} />, l: "Emergency", col: "#501313", bg: "#FCEBEB", statuses: ["paused_emergency"] },
    { k: "rejected", icon: <XCircle size={12} />, l: "Rejected", col: "#791F1F", bg: "#FCEBEB", statuses: ["rejected"] },
    { k: "submitted", icon: <CheckCircle2 size={12} />, l: "Submitted", col: "#534AB7", bg: "#EEEDFE", statuses: ["submitted"] },
    { k: "pl_review", icon: <ClipboardCheck size={12} />, l: "PL Review", col: "#534AB7", bg: "#EEEDFE", statuses: ["pl_review"] },
    { k: "finalcheck", icon: <ClipboardCheck size={12} />, l: "Final Check", col: "#854F0B", bg: "#FEF3C7", statuses: ["head_approved"] },
    { k: "success", icon: <Check size={12} />, l: "Complete", col: "#27500A", bg: "#EAF3DE", statuses: ["completed"] },
  ];

  const deptOk = (dept: string) =>
    allowedDepts.includes(dept) && (deptSel.length === 0 || deptSel.includes(dept));

  function filterLots(src: Lot[]) {
    const tab = STATUS_TABS.find(t => t.k === statusTab);
    return src.filter(l => {
      const statusOk = !tab?.statuses || tab.statuses.includes(l.status);
      return statusOk && deptOk(l.dept);
    });
  }

  const filteredLots = filterLots(lots);
  const sortedLots = [...filteredLots].sort((a, b) => {
    const dateA = new Date(a.packing_date || 0).getTime();
    const dateB = new Date(b.packing_date || 0).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });
  const activeLots = sortedLots.filter(l => l.status !== "completed");
  const finalQueue = lots.filter(l => l.status === "head_approved");
  const draftLots = [...lots]
    .filter(l => {
      if (l.status !== "draft") return false;
      if (!l.dept) return true; // include if no dept set
      return deptOk(l.dept);
    })
    .sort((a, b) =>
      new Date(String(b.created_at || 0)).getTime() -
      new Date(String(a.created_at || 0)).getTime()
    );
  console.log('[SL] draftLots:', draftLots.length,
    'total draft in lots:', lots.filter(l => l.status === 'draft').length,
    'allowedDepts:', allowedDepts,
    'deptSel:', deptSel);

  const getProductName = (lot: Lot): string => {
    const sl = lot as SLPlan;
    return sl.product_name ||
      lot.product ||
      String(sl.shifts?.morning?.product_name || "") ||
      String(sl.shifts?.afternoon?.product_name || "") ||
      String(sl.shifts?.night?.product_name || "") ||
      "(Product not set)";
  };

  const getDate = (lot: Lot): string => {
    const sl = lot as SLPlan;
    return sl.date || lot.packing_date || "";
  };

  // ── Plan helpers ───────────────────────────────────────────

  function startPlan(dk: DeptKey) {
    setSelDept({ ...DEPT[dk], id: dk });
    const initShifts = Object.fromEntries(DEFAULT_SHIFTS.map(s => [s, emptyShift(SHIFT_LABELS[s as keyof typeof SHIFT_LABELS] || s)])) as unknown as Record<string, Record<string, unknown>>;
    setPlan({ id: Date.now(), dept: dk, date: "", packing_date: "", blender: "", blender_cap: "23.5", rn_ref: "", status: "draft", shifts: initShifts, shiftOrder: DEFAULT_SHIFTS, draft_note: "", product: "", lot: "", customer: "", actual_mt: 0, target_mt: 0 });
    setView("new_plan");
  }

  async function editDraft(lot: Lot) {
    console.log('[SL editDraft] opening lot:', lot.id, lot.status);
    setSelDept({ ...DEPT[lot.dept as DeptKey], id: lot.dept as DeptKey });
    const initShifts = Object.fromEntries(DEFAULT_SHIFTS.map(s => [s, emptyShift(SHIFT_LABELS[s as keyof typeof SHIFT_LABELS] || s)])) as unknown as Record<string, Record<string, unknown>>;
    const shiftOrder = (lot as SLPlan).shiftOrder || DEFAULT_SHIFTS;
    const freshRes = await fetch(`/api/lots/${lot.id}`);
    const freshData = freshRes.ok ? await freshRes.json() : lot;
    const flat = flattenLot(freshData);
    console.log('[SL editDraft] freshData from API:', JSON.stringify(flat));
    const flatLot = {
      ...flat,
      date: cleanDate(flat.date || flat.packing_date || flat.plan_date || flat.plan?.plan_date),
      packaging_type: typeof flat.packaging_type === 'object'
        ? (flat.packaging_type as any)?.name || ''
        : flat.packaging_type || '',
      product_name: flat.product?.product_name || flat.product_name || flat.product || '',
      country_label: flat.customer?.country_label || flat.country_label || flat.customer || '',
      cut_off_date: cleanDate(flat.cut_off_date),
      operator_name: flat.operator_name || flat.ibc_operator_name || freshData.production_detail_ibc?.operator_name || '',
      quality_status: flat.quality_status || flat.ibc_quality_status || freshData.production_detail_ibc?.quality_status_lab || '',
      ibc_residue_kg: flat.ibc_residue_kg ?? '',
      ibc_empty_before_kg: flat.ibc_empty_before_kg ?? '',
      ibc_with_product_kg: flat.ibc_with_product_kg ?? '',
      ibc_product_net_kg: flat.ibc_product_net_kg ?? '',
      plan_id: flat.plan_id ?? (flat as any).plan?.id ?? null,
      special_comm: flat.special_comm ?? '',
      drum_serial_start: flat.drum_serial_start ?? flat.label_no_start ?? null,
      drum_serial_end: flat.drum_serial_end ?? flat.label_no_end ?? null,
      label_no_start: flat.label_no_start ?? flat.drum_serial_start ?? null,
      label_no_end: flat.label_no_end ?? flat.drum_serial_end ?? null,
      label_count: flat.label_count ?? null,
      label_pkg_type: flat.label_pkg_type ?? null,
      export_on_pallet: flat.export_on_pallet ?? false,
      empty_tank: flat.empty_tank ?? false,
    };
    console.log('[SL editDraft] flatLot label fields:', {
      drum_serial_start: flatLot.drum_serial_start,
      drum_serial_end: flatLot.drum_serial_end,
      label_no_start: flatLot.label_no_start,
      label_no_end: flatLot.label_no_end,
      label_count: flatLot.label_count,
      label_pkg_type: flatLot.label_pkg_type,
    });
    setPlan({ ...flatLot, shifts: (lot as SLPlan).shifts || initShifts, shiftOrder });
    setView("draft_edit");
  }

  async function saveDraft() {
    if (!plan) return;
    setSaving(true);

    console.log('[SL saveDraft] plan:', JSON.stringify({
      id: plan.id, dept: plan.dept, lot_no: plan.lot_no,
      product_id: plan.product_id, customer_id: plan.customer_id,
      packaging_type_id: plan.packaging_type_id,
      blender_id: plan.blender_id, blender: plan.blender,
      target_mt: plan.target_mt, date: plan.date,
      isExisting: !!lots.find(l => l.id === plan.id),
    }));
    console.log('[saveDraft] label fields:', {
      drum_serial_start: (plan as any).drum_serial_start,
      drum_serial_end: (plan as any).drum_serial_end,
      label_no_start: (plan as any).label_no_start,
      label_no_end: (plan as any).label_no_end,
      label_count: plan.label_count,
      label_pkg_type: (plan as any).label_pkg_type,
    });

    let resolvedBlenderId = plan.blender_id
    if (!resolvedBlenderId && plan.blender) {
      const res = await fetch('/api/blenders')
      const list = res.ok ? await res.json() : []
      resolvedBlenderId = list.find(
        (b: { code: string; id: number }) => b.code === plan.blender
      )?.id
    }
    console.log('[SL saveDraft] resolvedBlenderId:', resolvedBlenderId);

    // product_name ส่งตรงไปใน payload ให้ /api/lots route จัดการ auto-create ผ่าน Prisma
    const resolvedProductId = plan.product_id

    try {
      const isExisting = lots.find(l => l.id === plan.id);
      if (isExisting) {
        const ibcData = plan.dept === 'IBC' ? {
          operator_name: plan.operator_name ?? null,
          quality_status: plan.quality_status || null,
          ibc_residue_kg: plan.ibc_residue_kg ?? null,
          ibc_empty_before_kg: plan.ibc_empty_before_kg ?? null,
          ibc_with_product_kg: plan.ibc_with_product_kg ?? null,
          ibc_product_net_kg: plan.ibc_product_net_kg ?? null,
        } : undefined;
        const payload = {
          lot_no: plan.lot_no || plan.lot,
          product_id: resolvedProductId,
          product_name: plan.product_name || undefined,
          customer_id: plan.customer_id,
          packaging_type_id: plan.packaging_type_id,
          target_amount_mt: plan.target_mt,
          planned_pallets: plan.planned_pallets,
          country_label: plan.country_label,
          draft_note: plan.draft_note,
          special_comm: (plan as any).special_comm ?? null,
          cut_off_date: plan.cut_off_date,
          label_no_start: (plan as any).drum_serial_start ?? (plan as any).label_no_start ?? null,
          label_no_end: (plan as any).drum_serial_end ?? (plan as any).label_no_end ?? null,
          label_count: plan.label_count ?? null,
          label_pkg_type: (plan as any).label_pkg_type ?? null,
          flush_blender: plan.flush_blender ?? null,
          export_on_pallet: plan.export_on_pallet ?? null,
          empty_tank: plan.empty_tank ?? null,
          operation_date: plan.date,
          detail_status: isExisting.status || "draft",
          ...(ibcData && { ibc_data: ibcData }),
        };
        console.log('[SL saveDraft] PATCH /api/lots/' + plan.id + ' payload:', JSON.stringify(payload));
        const res = await fetch(`/api/lots/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log('[SL saveDraft] PATCH /api/lots/' + plan.id + ' status:', res.status);
        if (res.ok) {
          // Blender lives on production_plans, not production_details — PATCH separately.
          const currentPlanId = (plan as any).plan_id
          if (currentPlanId && resolvedBlenderId) {
            console.log('[SL saveDraft] PATCH /api/plans/' + currentPlanId + ' blender_id:', resolvedBlenderId)
            await fetch(`/api/plans/${currentPlanId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ blender_id: resolvedBlenderId }),
            }).catch(e => console.error('[SL saveDraft] update plan blender_id failed:', e))
          }
          const refetched = await fetch(`/api/lots/${plan.id}`).then(r => r.json());
          const flat = flattenLot(refetched);
          setLots(prev => prev.map(l => l.id === plan.id ? flat : l));
        }
      } else {
        if (!resolvedBlenderId) {
          alert('ไม่พบ Blender กรุณาตรวจสอบ')
          setSaving(false)
          return
        }
        const targetDate = plan.date || plan.packing_date ||  plan.plan_date ||"";
        // Check for existing plan with same blender + date to avoid duplicates
        const existingPlanRes = await fetch(
          `/api/plans?blender_id=${resolvedBlenderId}&plan_date=${targetDate}&form_type=${plan.dept}`
        )
        let planId: number | null = null
        if (existingPlanRes.ok) {
          const existingPlans = await existingPlanRes.json()
          if (Array.isArray(existingPlans) && existingPlans.length > 0) {
            planId = existingPlans[0].id
            console.log('[SL saveDraft] reusing existing plan:', planId)
          }
        }
        if (!planId) {
          const planRes = await fetch("/api/plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan_date: targetDate,
              blender_id: resolvedBlenderId,
              form_type: plan.dept,
            }),
          })
          console.log('[SL saveDraft] POST /api/plans status:', planRes.status)
          if (!planRes.ok) {
            const err = await planRes.json().catch(() => ({}))
            alert('สร้าง Plan ไม่สำเร็จ: ' + ((err as any).error || planRes.status))
            setSaving(false)
            return
          }
          const newPlan = await planRes.json()
          planId = newPlan.id
        }
        const ibcDataNew = plan.dept === 'IBC' ? {
          operator_name: plan.operator_name ?? null,
          quality_status: plan.quality_status ?? null,
          ibc_residue_kg: plan.ibc_residue_kg ?? null,
          ibc_empty_before_kg: plan.ibc_empty_before_kg ?? null,
          ibc_with_product_kg: plan.ibc_with_product_kg ?? null,
          ibc_product_net_kg: plan.ibc_product_net_kg ?? null,
        } : undefined;
        const lotPayload = {
          plan_id: planId,
          dept: plan.dept,
          lot_no: plan.lot_no || plan.lot || "",
          ...(resolvedProductId && { product_id: resolvedProductId }),
          product_name: plan.product_name || undefined,
          ...(plan.customer_id && { customer_id: plan.customer_id }),
          ...(plan.packaging_type_id && { packaging_type_id: plan.packaging_type_id }),
          target_amount_mt: plan.target_mt,
          planned_pallets: plan.planned_pallets,
          country_label: plan.country_label,
          draft_note: plan.draft_note,
          special_comm: (plan as any).special_comm ?? null,
          cut_off_date: plan.cut_off_date,
          label_no_start: (plan as any).drum_serial_start ?? (plan as any).label_no_start ?? null,
          label_no_end: (plan as any).drum_serial_end ?? (plan as any).label_no_end ?? null,
          label_count: plan.label_count ?? null,
          label_pkg_type: (plan as any).label_pkg_type ?? null,
          flush_blender: plan.flush_blender ?? null,
          export_on_pallet: plan.export_on_pallet ?? null,
          empty_tank: plan.empty_tank ?? null,
          operation_date: targetDate,
          packing_date: targetDate,
          detail_status: "draft",
          ...(ibcDataNew && { ibc_data: ibcDataNew }),
        };
        console.log('[SL saveDraft] POST /api/lots payload:', JSON.stringify(lotPayload));
        const lotRes = await fetch("/api/lots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lotPayload),
        });
        console.log('[SL saveDraft] POST /api/lots status:', lotRes.status);
        if (lotRes.ok) {
          const newLot = await lotRes.json();
          const refetched = await fetch(`/api/lots/${newLot.id}`).then(r => r.json());
          const flat = flattenLot(refetched);
          const fineFlat = {
            ...flat,
            date: flat.date || flat.packing_date || targetDate,
            packing_date: flat.packing_date || flat.date || targetDate
          };
          setLots(prev => [...prev, fineFlat]);
        }
      }
    } finally {
      setSaving(false);
    }
    setView("dashboard");
  }

  // async function sendToPacker() {
  //   if (!plan) return;
  //   console.log('[SL sendToPacker] lot id:', plan.id, 'status → waiting');
  //   const res = await fetch(`/api/lots/${plan.id}/status`, {
  //     method: "PATCH",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ status: "waiting" }),
  //   });
  //   console.log('[SL sendToPacker] response status:', res.status);
  //   if (res.ok) {
  //     setLots(prev => prev.map(l => l.id === plan.id ? { ...l, status: "waiting" } : l));
  //   }
  //   setView("dashboard");
  // }
  async function sendToPacker() {
    if (!plan) return;
    setSaving(true);

    try {
      let currentLotId = plan.id;
      const targetDate = plan.date || plan.packing_date || plan.plan_date || "";
      // เช็คว่า ID เป็นของจำลองจาก Date.now() หรือไม่ (ถ้าเป็นตัวเลขยาว ๆ 13 หลัก แสดงว่าเป็นอันใหม่ที่ยังไม่เซฟลง DB)
      let isNewLot = typeof plan.id === 'number' && String(plan.id).length >= 12;
      let resolvedBlenderId = plan.blender_id;

      // product_name ส่งตรงไปใน payload ให้ /api/lots route จัดการ auto-create
      const resolvedProductId = plan.product_id

      // ── 1. ถ้าเป็นแผนงานสร้างใหม่ (ยังไม่มี Real ID ในฐานข้อมูล) ──────────────────
      if (isNewLot) {
        if (!resolvedBlenderId && plan.blender) {
          const res = await fetch('/api/blenders');
          const list = res.ok ? await res.json() : [];
          resolvedBlenderId = list.find((b: { code: string; id: number }) => b.code === plan.blender)?.id;
        }

        if (!resolvedBlenderId) {
          alert('ไม่พบ Blender ในระบบ — กรุณาเลือก Blender ใหม่อีกครั้ง');
          setSaving(false);
          return;
        }

        // ตรวจสอบหรือสร้าง Plan หลักของวันนั้น ๆ ก่อน
        const existingPlanRes = await fetch(`/api/plans?blender_id=${resolvedBlenderId}&plan_date=${plan.date}&form_type=${plan.dept}`);
        let planId: number | null = null;
        if (existingPlanRes.ok) {
          const existingPlans = await existingPlanRes.json();
          if (Array.isArray(existingPlans) && existingPlans.length > 0) {
            planId = existingPlans[0].id;
          }
        }

        if (!planId) {
          const planRes = await fetch("/api/plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan_date: plan.date,
              blender_id: resolvedBlenderId,
              form_type: plan.dept,
            }),
          });
          if (!planRes.ok) {
            alert('สร้าง Plan หลักไม่สำเร็จ ไม่สามารถส่งหา Packer ได้');
            setSaving(false);
            return;
          }
          const newPlan = await planRes.json();
          planId = newPlan.id;
        }

        // เตรียมข้อมูลส่งเซฟ (POST) เพื่อเอา Real ID
        const ibcDataNew = plan.dept === 'IBC' ? {
          operator_name: plan.operator_name ?? null,
          quality_status: plan.quality_status ?? null,
          ibc_residue_kg: plan.ibc_residue_kg ?? null,
          ibc_empty_before_kg: plan.ibc_empty_before_kg ?? null,
          ibc_with_product_kg: plan.ibc_with_product_kg ?? null,
          ibc_product_net_kg: plan.ibc_product_net_kg ?? null,
        } : undefined;

        const lotPayload = {
          plan_id: planId,
          dept: plan.dept,
          lot_no: plan.lot_no || plan.lot || "",
          ...(resolvedProductId && { product_id: resolvedProductId }),
          product_name: plan.product_name || undefined,
          ...(plan.customer_id && { customer_id: plan.customer_id }),
          ...(plan.packaging_type_id && { packaging_type_id: plan.packaging_type_id }),
          target_amount_mt: plan.target_mt,
          planned_pallets: plan.planned_pallets,
          country_label: plan.country_label,
          draft_note: plan.draft_note,
          special_comm: (plan as any).special_comm ?? null,
          cut_off_date: plan.cut_off_date,
          label_no_start: (plan as any).drum_serial_start ?? (plan as any).label_no_start ?? null,
          label_no_end: (plan as any).drum_serial_end ?? (plan as any).label_no_end ?? null,
          label_count: plan.label_count ?? null,
          label_pkg_type: (plan as any).label_pkg_type ?? null,
          flush_blender: plan.flush_blender ?? null,
          export_on_pallet: plan.export_on_pallet ?? null,
          empty_tank: plan.empty_tank ?? null,
          operation_date: targetDate,
          packing_date: targetDate,// ดักส่งไปทั้งสองชื่อเพื่อความปลอดภัย
          detail_status: "draft",
          ...(ibcDataNew && { ibc_data: ibcDataNew }),
        };

        const lotRes = await fetch("/api/lots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(lotPayload),
        });

        if (!lotRes.ok) {
          alert('บันทึกข้อมูลดราฟต์ลงระบบก่อนส่งไม่สำเร็จ');
          setSaving(false);
          return;
        }

        const savedLot = await lotRes.json();
        currentLotId = savedLot.id; // ยึด ID จริงที่ได้จากหลังบ้านมาใช้ทำงานต่อ
      }
      // ── 2. ถ้าเป็นดราฟต์เดิมที่มี Real ID อยู่แล้ว (อัปเดตข้อมูลหน้าฟอร์มล่าสุดก่อนส่ง) ──
      else {
        const ibcData = plan.dept === 'IBC' ? {
          operator_name: plan.operator_name ?? null,
          quality_status_lab: plan.quality_status ?? null,
          ibc_residue_kg: plan.ibc_residue_kg ?? null,
          ibc_empty_before_kg: plan.ibc_empty_before_kg ?? null,
          ibc_with_product_kg: plan.ibc_with_product_kg ?? null,
          ibc_product_net_kg: plan.ibc_product_net_kg ?? null,
        } : undefined;

        await fetch(`/api/lots/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lot_no: plan.lot_no || plan.lot,
            product_id: resolvedProductId,
            customer_id: plan.customer_id,
            packaging_type_id: plan.packaging_type_id,
            target_amount_mt: plan.target_mt,
            planned_pallets: plan.planned_pallets,
            country_label: plan.country_label,
            draft_note: plan.draft_note,
            special_comm: (plan as any).special_comm ?? null,
            cut_off_date: plan.cut_off_date,
            operation_date: plan.date,
            packing_date: plan.date,
            ...(ibcData && { ibc_data: ibcData }),
          }),
        });
      }

      // ── 3. เปลี่ยนสถานะเป็น waiting โดยใช้ Real ID แน่นอน ──────────────────
      console.log(`[SL sendToPacker] Real PATCH -> /api/lots/${currentLotId}/status`);
      const res = await fetch(`/api/lots/${currentLotId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "waiting" }),
      });

      if (res.ok) {
        // ดึงข้อมูลก้อนสมบูรณ์จากหลังบ้านมารีเฟรช State บน UI หน้าแรกทันที
        const refetched = await fetch(`/api/lots/${currentLotId}`).then(r => r.json());
        const flat = flattenLot(refetched);

        if (isNewLot) {
          setLots(prev => [...prev, flat]);
        } else {
          setLots(prev => prev.map(l => l.id === plan.id ? flat : l));
        }
        setView("dashboard");
        setPlan(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert('เปลี่ยนสถานะเป็น Waiting ไม่สำเร็จ: ' + (err.error || res.status));
      }

    } catch (error) {
      console.error('[sendToPacker Error]', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อระบบฐานข้อมูล');
    } finally {
      setSaving(false);
    }
  }

  function setShift(sk: string, f: string, v: unknown) {
    setPlan(p => p ? ({ ...p, shifts: { ...p.shifts, [sk]: { ...p.shifts?.[sk], [f]: v } } }) : p);
  }

  const canSaveDraft = !!((plan?.blender || plan?.blender_id) && plan?.date);
  const missingSend: string[] = [];
  if (!plan?.product_name && !plan?.product_id) missingSend.push("Product");
  if (!plan?.lot_no && !plan?.lot) missingSend.push("Lot No");
  if (!plan?.country_label) missingSend.push("Country Label");
  if (!plan?.packaging_type_id && !plan?.packaging_type) missingSend.push("Packaging");
  if (!plan?.date) missingSend.push("Plan Date");
  if (!plan?.cut_off_date) missingSend.push("Cut off Date");
  if (!plan?.blender_id && !plan?.blender) missingSend.push("Blender");
  if (!plan?.planned_pallets) missingSend.push("Planned Pallets");
  if (plan?.dept === 'IBC') {
    if (!plan?.operator_name) missingSend.push("Operator Name (IBC)");
    if (!plan?.quality_status) missingSend.push("Quality Status (IBC)");
    if (!plan?.ibc_residue_kg) missingSend.push("น้ำหนัก ที่ เศษ ใน IBC ที่ (IBC)");
    if (!plan?.ibc_empty_before_kg) missingSend.push("น้ำหนัก IBC เปล่าก่อนผลิต (IBC)");
    if (!plan?.ibc_with_product_kg) missingSend.push("น้ำหนัก IBC เปล่า + Product (IBC)");
    if (!plan?.ibc_product_net_kg) missingSend.push("น้ำหนัก Product (IBC)");
  }

  const canSend = plan && missingSend.length === 0;

  // ══════════════════════════════════════════════════════════
  // VIEW: final_check
  // ══════════════════════════════════════════════════════════

  if (view === "packer_progress" && progressLot) {
    return (
      <PKFormViewer
        lot={progressLot as any}
        onBack={() => { setView("dashboard"); setProgressLot(null); }}
        currentUser=""
        setLots={setLots}
        readOnly={true}
      />
    );
  }

  if (view === "packer_progress_final" && progressLot) {
    const slProgress = progressLot as SLPlan
    return (
      <div>
        <PKFormViewer
          lot={progressLot as any}
          onBack={() => { setView("dashboard"); setProgressLot(null); }}
          currentUser=""
          setLots={setLots}
          readOnly={true}
          approveLabel="Approve — complete"
          onEditPlan={() => {
            const flat = flattenLot(progressLot)
            setSelDept({ ...DEPT[progressLot.dept as DeptKey], id: progressLot.dept as DeptKey })
            setPlan({ ...flat, _finalEdit: true } as SLPlan)
            setView("draft_edit")
          }}
          onApprove={async () => {
            const res = await fetch(`/api/lots/${progressLot.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'completed' }),
            })
            if (res.ok) {
              const planId = (progressLot as any).plan_id
              if (planId) {
                await fetch(`/api/plans/${planId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ plan_status: 'completed' }),
                }).catch(() => { })
              }
              setLots(p => p.map(l => l.id === progressLot.id ? { ...l, status: 'completed' } : l))
              setView("dashboard")
              setProgressLot(null)
            } else {
              const err = await res.json().catch(() => ({}))
              alert('Approve ไม่สำเร็จ: ' + ((err as any).error || res.status))
            }
          }}
          onReject={async (remark) => {
            const res = await fetch(`/api/lots/${progressLot.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'sl_rejected', reject_remark: remark }),
            })
            if (res.ok) {
              setLots(p => p.map(l => l.id === progressLot.id ? { ...l, status: 'sl_rejected', reject_remark: remark } : l))
              setView("dashboard")
              setProgressLot(null)
            } else {
              const err = await res.json().catch(() => ({}))
              alert('Reject ไม่สำเร็จ: ' + ((err as any).error || res.status))
            }
          }}
        />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: new_plan / draft_edit
  // ══════════════════════════════════════════════════════════

  if ((view === "new_plan" || view === "draft_edit") && plan && selDept) {
    const dc = selDept.accent;
    return (
      <div>
        <button
          onClick={() => {
            const hasData = !!(
              plan?.lot_no || plan?.lot ||
              plan?.product_name || plan?.product_id ||
              plan?.country_label || plan?.packaging_type ||
              plan?.target_mt || plan?.cut_off_date
            )
            if (hasData && (!plan?.status || plan?.status === 'draft')) {
              setBackModal(true)
            } else {
              setView("dashboard")
              setPlan(null)
            }
          }}
          className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          Home
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div>
            <div className="text-base font-medium" style={{ color: dc }}>{selDept.label}</div>
            <div className="text-xs text-[#9BA3BA]">
              {view === "draft_edit"
                ? "Editing draft"
                : selDept.src === "upload" ? "fill manually below" : "Fill manually — 3 shifts"}
            </div>
          </div>
        </div>

        <LotForm
          plan={plan as LotPlan}
          setPlan={setPlan as React.Dispatch<React.SetStateAction<LotPlan | null>>}
        />

        {/* Sticky action bar */}
        <div className="sticky bottom-0 bg-[#F5F5F5] pt-2.5 pb-2.5 border-t-[0.5px] border-[#DDE2EE]">
          {plan._finalEdit ? (
            <div className="grid grid-cols-2 gap-2.5">
              <Btn
                label={<span className="flex items-center justify-center gap-1.5">
                  Back
                </span>}
                color="#9BA3BA"
                outline
                onClick={() => { setView("packer_progress_final"); setPlan(null); }}
              />
              <Btn
                label={<span className="flex items-center justify-center gap-1.5">
                  <CheckCircle size={14} />Save changes
                </span>}
                color="#27500A"
                full
                onClick={async () => {
                  if (!plan) return
                  console.log('[SL finalEdit save] lot id:', plan.id)
                  try {
                    const payload = {
                      lot_no: plan.lot_no || plan.lot,
                      product_id: plan.product_id,
                      customer_id: plan.customer_id,
                      packaging_type_id: plan.packaging_type_id,
                      target_amount_mt: plan.target_mt,
                      planned_pallets: plan.planned_pallets,
                      country_label: plan.country_label,
                      draft_note: plan.draft_note,
                      cut_off_date: plan.cut_off_date,
                      label_no_start: (plan as any).drum_serial_start,
                      label_no_end: (plan as any).drum_serial_end,
                      label_count: plan.label_count,
                      label_pkg_type: (plan as any).label_pkg_type,
                      flush_blender: (plan as any).flush_blender,
                      export_on_pallet: plan.export_on_pallet ?? null,
                      empty_tank: plan.empty_tank ?? null,
                      operation_date: plan.date,
                    }
                    const res = await fetch(`/api/lots/${plan.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    })
                    console.log('[SL finalEdit save] PATCH status:', res.status)
                    if (res.ok) {
                      const refetched = await fetch(`/api/lots/${plan.id}`)
                        .then(r => r.json())
                      const flat = flattenLot(refetched)
                      setLots(p => p.map(l => l.id === plan.id ? flat : l))
                      setProgressLot(flat as Lot)
                      setView("packer_progress_final")
                      setPlan(null)
                    } else {
                      const err = await res.json().catch(() => ({}))
                      alert('Save ไม่สำเร็จ: ' + ((err as any).error || res.status))
                    }
                  } catch (err) {
                    console.error('[SL finalEdit save] exception:', err)
                    alert('Save ไม่สำเร็จ')
                  }
                }}
              />
            </div>
          ) : plan.status === "waiting" ? (
            <div className="grid grid-cols-[1fr_2fr] gap-2.5">
              <Btn
                label="Delete"
                danger
                onClick={() => setDeleteModal({ open: true, lot: plan as unknown as Lot })}
              />
              <Btn
                label={saving ? "Saving..." : "Save Changes"}
                color={dc}
                full
                disabled={saving}
                onClick={saveDraft}
              />
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_1fr_2fr] gap-2.5">
              {(!plan.status || plan.status === "draft") ? (
                <Btn
                  label={saving ? "Saving..." : "Save draft"}
                  color="#9BA3BA"
                  outline
                  disabled={saving || !canSaveDraft}
                  onClick={saveDraft}
                />
              ) : (
                <Btn
                  label="Back"
                  color="#9BA3BA"
                  outline
                  onClick={() => { setView("dashboard"); setPlan(null); }}
                />
              )}
              <Btn
                label="Delete"
                danger
                onClick={() => setDeleteModal({ open: true, lot: plan as unknown as Lot })}
              />
              <Btn
                label="Send to Packer"
                color={dc}
                disabled={!canSend}
                full
                onClick={() => setSendModal(true)}
              />
            </div>
          )}
        </div>
        {!plan._finalEdit && plan.status !== "waiting" && !canSend && missingSend.length > 0 && (
          <div className="text-center text-xs text-[#791F1F] mt-1.5">
            Fill {missingSend.join(", ")} before sending
          </div>
        )}

        <ConfirmModal
          open={deleteModal.open}
          title="Are you sure?"
          message={`Do you really want to delete "${(deleteModal.lot as SLPlan)?.lot_no || deleteModal.lot?.lot || deleteModal.lot?.id}"? This process cannot be undone.`}
          confirmLabel="Delete"
          confirmColor="#E24B4A"
          icon={<Trash2 size={44} />}
          onCancel={() => setDeleteModal({ open: false, lot: null })}
          onConfirm={async () => {
            const lot = deleteModal.lot;
            setDeleteModal({ open: false, lot: null });
            if (!lot) return;
            try {
              const res = await fetch(`/api/lots/${lot.id}`, { method: 'DELETE' });
              console.log('[SL deleteDraft] status:', res.status);
              if (res.ok) {
                setLots(p => p.filter(l => l.id !== lot.id));
                setView("dashboard"); setPlan(null);
              } else {
                const err = await res.json().catch(() => ({}));
                alert('ลบไม่สำเร็จ: ' + ((err as { error?: string }).error || res.status));
              }
            } catch (err) {
              console.error('[SL deleteDraft] exception:', err);
              alert('ลบไม่สำเร็จ');
            }
          }}
        />
        <ConfirmModal
          open={sendModal}
          title="Send to Packer?"
          message={`Do you want to send Lot "${(plan as SLPlan)?.lot_no || plan?.lot || ''}" to Packer? This action cannot be undone.`}
          confirmLabel="Send to Packer"
          confirmColor="#185FA5"
          icon={<Play size={44} />}
          onConfirm={() => { setSendModal(false); sendToPacker(); }}
          onCancel={() => setSendModal(false)}
        />
        <ConfirmModal
          open={backModal}
          title="Save draft before leaving?"
          message="You have unsaved data — save draft before going back to dashboard?"
          confirmLabel="Save Draft"
          cancelLabel="Leave without saving"
          confirmColor="#185FA5"
          icon={<FileText size={44} />}
          onDismiss={() => setBackModal(false)}
          onCancel={() => { setBackModal(false); setView("dashboard"); setPlan(null); }}
          onConfirm={async () => { setBackModal(false); await saveDraft(); }}
        />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // VIEW: dashboard
  // ══════════════════════════════════════════════════════════

  const stats = [
    { l: "Draft", v: lots.filter(l => l.status === "draft" && deptOk(l.dept)).length, color: "#6B7280", bg: "#F9FAFB" },
    { l: "Waiting", v: lots.filter(l => l.status === "waiting").length, color: "#F59E0B", bg: "#FFFBEB" },
    { l: "In Progress", v: lots.filter(l => l.status === "in_progress").length, color: "#0284C7", bg: "#F0F9FF" },
    { l: "Final Check", v: lots.filter(l => l.status === "head_approved").length, color: "#7C3AED", bg: "#F5F3FF" },
    { l: "Completed", v: lots.filter(l => l.status === "completed").length, color: "#16A34A", bg: "#F0FDF4" },
  ];

  const issueLots = lots.filter(l => l.status === "paused_issue");
  const emergencyLots = lots.filter(l => l.status === "paused_emergency");

  return (
    <div className="pb-[72px]">
      <ConfirmModal
        open={deleteModal.open}
        title="Are you sure?"
        message={`Do you really want to delete "${(deleteModal.lot as SLPlan)?.lot_no || deleteModal.lot?.lot || deleteModal.lot?.id}"? This process cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="#E24B4A"
        icon={<Trash2 size={44} />}
        onCancel={() => setDeleteModal({ open: false, lot: null })}
        onConfirm={async () => {
          const lot = deleteModal.lot;
          setDeleteModal({ open: false, lot: null });
          if (!lot) return;
          try {
            const res = await fetch(`/api/lots/${lot.id}`, { method: 'DELETE' });
            console.log('[SL deleteDraft] status:', res.status);
            if (res.ok) {
              setLots(p => p.filter(l => l.id !== lot.id));
              setView("dashboard");
              setPlan(null);
            } else {
              const err = await res.json().catch(() => ({}));
              alert('ลบไม่สำเร็จ: ' + ((err as { error?: string }).error || res.status));
            }
          } catch (err) {
            console.error('[SL deleteDraft] exception:', err);
            alert('ลบไม่สำเร็จ');
          }
        }}
      />

      {pausedDetailLot && (
        <div onClick={() => setPausedDetailLot(null)}
          className="fixed inset-0 bg-black/45 z-[100] flex items-start justify-center px-4 py-[60px] overflow-y-auto">
          <div onClick={e => e.stopPropagation()}
            className="bg-white rounded-[14px] p-5 w-full max-w-[480px] shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
            <div className="flex justify-between items-center mb-3.5">
              <div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-[20px] mr-1.5"
                  style={{ background: pausedDetailLot.status === "paused_emergency" ? "#FCEBEB" : "#FEF3C7", color: pausedDetailLot.status === "paused_emergency" ? "#501313" : "#633806" }}>
                  {pausedDetailLot.status === "paused_emergency" ? "Emergency" : "Issue"}
                </span>
                <span className="text-[11px] font-medium px-[9px] py-0.5 rounded-md"
                  style={{ background: DEPT[pausedDetailLot.dept as DeptKey]?.badge.bg, color: DEPT[pausedDetailLot.dept as DeptKey]?.badge.color }}>
                  {pausedDetailLot.dept}
                </span>
              </div>
              <button onClick={() => setPausedDetailLot(null)} className="bg-transparent border-none text-lg cursor-pointer text-[#9BA3BA] leading-none">x</button>
            </div>
            <div className="text-base font-medium mb-1">{pausedDetailLot.product}</div>
            <div className="text-xs text-[#9BA3BA] mb-3.5   ">{pausedDetailLot.lot} . {pausedDetailLot.blender}</div>
            {!!(pausedDetailLot as SLPlan).pauseReason && (
              <div className="rounded-xl px-3.5 py-3 mb-3.5 border"
                style={{ background: pausedDetailLot.status === "paused_emergency" ? "#FCEBEB" : "#FEF3C7", borderColor: pausedDetailLot.status === "paused_emergency" ? "#E24B4A" : "#EF9F27" }}>
                <div className="text-[11px] font-bold uppercase tracking-[0.06em] mb-1"
                  style={{ color: pausedDetailLot.status === "paused_emergency" ? "#791F1F" : "#633806" }}>Reason / Log</div>
                <div className="text-[13px] leading-relaxed"
                  style={{ color: pausedDetailLot.status === "paused_emergency" ? "#501313" : "#854F0B" }}>{String((pausedDetailLot as SLPlan).pauseReason)}</div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 mb-3.5">
              {[
                ["Product", pausedDetailLot.product],
                ["LOT", pausedDetailLot.lot],
                ["Packing date", formatDate(pausedDetailLot.packing_date || "")],
                ["Target", pausedDetailLot.target_mt + " MT"],
                ["Pallets done", `${(pausedDetailLot as SLPlan).done_pallets || 0}/${(pausedDetailLot as SLPlan).planned_pallets}`],
              ].map(([l, v]) => (
                <div key={l as string} className="bg-[#F4F5F7] rounded-lg px-2.5 py-2">
                  <div className="text-[10px] text-[#9BA3BA] mb-0.5">{l}</div>
                  <div className="text-xs font-medium   ">{String(v)}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setPausedDetailLot(null)}
              className="w-full py-2.5 rounded-lg bg-[#0F2347] text-white font-semibold text-[13px] cursor-pointer border-none">Close</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-lg font-medium text-[#0F2347]">Site Logistics</div>
          <div className="text-xs text-[#9BA3BA] mt-0.5">Plan management &amp; final check</div>
        </div>
        <Btn label="+ New plan" color="#185FA5" sm onClick={() => setView("dept_select")} />
      </div>


      {/* Stats */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-xl p-4 border-t-4 text-center"
            style={{ borderTopColor: s.color }}
          >
            <div className="text-2xl font-black   " style={{ color: s.color }}>{s.v}</div>
            <div className="text-xs text-gray-400 mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white border-[0.5px] border-[#DDE2EE] rounded-xl px-3 py-2.5 mb-3.5">
        {/* Status tabs — ⚡ แก้ไขดึงสี col และ bg จากชุดอาร์เรย์ STATUS_TABS ชุดใหม่ตรงๆ ⚡ */}
        <div className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b-[0.5px] border-[#DDE2EE]">
          {STATUS_TABS.map(t => {
            const cnt = t.statuses ? lots.filter(l => t.statuses!.includes(l.status) && (deptOk(l.dept))).length : lots.filter(l => deptOk(l.dept)).length;
            const active = statusTab === t.k;

            // ดึงสีตามรายคีย์ของตัวแปร Object ใน STATUS_TABS ด้านบนตรงๆ เลยครับ
            const col = t.col;
            const bg = t.bg;

            return (
              <button key={t.k} onClick={() => setStatusTab(t.k)}
                className="flex-shrink-0 flex items-center gap-[5px] px-3 py-1.5 rounded-[20px] text-xs cursor-pointer transition-all"
                style={{ fontWeight: active ? 600 : 400, background: active ? bg : "transparent", color: active ? col : "#9BA3BA", border: `0.5px solid ${active ? col : "transparent"}` }}>
                <span className="text-[13px]">{t.icon}</span>
                {t.l}
                <span className="text-[10px] font-bold px-1.5 py-px rounded-[10px] min-w-[16px] text-center"
                  style={{ background: active ? col : "#DDE2EE", color: active ? "#fff" : "#9BA3BA" }}>{cnt}</span>
              </button>
            );
          })}
        </div>

        {/* Dept chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-[#9BA3BA] mr-0.5">Dept:</span>
          {(allowedDepts as DeptKey[]).map(d => {
            const on = deptSel.includes(d);
            const dc2 = DEPT[d]?.accent || "#185FA5";
            return (
              <button key={d} onClick={() => setDeptSel(p => on ? p.filter(x => x !== d) : [...p, d])}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer border-[0.5px]"
                style={{ borderColor: on ? dc2 : "#DDE2EE", background: on ? DEPT[d].badge.bg : "#F4F5F7", color: on ? dc2 : "#9BA3BA" }}>
                {on && <span className="text-[10px] font-bold" style={{ color: dc2 }}>✓</span>}
                {DEPT[d]?.icon} {d}
              </button>
            );
          })}
          {deptSel.length > 0 && (
            <button onClick={() => setDeptSel([])} className="text-[11px] text-[#9BA3BA] bg-transparent border-none cursor-pointer px-1.5 py-1">Clear ×</button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSortOrder(p => p === 'newest' ? 'oldest' : 'newest')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border-[0.5px] border-[#DDE2EE] bg-white cursor-pointer"
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

      {/* SUCCESS tab */}
      {statusTab === "success" && (
        <SuccessTab
          lots={lots}
          isAdmin={false}
          onViewProgress={lot => { setProgressLot(lot as any); setView("packer_progress"); }}
        />
      )}

      {/* DRAFT tab */}
      {statusTab === "draft" && (
        draftLots.length === 0
          ? <div className="text-center py-12 text-[#9BA3BA]"><div className="text-4xl mb-2.5">D</div>No draft plans</div>
          : <div>
            <div className="bg-[#FEF3C7] border-[0.5px] border-[#EF9F27] rounded-xl px-3.5 py-2.5 mb-3.5 text-xs text-[#633806]">
              Draft plans are not sent to Packer yet. Fill all shifts and tap Send to Packer.
            </div>
            {draftLots.map((lot, i) => {
              console.log('draft lot:', getDate(lot), getProductName(lot));

              return (
                <div key={i} className="bg-white border-[0.5px] border-dashed border-[#DDE2EE] border-l-[3px] border-l-[#B4B2A9] rounded-r-xl px-3.5 py-[13px] mb-2.5">
                  <div className="flex justify-between items-start mb-2.5">
                    <div>
                      <div className="flex gap-[5px] mb-1 flex-wrap">
                        <DeptBadge dept={lot.dept} /><Badge s="draft" />
                        {getDate(lot) && (
                          <span className="text-[11px] text-[#9BA3BA]">
                            Date: {formatDate(getDate(lot))}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-[#0E1117]">{getProductName(lot)}</div>
                      <div className="text-[11px] text-[#9BA3BA] mt-0.5">
                        <span className="font-bold">#{(lot as any).display_no ?? '-'}</span>
                        {' '}Lot No: {(lot as SLPlan).lot_no || lot.lot || '—'}
                      </div>
                      {(lot as SLPlan).draft_note
                        ? <div className="text-[11px] text-[#9BA3BA] mt-1">{String((lot as SLPlan).draft_note)}</div>
                        : null}
                    </div>
                    <div className="flex gap-[5px]">
                      <Btn label="Edit" color="#534AB7" sm onClick={() => editDraft(lot)} />
                      <Btn label="Del" danger sm onClick={() => setDeleteModal({ open: true, lot })} />
                    </div>
                  </div>
                  {((lot as any).plan_created_by || (lot as any).plan_updated_by || (lot as any).special_comm) && (
                    <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-[#F4F5F7]">
                      {(lot as any).plan_created_by && (
                        <div className="flex items-center gap-1">
                          <UserCircle size={11} className="text-[#9BA3BA]" />
                          <span className="text-[10px] text-[#9BA3BA]">
                            Created by: <span className="font-medium text-[#5A617A]">{(lot as any).plan_created_by}</span>
                          </span>
                        </div>
                      )}
                      {(lot as any).plan_updated_by && (
                        <div className="flex items-center gap-1">
                          <PencilLine size={11} className="text-[#9BA3BA]" />
                          <span className="text-[10px] text-[#9BA3BA]">
                            Last updated: <span className="font-medium text-[#5A617A]">{(lot as any).plan_updated_by}</span>
                          </span>
                        </div>
                      )}
                      {(lot as any).special_comm && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[#534AB7]">Note: {String((lot as any).special_comm)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      )}

      {/* FINAL CHECK tab */}
      {statusTab === "finalcheck" && (
        finalQueue.filter(l => deptOk(l.dept)).length === 0
          ? <div className="text-center py-12 text-[#9BA3BA]"><Search size={40} className="text-gray-300 mx-auto mb-3" />No lots pending final check</div>
          : <div>
            <div className="bg-[#FEF3C7] border-[0.5px] border-[#EF9F27] rounded-xl px-3.5 py-2.5 mb-3.5 text-xs text-[#633806]">
              Pack Lead has approved these lots. Your final sign-off will mark them complete.
            </div>
            {finalQueue.filter(l => deptOk(l.dept)).map((lot, i) => (
              <Card key={i} accentLeft="#854F0B" className="mb-2.5 border border-[#EF9F27]">
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[28px]">{DEPT[lot.dept as DeptKey]?.icon}</span>
                    <div>
                      <div className="flex gap-[5px] mb-1"><DeptBadge dept={lot.dept} /><Badge s={lot.status} /></div>
                      <div className="text-[15px] font-medium text-[#0E1117]">{lot.product}</div>
                      <div className="text-[11px] text-[#9BA3BA]   "><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot} · {lot.blender}</div>
                      <div className="text-xs font-medium text-[#854F0B] mt-[3px]">Date: {formatDate(lot.packing_date)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-[#1D9E75]   ">{lot.blender || "-"}</div>
                    <div className="text-[13px] text-[#9BA3BA] mt-0.5">{lot.target_mt} MT</div>
                  </div>
                </div>
                <Btn
                  label={<span className="flex items-center justify-center gap-1.5"><ClipboardCheck size={14} />Start final check</span>}
                  color="#854F0B"
                  full
                  onClick={() => { setProgressLot(lot); setView("packer_progress_final"); }}
                />
              </Card>
            ))}
          </div>
      )}

      {/* REJECTED tab */}
      {statusTab === "rejected" && (
        filteredLots.filter(l => l.status === "rejected").length === 0
          ? <div className="text-center py-12 text-[#9BA3BA]"><Check size={40} className="text-gray-300 mx-auto mb-3" />No rejected lots</div>
          : <div>
            <div className="bg-[#FCEBEB] border-[1.5px] border-[#E24B4A] rounded-xl px-3.5 py-2.5 mb-3.5 flex items-center gap-2">
              <XCircle size={16} className="text-[#E24B4A] flex-shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-[#501313]">Action required — {filteredLots.filter(l => l.status === "rejected").length} lot{filteredLots.filter(l => l.status === "rejected").length > 1 ? "s" : ""} rejected</div>
                <div className="text-[11px] text-[#791F1F] mt-0.5">These lots need to be fixed and resubmitted by the Packer.</div>
              </div>
            </div>
            {filteredLots.filter(l => l.status === "rejected").map((lot, i) => (
              <div key={i} className="bg-white rounded-r-xl border-[1.5px] border-[#E24B4A] border-l-4 border-l-[#E24B4A] mb-3 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => { setProgressLot(lot); setView("packer_progress"); }}>
                <div className="bg-[#E24B4A] px-3.5 py-[7px] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle size={14} className="text-white" />
                    <span className="text-xs font-semibold text-white">Rejected — fix required</span>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <DeptBadge dept={lot.dept} />
                    <span className="text-[11px] text-white/80">Date: {formatDate(lot.packing_date)}</span>
                  </div>
                </div>
                <div className="px-3.5 py-[13px]">
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="flex gap-2.5 items-start">
                      <span className="text-[26px] leading-none">{DEPT[lot.dept as DeptKey]?.icon}</span>
                      <div>
                        <div className="text-[15px] font-medium text-[#0E1117]">{lot.product}</div>
                        <div className="text-[11px] text-[#9BA3BA]   "><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot} · {lot.blender}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[#1D9E75]   ">{lot.blender || "-"}</div>
                      <div className="text-[13px] text-[#9BA3BA] mt-0.5">{lot.target_mt} MT</div>
                    </div>
                  </div>
                  {lot.reject_remark && (
                    <div className="bg-[#FCEBEB] border-[0.5px] border-[#E24B4A] rounded-[9px] px-3 py-2.5 mb-3">
                      <div className="text-[10px] font-bold text-[#791F1F] uppercase tracking-[0.06em] mb-[5px]">Pack Lead remark</div>
                      <div className="text-[13px] text-[#501313] leading-relaxed">{lot.reject_remark}</div>
                    </div>
                  )}
                  <div className="bg-[#F4F5F7] rounded-lg px-3 py-2 mb-3 text-xs text-[#5A617A]">
                    Packer must fix and resubmit this lot. You can view the details below.
                  </div>
                  <div className="text-[11px] text-[#9BA3BA] flex items-center gap-1 justify-end mt-2">
                    <Eye size={11} />
                    <span>Tap to view details.</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
      )}

      {/* PL REVIEW tab */}
      {statusTab === "pl_review" && (
        <div>
          <div className="bg-[#EEEDFE] border border-[#534AB7] rounded-xl px-3.5 py-2.5 mb-3.5 flex items-center gap-2">
            <ClipboardCheck size={16} className="text-[#534AB7]" />
            <div>
              <div className="text-[13px] font-semibold text-[#534AB7]">Pack Lead is reviewing</div>
              <div className="text-[11px] text-[#534AB7] mt-0.5">These lots are waiting for approval from the Pack Lead</div>
            </div>
          </div>
          {filteredLots.filter(l => l.status === "pl_review").length === 0
            ? <div className="text-center py-8 text-[#9BA3BA]">No lots awaiting PL verification.</div>
            : filteredLots.filter(l => l.status === "pl_review").map((lot, i) => (
              <Card key={i} accentLeft="#534AB7" className="mb-2.5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex gap-1.5 mb-1 flex-wrap">
                      <DeptBadge dept={lot.dept} />
                      <Badge s={lot.status} />
                      {getDate(lot) && (
                        <span className="text-[11px] text-[#9BA3BA]">Date: {formatDate(getDate(lot))}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-[#0E1117]">{getProductName(lot)}</div>
                    <div className="text-[11px] text-[#9BA3BA]"><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {(lot as SLPlan).lot_no || lot.lot || ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-[#1D9E75]">{lot.blender || "-"}</div>
                    <div className="text-[13px] text-[#9BA3BA]">{lot.target_mt} MT</div>
                  </div>
                </div>
                {(lot as SLPlan).planned_pallets! > 0 && (
                  <div>
                    <div className="flex justify-between text-[11px] text-[#9BA3BA] mb-1">
                      <span>Pallet {(lot as SLPlan).done_pallets || 0}/{(lot as SLPlan).planned_pallets}</span>
                      <span>{Math.round(((lot as SLPlan).done_pallets || 0) / ((lot as SLPlan).planned_pallets!) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-[#DDE2EE] rounded-sm">
                      <div className="h-full rounded-sm" style={{ background: "#534AB7", width: `${((lot as SLPlan).done_pallets || 0) / ((lot as SLPlan).planned_pallets!) * 100}%` }} />
                    </div>
                  </div>
                )}
                <div className="bg-[#EEEDFE] border border-[#534AB7] rounded-lg px-3 py-2 mt-2 flex items-center gap-2">
                  <ClipboardCheck size={13} className="text-[#534AB7]" />
                  <span className="text-[11px] text-[#534AB7] font-medium">Pack Lead is being checked — View only.</span>
                </div>
              </Card>
            ))
          }
        </div>
      )}

      {/* ALL / IN PROGRESS / WAITING / SUBMITTED tabs */}
      {!["success", "draft", "finalcheck", "rejected", "pl_review"].includes(statusTab) && (
        <div>
          {statusTab === "all" && draftLots.length > 0 && (
            <div className="mb-3.5">
              <div className="text-[11px] font-medium text-[#9BA3BA] uppercase tracking-[0.06em] mb-2">Draft ({draftLots.length})</div>
              {draftLots.map((lot, i) => {
                console.log('draft lot:', (lot as SLPlan).date, lot.packing_date, (lot as SLPlan).product_name);

                return (
                  <div key={i} className="bg-white border-[0.5px] border-dashed border-[#DDE2EE] border-l-[3px] border-l-[#B4B2A9] rounded-r-xl px-3.5 py-[11px] mb-[7px]">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex gap-[5px] mb-[3px] flex-wrap">
                          <DeptBadge dept={lot.dept} /><Badge s="draft" />
                          {getDate(lot) && <span className="text-[11px] text-[#9BA3BA]">Date: {formatDate(getDate(lot))}</span>}
                        </div>
                        <div className="text-[13px] font-medium">{getProductName(lot)}</div>
                        <div className="text-[11px] text-[#9BA3BA] mt-0.5">
                          <span className="font-bold">#{(lot as any).display_no ?? '-'}</span>
                          {' '}Lot No: {(lot as SLPlan).lot_no || lot.lot || '—'}
                        </div>
                        {(lot as SLPlan).draft_note
                          ? <div className="text-[11px] text-[#9BA3BA] mt-1">{String((lot as SLPlan).draft_note)}</div>
                          : null}
                      </div>
                      <div className="flex gap-[5px]">
                        <Btn label="Edit" color="#534AB7" sm onClick={() => editDraft(lot)} />
                        <Btn label="Del" danger sm onClick={() => setDeleteModal({ open: true, lot })} />
                      </div>
                    </div>
                    {((lot as any).plan_created_by || (lot as any).plan_updated_by || (lot as any).special_comm) && (
                      <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-[#F4F5F7]">
                        {(lot as any).plan_created_by && (
                          <div className="flex items-center gap-1">
                            <UserCircle size={11} className="text-[#9BA3BA]" />
                            <span className="text-[10px] text-[#9BA3BA]">
                              Created by: <span className="font-medium text-[#5A617A]">{(lot as any).plan_created_by}</span>
                            </span>
                          </div>
                        )}
                        {(lot as any).plan_updated_by && (
                          <div className="flex items-center gap-1">
                            <PencilLine size={11} className="text-[#9BA3BA]" />
                            <span className="text-[10px] text-[#9BA3BA]">
                              Last updated: <span className="font-medium text-[#5A617A]">{(lot as any).plan_updated_by}</span>
                            </span>
                          </div>
                        )}
                        {(lot as any).special_comm && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#534AB7]">Note: {String((lot as any).special_comm)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {statusTab === "all" && emergencyLots.length > 0 && <EmergencyIssueRow lots={emergencyLots as EmergencyLot[]} type="emergency" onDetail={lot => { setProgressLot(lot); setView("packer_progress"); }} />}
          {statusTab === "all" && issueLots.length > 0 && <EmergencyIssueRow lots={issueLots as EmergencyLot[]} type="issue" onDetail={lot => { setProgressLot(lot); setView("packer_progress"); }} />}

          {statusTab === "all" && filteredLots.filter(l => l.status === "rejected").length > 0 && (
            <div className="mb-3.5">
              <div className="text-[11px] font-bold text-[#791F1F] uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-[#791F1F] flex-shrink-0" />
                <span>
                  Rejected — awaiting Packer fix ({filteredLots.filter(l => l.status === "rejected").length})
                </span>
              </div>
              {filteredLots.filter(l => l.status === "rejected").map((lot, i) => (
                <div key={i} className="bg-[#FCEBEB] border-[1.5px] border-[#E24B4A] border-l-4 border-l-[#E24B4A] rounded-r-[10px] px-3.5 py-[11px] mb-2 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setProgressLot(lot); setView("packer_progress"); }}>
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <div className="inline-flex items-center gap-[5px] mb-[3px]">
                        <DeptBadge dept={lot.dept} />
                        <span className="inline-flex items-center gap-[3px] text-[11px] font-semibold text-[#791F1F]">
                          <XCircle size={12} className="shrink-0" />
                          <span>Rejected</span>
                        </span>
                      </div>
                      <div className="text-[13px] font-medium text-[#0E1117]">{lot.product}</div>
                      <div className="text-[11px] text-[#791F1F] mt-0.5">{lot.reject_remark}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-[#9BA3BA]">Packer must fix and resubmit</div>
                  <div className="text-[11px] text-[#9BA3BA] flex items-center gap-1 mt-1">
                    <Eye size={11} />
                    <span>Tap to view details</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(statusTab === "all" || statusTab === "submitted") && finalQueue.filter(l => deptOk(l.dept)).length > 0 && (
            <div className="mb-3.5">
              <div className="text-[11px] font-medium text-[#854F0B] uppercase tracking-[0.06em] mb-2">Final check pending ({finalQueue.filter(l => deptOk(l.dept)).length})</div>
              {finalQueue.filter(l => deptOk(l.dept)).map((lot, i) => (
                <Card key={i} accentLeft="#854F0B" className="mb-2 px-3.5 py-[11px]">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-[22px]">{DEPT[lot.dept as DeptKey]?.icon}</span>
                      <div>
                        <div className="flex gap-[5px] mb-0.5"><DeptBadge dept={lot.dept} /><Badge s={lot.status} /></div>
                        <div className="text-[13px] font-medium">{lot.product}</div>
                        <div className="text-[11px] text-[#9BA3BA]   "><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot}</div>
                      </div>
                    </div>
                    <Btn label="Review" color="#854F0B" sm onClick={() => { setProgressLot(lot); setView("packer_progress_final"); }} />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeLots.filter(l => !["draft", "head_approved", "completed", "rejected"].includes(l.status)).length === 0 && statusTab !== "all"
            ? <div className="text-center py-8 text-[#9BA3BA]">No lots in this category</div>
            : activeLots.filter(l => !["draft", "head_approved", "completed", "rejected"].includes(l.status)).map((lot, i) => {
              const isClickable = ['in_progress', 'paused_shift_end', 'paused_issue', 'paused_emergency'].includes(lot.status);
              return (
                <Card
                  key={i}
                  accentLeft={DEPT[lot.dept as DeptKey]?.accent || "#185FA5"}
                  className={`mb-2.5${isClickable ? ' hover:shadow-md' : ''}`}
                  onClick={isClickable ? () => { setProgressLot(lot); setView("packer_progress"); } : undefined}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex gap-1.5 mb-1 flex-wrap">
                        <DeptBadge dept={lot.dept} />
                        <Badge s={lot.status} />
                        {getDate(lot) && (
                          <span className="text-[11px] text-[#9BA3BA]">Date: {formatDate(getDate(lot))}</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-[#0E1117]">{getProductName(lot)}</div>
                      <div className="text-[11px] text-[#9BA3BA]"><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {(lot as SLPlan).lot_no || lot.lot || ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-[#1D9E75]">{lot.blender || "-"}</div>
                      <div className="text-[13px] text-[#9BA3BA]">{lot.target_mt} MT</div>
                    </div>
                  </div>
                  {["in_progress", "paused_shift_end", "paused_issue", "paused_emergency"].includes(lot.status) && (lot as SLPlan).planned_pallets! > 0 && (
                    <div>
                      <div className="flex justify-between text-[11px] text-[#9BA3BA] mb-1">
                        <span>Pallet {(lot as SLPlan).done_pallets || 0}/{(lot as SLPlan).planned_pallets}</span>
                        <span>{Math.round(((lot as SLPlan).done_pallets || 0) / ((lot as SLPlan).planned_pallets!) * 100)}%</span>
                      </div>
                      <div className="h-1 bg-[#DDE2EE] rounded-sm">
                        <div className="h-full rounded-sm" style={{ background: DEPT[lot.dept as DeptKey]?.accent || "#185FA5", width: `${((lot as SLPlan).done_pallets || 0) / ((lot as SLPlan).planned_pallets!) * 100}%` }} />
                      </div>
                    </div>
                  )}
                  {isClickable && (
                    <div className="mt-2 text-[11px] text-[#9BA3BA] text-right flex items-center justify-end gap-1">
                      <Eye size={11} />แตะเพื่อดูความคืบหน้า
                    </div>
                  )}
                  {lot.status === "pl_review" && (
                    <div className="bg-[#EEEDFE] border border-[#534AB7] rounded-lg px-3 py-2 mt-2 flex items-center gap-2">
                      <ClipboardCheck size={13} className="text-[#534AB7]" />
                      <span className="text-[11px] text-[#534AB7] font-medium">Pack Lead กำลังตรวจสอบ — รอผล</span>
                    </div>
                  )}
                  {lot.status === "waiting" && (
                    <Btn
                      label={<span className="flex items-center justify-center gap-1.5"><PencilLine size={13} />Edit lot</span>}
                      color={DEPT[lot.dept as DeptKey]?.accent || "#185FA5"}
                      full
                      sm
                      onClick={() => editDraft(lot)}
                    />
                  )}
                  {((lot as any).plan_created_by || (lot as any).plan_updated_by || (lot as any).special_comm) && (
                    <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-[#F4F5F7]">
                      {(lot as any).plan_created_by && (
                        <div className="flex items-center gap-1">
                          <UserCircle size={11} className="text-[#9BA3BA]" />
                          <span className="text-[10px] text-[#9BA3BA]">
                            Created by: <span className="font-medium text-[#5A617A]">{(lot as any).plan_created_by}</span>
                          </span>
                        </div>
                      )}
                      {(lot as any).plan_updated_by && (
                        <div className="flex items-center gap-1">
                          <PencilLine size={11} className="text-[#9BA3BA]" />
                          <span className="text-[10px] text-[#9BA3BA]">
                            Last updated: <span className="font-medium text-[#5A617A]">{(lot as any).plan_updated_by}</span>
                          </span>
                        </div>
                      )}
                      {(lot as any).special_comm && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[#534AB7]">Note: {String((lot as any).special_comm)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          }
        </div>
      )}

      {/* Dept select modal */}
      {view === "dept_select" && (
        <div className="fixed inset-0 bg-black/45 z-[100] flex items-center justify-center p-5" onClick={() => setView("dashboard")}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-[480px]">
            <div className="text-base font-medium text-[#0E1117] mb-1">Select form type</div>
            <div className="text-[13px] text-[#9BA3BA] mb-[18px]">Choose department to create a new production plan</div>
            <div className="grid grid-cols-2 gap-2.5">
              {(Object.entries(DEPT) as [DeptKey, typeof DEPT[DeptKey]][]).map(([k, d]) => (
                <button key={k} onClick={() => { setView("dashboard"); startPlan(k); }}
                  className="bg-white border-[0.5px] border-[#DDE2EE] rounded-xl px-3 py-4 cursor-pointer text-left border-t-4"
                  style={{ borderTopColor: d.accent }}>
                  <div className="text-[28px] mb-2">{d.icon}</div>
                  <div className="text-[15px] font-medium mb-1" style={{ color: d.accent }}>{d.label}</div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-[20px]" style={{ background: d.badge.bg, color: d.badge.color }}>
                    {d.src === "upload" ? "Upload .xlsx" : "Fill manually"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t-[0.5px] border-[#DDE2EE] flex z-40 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]" style={{ padding: "8px 0 max(8px, env(safe-area-inset-bottom))" }}>
        {[
          { k: "all", icon: <LayoutGrid size={18} />, l: "All" },
          { k: "draft", icon: <FileText size={18} />, l: "Draft" },
          { k: "inprogress", icon: <Play size={18} />, l: "In progress" },
          { k: "finalcheck", icon: <ClipboardCheck size={18} />, l: "Final Check" },
          { k: "success", icon: <Check size={18} />, l: "Done" },
        ].map(t => {
          const active = statusTab === t.k;
          const cnt = t.k === "all" ? lots.length
            : t.k === "finalcheck" ? lots.filter(l => l.status === "head_approved").length
              : t.k === "inprogress" ? lots.filter(l => ["in_progress", "paused_shift_end", "paused_issue", "paused_emergency", "pl_review"].includes(l.status)).length
                : t.k === "draft" ? lots.filter(l => l.status === "draft" && deptOk(l.dept)).length
                  : lots.filter(l => l.status === "completed").length;
          return (
            <button key={t.k} onClick={() => setStatusTab(t.k)}
              className="flex-1 flex flex-col items-center gap-0.5 py-1 bg-transparent border-none cursor-pointer relative">
              <span className="text-base leading-none" style={{ color: active ? "#185FA5" : "#9BA3BA" }}>{t.icon}</span>
              <span className="text-[10px]" style={{ fontWeight: active ? 600 : 400, color: active ? "#185FA5" : "#9BA3BA" }}>{t.l}</span>
              {cnt > 0 && (
                <span className="absolute top-0 right-[18%] text-[9px] font-bold px-[5px] py-px rounded-[10px] min-w-[14px] text-center"
                  style={{ background: active ? "#185FA5" : "#DDE2EE", color: active ? "#fff" : "#9BA3BA" }}>{cnt}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SLApp() {
  const [lots, setLots] = useState<Lot[]>([]);

  useEffect(() => {
    fetchAndFlattenLots().then(data => setLots(data as Lot[]))
  }, []);

  return (
    <div className="font-sans">
      <SLScreen lots={lots} setLots={setLots} />
    </div>
  );
}