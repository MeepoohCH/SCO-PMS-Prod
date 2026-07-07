"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Scale, ClipboardCheck, CheckCircle2, RotateCcw, XCircle, ArrowDown, ArrowUp, Eye, AlertCircle, PackageSearch } from "lucide-react";
import PKFormViewer from "@/app/components/PKFormViewer";
import { formatDate } from "@/lib/utils";
import { fetchAndFlattenLots } from "@/lib/fetchLots";
import { Badge, DeptBadge, Btn } from "../components/shared";
import { DEPT } from "../components/constants";
import type { DeptKey } from "../components/constants";

// ── Local dept color maps ──────────────────────────────────────
const DC: Record<string, string> = { PUF: "#534AB7", PU: "#185FA5", IBC: "#D97706", Latex: "#0891B2" };
// ── Types ──────────────────────────────────────────────────────

interface ChecklistItem { t: string; a: string; }
interface ScaleData { type: string; wt: string; recal: string; set: string; by: string; }
interface PLLot {
  id: number;
  dept: string;
  product: string;
  lot: string;
  date: string;
  op_date?: string;
  status: string;
  target: number;
  blender: string;
  customer: string;
  pkg: string;
  actual: number;
  remark: string | null;
  scPending: boolean;
  scOk: boolean;
  scBy?: string;
  label_count?: number;
  label_no_start?: string;
  label_no_end?: string;
  drumming_start?: string;
  drumming_end?: string;
  planned_pallets?: number;
  batch_size_kg?: string;
  container_tote?: number;
  container_drum?: number;
  cap_large?: number;
  cap_small?: number;
  empty_drum_wt?: string;
  flush_kg?: string;
  purge_kg?: string;
  drain_kg?: string;
  packer_name?: string;
  pl_name?: string;
  submitted_at?: string;
  pl_approved_at?: string | null;
  pre?: ChecklistItem[];
  post?: ChecklistItem[];
  sd?: ScaleData;
  scale_verifications?: { id: number; pl_approved_at?: string | null }[];
}

// ── Scale helpers ──────────────────────────────────────────────

function getStdWeight(pkg: string): number {
  const p = (pkg || '').toLowerCase()
  if (p.includes('1000') || p.includes('tote') || p.includes('ibc')) return 1000
  return 210
}

function getMachineLabel(lot: PLLot, scaleData: Record<string, unknown> | null): string {
  if (lot.dept === 'Latex') {
    return Number(scaleData?.round_no) === 2 ? 'Auto Drumming' : 'Manual Drumming'
  }
  if (lot.dept === 'IBC') {
    return 'Manual unloading IBC to drum'
  }
  return String(scaleData?.machine_code ?? '-')
}

// ── ScaleCard ──────────────────────────────────────────────────

interface ScaleCardProps {
  lot: PLLot;
  onApprove: (lot: PLLot) => void;
  onReject: (lot: PLLot) => void;
}

function ScaleCard({ lot, onApprove, onReject }: ScaleCardProps) {
  const sd = lot.sd || ({} as ScaleData);
  const stdWeight = getStdWeight(lot.pkg)
  const wOk = sd.wt ? Math.abs(+sd.wt - stdWeight) <= 0.5 : false;

  return (
    <div className="bg-white border border-gray-200 border-l-4 rounded-r-xl p-4 mb-3 cursor-pointer"
      style={{ borderLeftColor: DC[lot.dept] || "#534AB7" }}
      onClick={() => onApprove(lot)}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex gap-1.5 flex-wrap">
          <DeptBadge dept={lot.dept} />
          <span className="bg-[#F5F3FF] text-[#5B21B6] text-[11px] font-semibold px-2 py-0.5 rounded-[20px]">Scale รอ Approve</span>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-[#1D9E75]  ">{lot.blender || "-"}</div>
          <div className="text-[13px] text-[#9BA3BA] mt-px">{lot.target} MT</div>
        </div>
      </div>
      <div className="text-sm font-medium mb-0.5">{lot.product}</div>
      <div className="text-[11px] text-[#9BA3BA] mb-2.5  "><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot} . {formatDate(lot.date)}</div>

      <div className="bg-[#F5F3FF] rounded-[9px] px-3 py-2.5 mb-2.5">
        <div className="text-[11px] font-semibold text-[#5B21B6] mb-2">ผลการทดสอบ Scale</div>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ["เครื่อง", getMachineLabel(lot, null)],
            ["น้ำหนัก", sd.wt ? sd.wt + " kg" : "-"],
            ["ผล", wOk ? "PASS" : "FAIL"],
            ["Set", sd.set || "-"],
            ["Recalib", sd.recal || "-"],
            ["โดย", sd.by || "-"],
          ] as [string, string][]).map(([l, v]) => (
            <div key={l} className="bg-white rounded-[7px] px-2.5 py-[7px]">
              <div className="text-[10px] text-[#9BA3BA] mb-0.5">{l}</div>
              <div className="text-xs font-semibold  " style={{ color: l === "ผล" ? (wOk ? "#27500A" : "#791F1F") : "#0E1117" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <button
          onClick={e => { e.stopPropagation(); onReject(lot); }}
          className="flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold cursor-pointer border-none bg-[#CC0000] text-white">
          <XCircle size={16} />Reject
        </button>
        <button
          onClick={e => { e.stopPropagation(); onApprove(lot); }}
          className="flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold cursor-pointer border-none bg-[#27500A] text-white">
          <CheckCircle2 size={16} />Review
        </button>
      </div>
    </div>
  );
}

// ── ScaleApprovalCard ──────────────────────────────────────────

interface ScaleApprovalCardProps {
  lot: PLLot;
  onApprove: () => Promise<void>;
  onReject: () => void;
}

function ScaleApprovalCard({ lot, onApprove, onReject }: ScaleApprovalCardProps) {
  const [scaleData, setScaleData] = useState<Record<string, unknown> | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    console.log('[ScaleApprovalCard] lot.id:', lot.id)
    if (!lot.id) return
    const lotId = Number(lot.id)
    fetch(`/api/scale-verifications?production_detail_id=${lotId}`)
      .then(r => {
        console.log('[ScaleApprovalCard] fetch status:', r.status)
        return r.json()
      })
      .then((data: unknown) => {
        console.log('[ScaleApprovalCard] data:', JSON.stringify(data))
        if (!Array.isArray(data)) { setScaleData(null); return }
        const sorted = [...data].sort((a: any, b: any) => (a.round_no ?? 0) - (b.round_no ?? 0))
        const pending = sorted.find((v: any) => !v.pl_approved_at)
        setScaleData(pending ?? sorted[sorted.length - 1] ?? null)
      })
      .catch(err => {
        console.error('[ScaleApprovalCard] fetch error:', err)
      })
  }, [lot.id]);

  const measured = scaleData ? Number(scaleData.measured_weight_kg) : NaN;
  const stdWeight = scaleData ? Number(scaleData.standard_weight_kg || 210) : 210;
  const wOk = !isNaN(measured) && Math.abs(measured - stdWeight) <= 0.5;

  return (
    <div className="bg-[#EEEDFE] border border-[#534AB7] rounded-xl p-3 mt-2.5">
      <div className="text-[11px] font-bold text-[#534AB7] mb-2">
        Scale MDU Verification — Awaiting Approval
      </div>
      {scaleData ? (
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {([
            ["Machine", getMachineLabel(lot, scaleData)],
            ["Measured", !isNaN(measured) ? `${measured} kg` : "-"],
            ["Standard", !isNaN(stdWeight) ? `${stdWeight} ± 0.5 kg` : "210 ± 0.5 kg"],
            ["Result", !isNaN(measured) ? (wOk ? "PASS" : "FAIL") : "-"],
            ["Recalibration", scaleData.recalibration_required ? "Required" : "Not required"],
            ["Checked by", String((scaleData.checker as { full_name?: string } | null)?.full_name ?? "-")],
          ] as [string, string][]).map(([l, v]) => (
            <div key={l} className="bg-white rounded-lg px-2.5 py-1.5">
              <div className="text-[10px] text-[#534AB7] font-medium mb-0.5">{l}</div>
              <div className="text-[12px] font-semibold"
                style={{ color: l === "Result" ? (v === "PASS" ? "#27500A" : "#CC0000") : "#26215C" }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-[#9BA3BA] mb-3">Loading scale data...</div>
      )}
      <div className="grid grid-cols-[1fr_2fr] gap-2">
        <button
          onClick={onReject}
          className="flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-bold cursor-pointer border-none bg-[#CC0000] text-white">
          <XCircle size={16} />Reject
        </button>
        <Btn
          label={approving ? "Approving..." : "Approve Scale MDU"}
          color="#534AB7"
          full
          disabled={approving}
          onClick={async () => {
            setApproving(true);
            try { await onApprove(); }
            finally { setApproving(false); }
          }}
        />
      </div>
    </div>
  );
}

// ── SLRejectedCard ─────────────────────────────────────────────

interface SLRejectedCardProps {
  lot: PLLot;
  onViewDetails: () => void;
}

function SLRejectedCard({ lot, onViewDetails }: SLRejectedCardProps) {
  return (
    <div className="bg-[#FCEBEB] border border-[#E24B4A] rounded-xl p-3.5 mt-2.5">
      <div className="text-[11px] font-bold text-[#791F1F] mb-2">SL Rejection — Requires PL Acknowledgement</div>
      {lot.remark && (
        <div className="bg-white border border-[#E24B4A] rounded-lg px-2.5 py-2 mb-2.5">
          <div className="text-[10px] font-semibold text-[#791F1F] mb-0.5">SL Remark</div>
          <div className="text-[12px] text-[#501313]">{lot.remark}</div>
        </div>
      )}
      <div className="mt-2">
        <Btn
          label={
            <span className="flex items-center justify-center gap-1.5">
              View Details &amp; Acknowledge
            </span>
          }
          color="#E24B4A"
          full
          onClick={onViewDetails}
        />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PackLeadScreen
// ════════════════════════════════════════════════════════════

export default function PackLeadScreen() {
  const { data: session } = useSession();
  const allowedDepts = useMemo(() => {
    const d = session?.user?.allowed_depts ?? "all";
    if (!d || d === "all") return ["PUF", "PU", "IBC", "Latex"];
    return d.split(",").map(s => s.trim()).filter(Boolean);
  }, [session?.user?.allowed_depts]);

  const [lots, setLots] = useState<PLLot[]>([]);
  const [tab, setTab] = useState("scale");
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [progressLot, setProgressLot] = useState<PLLot | null>(null);
  const [pkView, setPkView] = useState<"list" | "progress" | "sl_rejected_progress" | "review_pl">("list");
  const [plAckRemark, setPlAckRemark] = useState('');
  const [acking, setAcking] = useState(false);
  const [ackDone, setAckDone] = useState(false);
  const user = "Mana K. (Pack Lead)";

  async function refresh() {
    const data = await fetchAndFlattenLots()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setLots(data.map((l: any) => {
      const svList: { id: number; pl_approved_at?: string | null }[] =
        Array.isArray(l.scale_verifications) ? l.scale_verifications : []
      const hasUnapprovedScale = svList.length > 0 && svList.some(s => !s.pl_approved_at)
      return {
        ...l,
        target: l.target_mt || 0,
        date: l.packing_date || '',
        pkg: l.packaging_type?.name ?? '',
        scPending: ['in_progress', 'rejected'].includes(l.status) && hasUnapprovedScale,
        scOk: svList.some(s => !!s.pl_approved_at),
      }
    }))
  }

  useEffect(() => { refresh(); }, []);

  const deptOk = (l: PLLot) => allowedDepts.includes(l.dept) && (deptFilter.length === 0 || deptFilter.includes(l.dept));
  const scalePending = lots.filter(l => l.scPending && !l.scOk && deptOk(l));
  const queue = lots.filter(l => l.status === "submitted" && deptOk(l));
  const approved = lots.filter(l => l.status === "head_approved" && deptOk(l));
  const plReview = lots.filter(l => l.status === "pl_review" && deptOk(l));
  const slRejected = lots.filter(l => l.status === "sl_rejected" && deptOk(l));
  const rejected = lots.filter(l => l.status === "rejected" && deptOk(l));
  const completed = lots.filter(l => l.status === "completed" && deptOk(l));

  async function approveScale(lot: PLLot) {
    console.log('[PL] action: approveScale lot id:', lot.id);
    let svId = lot.scale_verifications?.[0]?.id;
    if (!svId) {
      const fetchRes = await fetch(`/api/scale-verifications?production_detail_id=${lot.id}`);
      if (fetchRes.ok) {
        const svList = await fetchRes.json();
        svId = svList?.[0]?.id;
      }
    }
    if (!svId) {
      console.error('[PL] no scale verification found for lot:', lot.id);
      return;
    }
    const res = await fetch(`/api/scale-verifications/${svId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pl_approved_by: Number(session?.user?.id),
        pl_approved_at: new Date().toISOString(),
        is_locked: true,
      }),
    });
    console.log('[PL] API status:', res.status);
    if (res.ok) {
      setLots(p => p.map(l => l.id === lot.id
        ? { ...l, scPending: false, scOk: true, scBy: session?.user?.name || user }
        : l));
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('[PL] error:', err);
    }
  }
  async function rejectScale(lot: PLLot) {
    console.log('[PL] rejectScale lot id:', lot.id);
    // เปลี่ยน status กลับเป็น in_progress ให้ Packer ทำ Scale ใหม่
    await fetch(`/api/lots/${lot.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    setLots(p => p.map(l =>
      l.id === lot.id ? { ...l, status: 'in_progress', scPending: false, scOk: false } : l
    ));
  }
  async function approveLot(lot: PLLot) {
    console.log('[PL] action: approveLot lot id:', lot.id);
    const res = await fetch(`/api/lots/${lot.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "head_approved" }),
    });
    console.log('[PL] API status:', res.status);
    if (res.ok) {
      setLots(p => p.map(l => l.id === lot.id ? { ...l, status: "head_approved" } : l));
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('[PL] error:', err);
      alert('Approve failed: ' + (err.error || res.status));
    }
    await refresh();
  }
  async function rejectLot(lot: PLLot, remark: string) {
    console.log('[PL] action: rejectLot lot id:', lot.id);
    const res = await fetch(`/api/lots/${lot.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", reject_remark: remark }),
    });
    console.log('[PL] API status:', res.status);
    if (res.ok) {
      setLots(p => p.map(l => l.id === lot.id ? { ...l, status: "rejected", remark } : l));
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('[PL] error:', err);
    }
    await refresh();
  }

  const TABS = [
    {
      k: "scale",
      l: "Scale",
      icon: <Scale size={14} />,
      iconLg: <Scale size={20} />,
      cnt: scalePending.length,
      color: "#7C3AED",
      bg: "#F5F3FF",
    },
    {
      k: "queue",
      l: "Review",
      icon: <ClipboardCheck size={14} />,
      iconLg: <ClipboardCheck size={20} />,
      cnt: queue.length,
      color: "#0284C7",
      bg: "#F0F9FF",
    },
    {
      k: "approved",
      l: "Approved",
      icon: <CheckCircle2 size={14} />,
      iconLg: <CheckCircle2 size={20} />,
      cnt: approved.length,
      color: "#16A34A",
      bg: "#F0FDF4",
    },
    {
      k: "sl_rejected",
      l: "SL Rejected",
      icon: <RotateCcw size={14} />,
      iconLg: <RotateCcw size={20} />,
      cnt: slRejected.length,
      color: "#DC2626",
      bg: "#FEF2F2",
    },
    {
      k: "rejected",
      l: "PL Reject",
      icon: <XCircle size={14} />,
      iconLg: <XCircle size={20} />,
      cnt: rejected.length,
      color: "#B91C1C",
      bg: "#FEF2F2",
    },
    {
      k: "completed",
      l: "Completed",
      icon: <CheckCircle2 size={14} />,
      iconLg: <CheckCircle2 size={20} />,
      cnt: completed.length,
      color: "#27500A",
      bg: "#EAF3DE",
    },
  ];

  const rawLots = tab === "queue" ? queue : tab === "approved" ? approved : tab === "pl_review" ? plReview : tab === "sl_rejected" ? slRejected : tab === "completed" ? completed : rejected;
  const showLots = [...rawLots].sort((a, b) => {
    const dateA = new Date(a.date || 0).getTime();
    const dateB = new Date(b.date || 0).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  // ── Packer Progress view ──
  if (pkView === "progress" && progressLot) return (
    <div className="font-sans">
      <div className="pb-20">
        <PKFormViewer
          lot={progressLot as any}
          onBack={() => { setPkView("list"); setProgressLot(null); }}
          currentUser=""
          setLots={setLots as any}
          readOnly={true}
        />
      </div>
    </div>
  );

  // ── SL Rejected: Packer progress + Acknowledge ──
  if (pkView === "sl_rejected_progress" && progressLot) return (
    <div className="font-sans">
      <div className="pb-20">
        <PKFormViewer
          lot={progressLot as any}
          onBack={() => { setPkView("list"); setProgressLot(null); }}
          currentUser=""
          setLots={setLots as any}
          readOnly={true}
        />

        <div className="mt-4 bg-[#FCEBEB] border-2 border-[#E24B4A] rounded-xl p-4">
          <div className="text-[13px] font-semibold text-[#791F1F] mb-1">
            SL Rejection — Requires PL Acknowledgement
          </div>
          <div className="text-[11px] text-[#791F1F] mb-3">
            SL Reject Reason: {progressLot.remark || '—'}
          </div>
          <div className="mb-3">
            <div className="text-[11px] font-medium text-[#5A617A] mb-1.5">
              PL Remark (optional)
            </div>
            <textarea
              value={plAckRemark}
              onChange={e => setPlAckRemark(e.target.value)}
              rows={2}
              placeholder="เพิ่มหมายเหตุจาก Pack Lead..."
              className="w-full text-sm p-3 border border-[#DDE2EE] rounded-xl resize-none outline-none focus:border-[#534AB7]"
            />
          </div>
          {ackDone ? (
            <div className="bg-[#EAF3DE] border border-[#27500A] rounded-xl p-3 text-center">
              <div className="text-[12px] font-semibold text-[#27500A]">
                ✓ Acknowledged — Packer will be notified
              </div>
            </div>
          ) : (
            <Btn
              label={acking ? 'Acknowledging...' : 'Acknowledge & Move to Rejected'}
              color="#E24B4A"
              full
              disabled={acking}
              onClick={async () => {
                setAcking(true);
                try {
                  await fetch(`/api/lots/${progressLot.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      status: 'rejected',
                      reject_remark: progressLot.remark,
                      pl_remark: plAckRemark || null,
                    }),
                  });
                  setLots(p => p.map(l =>
                    l.id === progressLot.id ? { ...l, status: 'rejected' } : l
                  ));
                  setAckDone(true);
                } finally {
                  setAcking(false);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  // ── Review Lot (PL decision via PKFormViewer) ──
  if (pkView === "review_pl" && progressLot) return (
    <div className="font-sans">
      <div className="pb-20">
        <PKFormViewer
          lot={progressLot as any}
          onBack={() => { setPkView("list"); setProgressLot(null); }}
          currentUser=""
          setLots={setLots as any}
          readOnly={true}
          approveLabel="Approve"
          onApprove={async () => {
            await approveLot(progressLot);
            setPkView("list");
            setProgressLot(null);
          }}
          onReject={async (remark) => {
            await rejectLot(progressLot, remark);
            setPkView("list");
            setProgressLot(null);
          }}
        />
      </div>
    </div>
  );

  // ── Dashboard view ──
  return (
    <div className="font-sans pt-4">

      {/* 1. Stats grid อยู่บนสุด */}
      <div className="grid grid-cols-5 gap-2 mb-4 px-6">
        {TABS.map(t => (
          <div key={t.k}
            onClick={() => setTab(t.k)}
            className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer border-t-4 text-center"
            style={{ borderTopColor: t.color }}>
            <div className="text-2xl font-black  " style={{ color: t.color }}>{t.cnt}</div>
            <div className="text-xs text-gray-400 mt-1">{t.l}</div>
          </div>
        ))}
      </div>

      {/* 2. Tab bar (Filter) เลื่อนมาอยู่ใต้ Stats และทำ Sticky เมื่อเลื่อนหน้าจอ */}
      <div className="bg-white border-b-[0.5px] border-[#DDE2EE] sticky top-14 z-40 px-6 py-3 mb-4 rounded-xl">
        <div className="flex gap-3 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer whitespace-nowrap"
              style={{
                borderColor: tab === t.k ? t.color : "#DDE2EE",
                background: tab === t.k ? t.color : "transparent",
                color: tab === t.k ? "#fff" : "#9BA3BA",
              }}>
              {t.icon}
              {t.l}
              {t.cnt > 0 && (
                <span className="rounded-full px-1.5 py-px text-[10px] font-bold"
                  style={{ background: tab === t.k ? "rgba(255,255,255,0.25)" : "#DDE2EE", color: tab === t.k ? "#fff" : "#9BA3BA" }}>
                  {t.cnt}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
          <span className="text-[11px] font-medium text-[#9BA3BA] mr-0.5">Dept:</span>
          {(allowedDepts as DeptKey[]).map(d => {
            const on = deptFilter.includes(d);
            const dc = DEPT[d]?.accent || "#185FA5";
            return (
              <button key={d}
                onClick={() => setDeptFilter(prev =>
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
          {deptFilter.length > 0 && (
            <button
              onClick={() => setDeptFilter([])}
              className="text-[11px] text-[#9BA3BA] bg-transparent border-none cursor-pointer px-1.5 py-1">
              Clear ×
            </button>
          )}
          <button
            onClick={() => setSortOrder(p => p === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border-[0.5px] border-[#DDE2EE] bg-white cursor-pointer ml-auto"
          >
            {sortOrder === 'newest'
              ? <><ArrowDown size={12} /> Newest first</>
              : <><ArrowUp size={12} /> Oldest first</>
            }
          </button>
        </div>
      </div>

      {/* 3. รายการ Content ต่าง ๆ ด้านล่าง */}
      <div className="pb-20 px-6">

        {/* Scale MDU Pending Approval Banner — shows only in scale tab */}
        {plReview.length > 0 && tab === "scale" && (
          <div className="mb-4">
            <div className="text-[11px] font-bold text-[#534AB7] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <AlertCircle size={14} className="text-[#534AB7]" />
              Scale MDU Pending Approval ({plReview.length})
            </div>
            {plReview.map(lot => (
              <div key={lot.id} className="bg-white border border-[#534AB7] border-l-4 rounded-r-xl p-3.5 mb-2.5"
                style={{ borderLeftColor: "#534AB7" }}>
                <div className="flex justify-between items-start mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-1.5 mb-1 flex-wrap">
                      <DeptBadge dept={lot.dept} />
                      <Badge s={lot.status} />
                      {lot.date && <span className="text-[11px] text-[#9BA3BA]">{formatDate(lot.date)}</span>}
                    </div>
                    <div className="text-sm font-medium text-[#0E1117] truncate">{lot.product}</div>
                    <div className="text-[11px] text-[#9BA3BA] truncate"><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot}</div>
                  </div>
                  <div className="flex-shrink-0 ml-3 text-right">
                    <div className="text-base font-bold text-[#1D9E75]">{lot.blender || "-"}</div>
                    <div className="text-[13px] text-[#9BA3BA]">{lot.target} MT</div>
                  </div>
                </div>
                <ScaleApprovalCard
                  lot={lot}
                  onApprove={async () => {
                    console.log('[PL Approve] lot:', lot.id, lot.lot)
                    const lotId = Number(lot.id)
                    const fetchRes = await fetch(`/api/scale-verifications?production_detail_id=${lotId}`);
                    if (!fetchRes.ok) { alert('Failed to fetch scale verification'); return; }
                    const verifications = await fetchRes.json() as { id: number; round_no?: number; pl_approved_at?: string | null }[];
                    console.log('[PL Approve] verifications found:', Array.isArray(verifications) ? verifications.length : 'not array')
                    console.log('[PL Approve] verifications data:', JSON.stringify(verifications))
                    const sorted = [...verifications].sort((a, b) => (a.round_no ?? 0) - (b.round_no ?? 0))
                    const verification = sorted.find(v => !v.pl_approved_at) ?? sorted[sorted.length - 1]
                    if (!verification) {
                      console.error('[PL Approve] no verification for lot id:', lot.id)
                      alert(`No scale verification found for lot ${lot.lot} (id: ${lot.id})`)
                      return
                    }

                    await fetch(`/api/scale-verifications/${verification.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        pl_approved_by: Number(session?.user?.id),
                        pl_approved_at: new Date().toISOString(),
                        is_locked: true,
                      }),
                    });

                    if (lot.status !== 'rejected') {
                      await fetch(`/api/lots/${lot.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'in_progress' }),
                      });
                      setLots(p => p.map(l =>
                        l.id === lot.id
                          ? { ...l, status: 'in_progress', scOk: true, scBy: session?.user?.name || '' }
                          : l
                      ));
                    } else {
                      setLots(p => p.map(l =>
                        l.id === lot.id
                          ? { ...l, scOk: true, scBy: session?.user?.name || '' }
                          : l
                      ));
                    }
                    console.log('[PL] scale approved for lot:', lot.id);
                  }}
                  onReject={() => rejectScale(lot)}
                />
              </div>
            ))}
          </div>
        )}

        {/* Scale tab */}
        {tab === "scale" && (
          scalePending.length === 0 && plReview.length === 0
            ? <div className="text-center py-[60px] text-[#9BA3BA]"><Scale size={36} className="text-gray-300 mx-auto mb-3" />No pending scale approvals</div>
            : scalePending.length === 0
              ? null
              : scalePending.map(lot => (
                <ScaleCard key={lot.id} lot={lot} onApprove={approveScale} onReject={rejectScale} />
              ))
        )}

        {/* SL Rejected tab — PL must acknowledge before Packer sees it */}
        {tab === "sl_rejected" && (
          slRejected.length === 0
            ? <div className="text-center py-[60px] text-[#9BA3BA]"><RotateCcw size={36} className="text-gray-300 mx-auto mb-3" />ไม่มี lot ที่ SL ตีกลับ</div>
            : <>
              <div className="bg-[#FCEBEB] border-[0.5px] border-[#E24B4A] rounded-xl px-3.5 py-2.5 mb-3 text-xs text-[#791F1F]">
                SL ตีกลับ lot เหล่านี้ — PL ต้อง Acknowledge ก่อน Packer จะเห็นสถานะ Rejected
              </div>
              {slRejected.map(lot => {
                const dc2 = DC[lot.dept] || "#E24B4A";
                return (
                  <div key={lot.id}
                    className="bg-white border border-gray-200 border-l-4 rounded-r-xl p-4 mb-3"
                    style={{ borderLeftColor: dc2 }}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-1.5 mb-1 flex-wrap">
                          <DeptBadge dept={lot.dept} /><Badge s={lot.status} />
                          {lot.date && <span className="text-[11px] text-[#9BA3BA]">{formatDate(lot.date)}</span>}
                        </div>
                        <div className="text-sm font-medium text-[#0E1117] truncate mb-0.5">{lot.product}</div>
                        <div className="text-[11px] text-[#9BA3BA] truncate"><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot}</div>
                      </div>
                      <div className="flex-shrink-0 ml-3 text-right">
                        <div className="text-base font-bold text-[#1D9E75]">{lot.blender || "-"}</div>
                        <div className="text-[13px] text-[#9BA3BA]">{lot.target} MT</div>
                      </div>
                    </div>
                    <SLRejectedCard
                      lot={lot}
                      onViewDetails={() => {
                        setPlAckRemark('');
                        setAcking(false);
                        setAckDone(false);
                        setProgressLot(lot);
                        setPkView('sl_rejected_progress');
                      }}
                    />
                  </div>
                );
              })}
            </>
        )}

        {/* PL Reject tab */}
        {tab === "rejected" && (
          rejected.length === 0
            ? <div className="text-center py-[60px] text-[#9BA3BA]"><CheckCircle2 size={36} className="text-gray-300 mx-auto mb-3" />ไม่มี lot ที่ PL ตีกลับ</div>
            : <>
              <div className="bg-[#FCEBEB] border-[0.5px] border-[#E24B4A] rounded-xl px-3.5 py-2.5 mb-3 text-xs text-[#791F1F]">
                PL ตรวจสอบแล้วและตีกลับ Packer — รอ Packer แก้ไขและ submit ใหม่
              </div>
              {rejected.map(lot => {
                const dc2 = DC[lot.dept] || "#534AB7";
                return (
                  <div key={lot.id}
                    className="bg-white border border-gray-200 border-l-4 rounded-r-xl p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow"
                    style={{ borderLeftColor: dc2 }}
                    onClick={() => { setProgressLot(lot); setPkView("progress"); }}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-1.5 mb-1 flex-wrap">
                          <DeptBadge dept={lot.dept} /><Badge s={lot.status} />
                          {lot.date && <span className="text-[11px] text-[#9BA3BA]">{formatDate(lot.date)}</span>}
                        </div>
                        <div className="text-sm font-medium text-[#0E1117] truncate mb-0.5">{lot.product}</div>
                        <div className="text-[11px] text-[#9BA3BA] truncate"><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot}</div>
                      </div>
                      <div className="flex-shrink-0 ml-3 text-right">
                        <div className="text-base font-bold text-[#1D9E75]">{lot.blender || "-"}</div>
                        <div className="text-[13px] text-[#9BA3BA]">{lot.target} MT</div>
                      </div>
                    </div>
                    {lot.remark && (
                      <div className="bg-[#FCEBEB] border-[0.5px] border-[#E24B4A] rounded-lg px-2.5 py-2 text-xs text-[#791F1F]">
                        {lot.remark}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
        )}

        {/* Completed tab */}
        {tab === "completed" && (
          completed.length === 0
            ? (
              <div className="text-center py-[60px] text-[#9BA3BA]">
                <CheckCircle2 size={40} className="text-gray-300 mx-auto mb-3" />
                No completed lots
              </div>
            ) : (
              <>
                <div className="bg-[#EAF3DE] border border-[#27500A] rounded-xl px-3.5 py-2.5 mb-3.5 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#27500A]" />
                  <div>
                    <div className="text-[13px] font-semibold text-[#27500A]">Completed Lots</div>
                    <div className="text-[11px] text-[#3B6D11] mt-0.5">Lots that have been fully approved by Site Logistics</div>
                  </div>
                </div>
                {[...completed].sort((a, b) => {
                  const dateA = new Date(a.date || 0).getTime();
                  const dateB = new Date(b.date || 0).getTime();
                  return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
                }).map(lot => (
                  <div key={lot.id}
                    className="bg-white border border-gray-200 border-l-4 rounded-r-xl p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow"
                    style={{ borderLeftColor: "#27500A" }}
                    onClick={() => { setProgressLot(lot); setPkView("progress"); }}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-1.5 mb-1 flex-wrap">
                          <DeptBadge dept={lot.dept} />
                          <Badge s={lot.status} />
                          {lot.date && (
                            <span className="text-[11px] text-[#9BA3BA]">{formatDate(lot.date)}</span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-[#0E1117] truncate">{lot.product}</div>
                        <div className="text-[11px] text-[#9BA3BA] truncate"><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot}</div>
                        {(lot as any).plan_created_by && (
                          <div className="text-[10px] text-[#9BA3BA] mt-0.5">SL: {(lot as any).plan_created_by}</div>
                        )}
                      </div>
                      <div className="flex-shrink-0 ml-3 text-right">
                        <div className="text-base font-bold text-[#1D9E75]">{lot.blender || "-"}</div>
                        <div className="text-[13px] text-[#9BA3BA]">{lot.target} MT</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-[#9BA3BA] flex items-center justify-end gap-1">
                      <Eye size={11} />
                      <span>Tap to view details</span>
                    </div>
                  </div>
                ))}
              </>
            )
        )}

        {/* Review queue + Approved tabs */}
        {(tab === "queue" || tab === "approved") && (
          showLots.length === 0
            ? <div className="text-center py-[60px] text-[#9BA3BA]"><CheckCircle2 size={36} className="text-gray-300 mx-auto mb-3" />No lots here</div>
            : showLots.map(lot => {
              const dc2 = DC[lot.dept] || "#534AB7";
              return (
                <div key={lot.id}
                  className="bg-white border border-gray-200 border-l-4 rounded-r-xl p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow"
                  style={{ borderLeftColor: dc2 }}
                  onClick={() => { setProgressLot(lot); setPkView("review_pl"); }}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1.5 mb-1 flex-wrap">
                        <DeptBadge dept={lot.dept} /><Badge s={lot.status} />
                        {lot.date && <span className="text-[11px] text-[#9BA3BA]">{formatDate(lot.date)}</span>}
                      </div>
                      <div className="text-sm font-medium text-[#0E1117] truncate mb-0.5">{lot.product}</div>
                      <div className="text-[11px] text-[#9BA3BA] truncate"><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot}</div>
                    </div>
                    <div className="flex-shrink-0 ml-3 text-right">
                      <div className="text-base font-bold text-[#1D9E75]">{lot.blender || "-"}</div>
                      <div className="text-[13px] text-[#9BA3BA]">{lot.target} MT</div>
                    </div>
                  </div>
                  {tab === "queue" && (
                    <div className="flex justify-end mt-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setProgressLot(lot); setPkView("review_pl"); }}
                        className="h-10 px-5 rounded-xl text-sm font-semibold cursor-pointer border-none text-white flex items-center justify-center gap-2"
                        style={{ background: dc2 }}
                      >
                        <PackageSearch size={18} />Review
                      </button>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}