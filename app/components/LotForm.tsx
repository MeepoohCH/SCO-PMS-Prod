"use client";

import { useState, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Inp, Combo, Card } from "./shared";
import { DEPT } from "./constants";
import type { DeptKey } from "./constants";

// ════════════════════════════════════════════════════════
// LotForm.tsx — SECTION MAP (Ctrl+F to jump)
// ────────────────────────────────────────────────────────
// [SHARED]      Plan date + Blender
// [SHARED]      Lot info common (Product / Lot / Target / Country / CutOff)
// [IBC-ONLY]    Operator Name, Quality Status, IBC weights
// [SHARED]      Packaging type + Export-on-Pallet / Empty-Tank toggle
// [SHARED]      Estimated Containers calculation
// [PUF/PU-ONLY] Flush Blender  (excluded for Latex & IBC)
// [SHARED]      Label no. range + LabelCalcBox
// [SHARED]      Draft note + Special Comment
// ════════════════════════════════════════════════════════

// ── Inline LabelCalcBox (avoids circular dep with Admin.tsx) ──

interface LabelCalcResult {
  total: number;
  pallets: number;
  perPallet: number;
  unit: string;
  isTote: boolean;
  rem: number;
}

function calcLabel(
  start: string | number,
  end: string | number,
  packagingType: string,
): LabelCalcResult | null {
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

function LabelCalcBox({
  start,
  end,
  packagingType,
}: {
  start?: string | number;
  end?: string | number;
  packagingType: string;
}) {
  const r = start != null && end != null ? calcLabel(start, end, packagingType) : null;
  if (!r)
    return (
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
          <div className="text-[22px] font-extrabold text-amber-800 leading-none">{r.total}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">{r.unit}</div>
        </div>
        <div className="text-[18px] text-[#DDE2EE]">÷</div>
        <div className="text-center">
          <div className="text-[22px] font-extrabold text-amber-800 leading-none">{r.perPallet}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">{r.unit}/pallet</div>
        </div>
        <div className="text-[18px] text-[#DDE2EE]">=</div>
        <div className="text-center">
          <div className="text-[22px] font-extrabold text-amber-800 leading-none">{r.pallets}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">pallets</div>
        </div>
        {r.rem > 0 && (
          <div className="text-center">
            <div className="text-xs text-amber-600 font-medium">+ {r.rem} loose</div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Types ──────────────────────────────────────────────────────

export interface LotPlan {
  dept: string;
  date?: string;
  blender?: string;
  blender_id?: number;
  product?: string;
  product_name?: string;
  product_id?: number;
  lot?: string;
  lot_no?: string;
  customer?: string;
  country_label?: string;
  customer_id?: number;
  packaging_type?: string | { name?: string;[key: string]: unknown };
  packaging_type_id?: number;
  target_mt?: number | string;
  packaging_size_kg?: string;
  flush_blender?: string;
  planned_pallets?: number;
  export_on_pallet?: boolean;
  empty_tank?: boolean;
  drum_serial_start?: string | number;
  drum_serial_end?: string | number;
  label_pkg_type?: string;
  draft_note?: string;
  cut_off_date?: string;
  operator_name?: string;
  quality_status?: string;
  ibc_residue_kg?: string;
  ibc_empty_before_kg?: string;
  ibc_with_product_kg?: string;
  ibc_product_net_kg?: string;
  [key: string]: unknown;
}

interface DBRow {
  id: number;
  [key: string]: unknown;
}

export interface LotFormDb {
  products: DBRow[];
  customers: DBRow[];
  packaging: DBRow[];
  blenders: DBRow[];
}

export interface LotFormProps {
  plan: LotPlan;
  setPlan: Dispatch<SetStateAction<LotPlan | null>>;
  db?: LotFormDb;
  mode?: "sl" | "admin";
}

// ── Fallback options when DB not yet loaded ─────────────────────

const FALLBACK_BLENDER_OPTS = ["V-2300", "V-2310", "V-2320", "V-1050", "IBC Mixer"];
const FALLBACK_PACKAGING_OPTS = [
  "ISO-TANK", "Drum 1.0 mm", "Drum 1.2 mm", "Drum 1.5 mm",
  "TOTE", "IBC", "PE Drum", "Flexibag",
];
const FALLBACK_COUNTRY_OPTS = [
  "Sharp Thailand", "Thailand Label", "Philippine label",
  "Vietnam label", "Export On Pallet", "No Label",
];

// ── Component ──────────────────────────────────────────────────

export function LotForm({ plan, setPlan, db, mode: _mode }: LotFormProps) {
  const [localDb, setLocalDb] = useState<LotFormDb | null>(null);

  useEffect(() => {
    if (!db) {
      Promise.all([
        fetch("/api/products").then(r => r.json()),
        fetch("/api/customers").then(r => r.json()),
        fetch("/api/packaging-types").then(r => r.json()),
        fetch("/api/blenders").then(r => r.json()),
      ])
        .then(([products, customers, packaging, blenders]) => {
          setLocalDb({ products, customers, packaging, blenders });
        })
        .catch(() => { });
    }
  }, [db]);

  const data = db ?? localDb;
  const dbLoaded = !!data; // ยังไม่โหลดเสร็จ (db เป็น null) ต่างจาก โหลดเสร็จแต่ไม่มีข้อมูลจริง (array ว่าง)

  const allBlenders = data?.blenders ?? [];
  const deptBlenders = allBlenders.filter(b => b.dept === plan.dept && b.status !== 'retired');
  const activeBlenders = allBlenders.filter(b => b.status !== 'retired');

  // ปัญหาเดิม: ถ้า deptBlenders ว่าง โค้ดจะ fallback ไปใช้ FALLBACK_BLENDER_OPTS
  // ("V-2300", "V-2310", ...) ทันที ไม่ว่าจะเป็นเพราะข้อมูลยังโหลดไม่เสร็จ หรือเพราะ
  // ไม่มี Blender จริงในระบบเลยก็ตาม — ถ้า user เลือก/พิมพ์ชื่อ fallback พวกนี้แล้ว save
  // จะเจอ "ไม่พบ Blender กรุณาตรวจสอบ" เพราะ code พวกนี้ไม่มีอยู่จริงใน DB
  //
  // แก้ให้ใช้ FALLBACK_BLENDER_OPTS เฉพาะตอนข้อมูลยังโหลดไม่เสร็จเท่านั้น (dbLoaded === false)
  // พอโหลดเสร็จแล้ว ให้แสดงเฉพาะ code ที่มีอยู่จริง (ของแผนกนี้ก่อน แล้วค่อย fallback ไปทุกแผนก)
  // ถ้าโหลดเสร็จแล้วไม่มีจริงสักตัว ให้ปล่อย opts ว่าง แล้วโชว์ข้อความเตือนแทนแทนที่จะยัดชื่อปลอมเข้าไป
  const blenderOpts = !dbLoaded
    ? FALLBACK_BLENDER_OPTS
    : deptBlenders.length
      ? deptBlenders.map(b => b.code as string)
      : activeBlenders.map(b => b.code as string);

  const blenderWarning = !dbLoaded
    ? null
    : deptBlenders.length === 0
      ? (activeBlenders.length > 0
        ? `ยังไม่มี Blender ของแผนก ${plan.dept} ในระบบ — เลือกจากแผนกอื่นได้ชั่วคราว แต่ควรเพิ่มใน Admin ให้ตรงแผนกก่อนใช้งานจริง`
        : `ยังไม่มี Blender ในระบบเลย — กรุณาเพิ่ม Blender ที่ Admin > Blenders ก่อนสร้างแผนงาน`)
      : null;

  const allProducts = data?.products ?? [];
  const productOpts = allProducts
    .filter(p => p.dept === plan.dept && p.is_active !== false)
    .map(p => p.product_name as string);

  const packagingOpts = data?.packaging?.length
    ? data.packaging.map(p => p.name as string)
    : FALLBACK_PACKAGING_OPTS;

  const fetchedCountry = data?.customers
    ?.filter(c => c.is_active !== false)
    .map(c => c.country_label as string)
    .filter(Boolean) ?? []
  const countryOpts = fetchedCountry.length ? fetchedCountry : FALLBACK_COUNTRY_OPTS

  function set(key: string, val: unknown) {
    setPlan(p => p ? { ...p, [key]: val } : p);
  }

  const pkgTypeDisplay =
    typeof plan.packaging_type === "object"
      ? (plan.packaging_type as Record<string, string>)?.name || ""
      : (plan.packaging_type as string) || "";

  const selectedPkg = (data?.packaging ?? []).find(p => (p.name as string) === pkgTypeDisplay);
  const stdWeight = Number(selectedPkg?.standard_weight_kg || 0);
  const targetKg = Number(plan.target_mt || 0) * 1000;
  const drumCount = stdWeight > 0 && targetKg > 0 ? Math.ceil(targetKg / stdWeight) : null;
  const isTote =
    pkgTypeDisplay.toLowerCase().includes("tote") ||
    pkgTypeDisplay.toLowerCase().includes("ibc") ||
    pkgTypeDisplay.toLowerCase().includes("isotank") ||
    pkgTypeDisplay.toLowerCase().includes("flexibag");

  const derivedLabelPkgType = isTote ? "Tote" : "Drum";

  useEffect(() => {
    if (!pkgTypeDisplay) return;
    if ((plan.label_pkg_type as string) !== derivedLabelPkgType) {
      setPlan(p => p ? { ...p, label_pkg_type: derivedLabelPkgType } : p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkgTypeDisplay]);

  useEffect(() => {
    const s = parseInt(String(plan.drum_serial_start ?? ''), 10)
    const e = parseInt(String(plan.drum_serial_end ?? ''), 10)
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      const total = e - s + 1
      if (plan.label_count !== total) {
        setPlan(p => p ? { ...p, label_count: total } : p)
      }
    } else if (plan.label_count != null && (isNaN(s) || isNaN(e))) {
      setPlan(p => p ? { ...p, label_count: undefined } : p)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.drum_serial_start, plan.drum_serial_end])

  useEffect(() => {
    console.log('[LotForm] label fields from plan:', {
      drum_serial_start: plan.drum_serial_start,
      drum_serial_end: plan.drum_serial_end,
      label_pkg_type: plan.label_pkg_type,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.drum_serial_start, plan.drum_serial_end, plan.label_pkg_type]);

  const [addingBlender, setAddingBlender] = useState(false);
  const [addingPackaging, setAddingPackaging] = useState(false);

  // Quick-create Packaging type ตรงจากฟอร์มนี้เลย — เรียก POST /api/packaging-types
  // (non-admin สร้างได้แค่ name, category auto-detect จากชื่อ ให้ Admin ไปเติม
  // standard_weight_kg / drums_per_pallet ทีหลัง)
  async function handleAddPackaging(nameRaw: string) {
    const name = nameRaw.trim();
    if (!name) return;
    setAddingPackaging(true);
    try {
      const res = await fetch('/api/packaging-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const created = await res.json();
        setLocalDb(prev => prev
          ? { ...prev, packaging: [...prev.packaging, created] }
          : prev);
        setPlan(p => p ? { ...p, packaging_type: created.name, packaging_type_id: created.id } : p);
      } else {
        const err = await res.json().catch(() => ({}));
        alert('เพิ่ม Packaging type ไม่สำเร็จ: ' + (err.error || res.status));
      }
    } catch (e) {
      console.error('[LotForm handleAddPackaging] error:', e);
      alert('เพิ่ม Packaging type ไม่สำเร็จ — ตรวจสอบการเชื่อมต่อ');
    } finally {
      setAddingPackaging(false);
    }
  }

  // Quick-create Blender ตรงจากฟอร์มนี้เลย — เรียก POST /api/blenders (non-admin
  // จะสร้างได้แค่ code + dept, capacity_mt ปล่อยเป็น null ให้ Admin ไปตั้งทีหลัง)
  async function handleAddBlender(codeRaw: string) {
    const code = codeRaw.trim();
    if (!code) return;
    setAddingBlender(true);
    try {
      const res = await fetch('/api/blenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, dept: plan.dept }),
      });
      if (res.ok) {
        const created = await res.json();
        setLocalDb(prev => prev
          ? { ...prev, blenders: [...prev.blenders, created] }
          : prev);
        setPlan(p => p ? { ...p, blender: created.code, blender_id: created.id } : p);
      } else {
        const err = await res.json().catch(() => ({}));
        alert('เพิ่ม Blender ไม่สำเร็จ: ' + (err.error || res.status));
      }
    } catch (e) {
      console.error('[LotForm handleAddBlender] error:', e);
      alert('เพิ่ม Blender ไม่สำเร็จ — ตรวจสอบการเชื่อมต่อ');
    } finally {
      setAddingBlender(false);
    }
  }

  return (
    <Card className="mb-3">
      <div className="text-xs font-medium text-[#9BA3BA] mb-3 uppercase tracking-[0.06em]">
        General info
      </div>

      {/* ════════════════ [SHARED] Plan date + Blender ════════════════ */}
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Inp type="date" label="Plan date" req value={(plan.date as string) || ""} onChange={v => set("date", v)} />
        </div>
        <div>
          <Combo
            label="Tank No./Blender No."
            req
            value={(plan.blender as string) || ""}
            onChange={v => set("blender", v)}
            onAddNew={handleAddBlender}
            opts={blenderOpts}
            placeholder="Select or type blender..."
          />
          {addingBlender && (
            <div className="text-[11px] text-[#9BA3BA] -mt-3 mb-1">กำลังเพิ่ม Blender...</div>
          )}
          {blenderWarning && (
            <div className="text-[11px] text-[#B45309] -mt-3 mb-1 leading-snug">
              ⚠ {blenderWarning}
            </div>
          )}
          {dbLoaded && !!plan.blender && !blenderOpts.includes(plan.blender as string) && (
            <div className="text-[11px] text-[#E24B4A] -mt-3 mb-1 leading-snug">
              ⚠ "{plan.blender as string}" ไม่ตรงกับ Blender ในระบบ — กรุณาเลือกจากลิสต์ ไม่งั้นจะ Save draft ไม่ผ่าน
            </div>
          )}
        </div>
      </div>

      {/* Lot info section */}
      <div className="mt-2.5 px-3.5 py-3 bg-[#EEF3FF] border-[0.5px] border-[#93ABEE] rounded-xl">
        <div className="text-[11px] font-semibold text-[#1A4FD8] mb-2.5 uppercase tracking-[0.06em]">
          Lot info — กรอกครั้งเดียวใช้ทุกกะ
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {/* ════════════ [IBC-ONLY] Operator Name (top of lot info grid) ════════════ */}
          {plan.dept === "IBC" && (
            <div className="col-span-2">
              <Inp
                label="Operator Name"
                req
                value={(plan.operator_name as string) || ""}
                onChange={v => set("operator_name", v)}
                placeholder="e.g. สมชาย"
              />
            </div>
          )}

          {/* ════════════════════ [SHARED] Common lot fields ════════════════════ */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-[#5A617A] font-bold tracking-wide select-none">
                <span className="text-[#E24B4A]">* </span>Product Name
              </span>
              {plan.dept && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: DEPT[plan.dept as DeptKey]?.badge.bg || '#F4F5F7',
                    color: DEPT[plan.dept as DeptKey]?.badge.color || '#5A617A',
                  }}
                >
                  {plan.dept} only
                </span>
              )}
            </div>
            <Combo
              label=""
              value={(plan.product_name as string) || ""}
              onChange={v => {
                const found = allProducts.find(
                  p => (p.product_name as string) === v && p.dept === plan.dept
                );
                setPlan(p =>
                  p
                    ? { ...p, product_name: v, product: v, product_id: found ? found.id : undefined }
                    : p,
                );
              }}
              opts={productOpts}
              placeholder="e.g. DSD 757.01"
            />
          </div>

          <Inp
            label="Lot No"
            req
            value={(plan.lot_no as string) || ""}
            onChange={v => set("lot_no", v)}
            placeholder="e.g. C617Q57012"
          />
          <Inp
            label="Target Amount (MT)"
            type="number"
            req
            value={String(plan.target_mt || "")}
            onChange={v => set("target_mt", v)}
            placeholder="e.g. 23.5"
          />
          <Combo
            label="Country Label"
            req
            value={(plan.country_label as string) || ""}
            onChange={v => {
              const found = data?.customers.find(c => (c.country_label as string) === v);
              setPlan(p =>
                p
                  ? { ...p, country_label: v, customer: v, ...(found && { customer_id: found.id }) }
                  : p,
              );
            }}
            opts={countryOpts}
            placeholder="Select or type..."
          />
          <Inp label="Cut off Date" req type="date" value={(plan.cut_off_date as string) || ""} onChange={v => set("cut_off_date", v)} />

          {/* ════════════════════════ [IBC-ONLY FIELDS] ════════════════════════ */}
          {plan.dept === "IBC" && (
            <>
              <div className="col-span-2 pt-1 border-t-[0.5px] border-[#BFD0F7]">
                <div className="text-[11px] font-semibold text-[#1A4FD8] mb-2">
                  IBC specific fields
                </div>
              </div>
              <div className="col-span-2">
                <Combo
                  label="Quality Status"
                  value={(plan.quality_status as string) || ""}
                  onChange={v => set("quality_status", v)}
                  opts={["LAB", "Pass", "Pending", "Fail", "On Hold"]}
                  placeholder="e.g. LAB"
                  req
                />
              </div>
              <Inp
                label="น้ำหนัก ที่ เศษ ใน IBC ที่"
                type="text"
                value={(plan.ibc_residue_kg as string) || ""}
                onChange={v => set("ibc_residue_kg", v)}
                req

              />
              <Inp
                label="น้ำหนัก IBC เปล่าก่อนผลิต (KG)"
                type="number"
                value={(plan.ibc_empty_before_kg as string) || ""}
                onChange={v => set("ibc_empty_before_kg", v)}
                placeholder="kg"
                req
              />
              <Inp
                label="น้ำหนัก IBC เปล่า + Product (KG)"
                type="number"
                value={(plan.ibc_with_product_kg as string) || ""}
                onChange={v => set("ibc_with_product_kg", v)}
                placeholder="kg"
                req
              />
              <Inp
                label="น้ำหนัก Product (KG)"
                type="number"
                value={(plan.ibc_product_net_kg as string) || ""}
                onChange={v => set("ibc_product_net_kg", v)}
                placeholder="kg"
                req
              />
            </>
          )}
          {/* ════════════════════════ [/IBC-ONLY FIELDS] ════════════════════════ */}
        </div>
      </div>

      {/* Used across all shifts */}
      <div className="mt-1 px-3.5 py-3 bg-[#F8FAFC] border-[0.5px] border-[#DDE2EE] rounded-xl">
        <div className="text-[11px] font-semibold text-[#5A617A] mb-2.5 uppercase tracking-[0.06em]">
          Used across all shifts
        </div>

        {/* ════ [SHARED] Packaging type + Export-on-Pallet / Empty-Tank toggle ════ */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <Combo
              label="Packaging type"
              req
              value={pkgTypeDisplay}
              onChange={v => {
                const found = data?.packaging.find(p => (p.name as string) === v);
                setPlan(p =>
                  p
                    ? {
                      ...p,
                      packaging_type: v,
                      ...(found && { packaging_type_id: found.id }),
                    }
                    : p,
                );
              }}
              onAddNew={handleAddPackaging}
              opts={packagingOpts}
              placeholder="Choose packaging type..."
            />
            {addingPackaging && (
              <div className="text-[11px] text-[#9BA3BA] mt-1.5">กำลังเพิ่ม Packaging type...</div>
            )}
            {dbLoaded && !!pkgTypeDisplay && !selectedPkg && !addingPackaging && (
              <div className="text-[11px] text-[#E24B4A] mt-1.5 leading-snug">
                ⚠ "{pkgTypeDisplay}" ไม่ตรงกับ Packaging type ในระบบ — กด "+ Add" ใน dropdown เพื่อสร้างใหม่ ไม่งั้นจะ Save ไม่ผ่าน
              </div>
            )}
            {selectedPkg && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {!!selectedPkg.standard_weight_kg && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#E6F1FB] text-[#185FA5] border border-[#185FA5]">
                    {String(selectedPkg.standard_weight_kg)} kg/unit
                  </span>
                )}
                {!!selectedPkg.drums_per_pallet && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#EAF3DE] text-[#27500A] border border-[#27500A]">
                    {String(selectedPkg.drums_per_pallet)} units/pallet
                  </span>
                )}
                {!!selectedPkg.packaging_category && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#F4F5F7] text-[#5A617A] border border-[#DDE2EE]">
                    {String(selectedPkg.packaging_category)}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* ═══ [SHARED, dept-aware] Export on Pallet (non-Latex) / Empty Tank (Latex only) ═══ */}
          <div>
            <div className="text-xs text-[#5A617A] font-medium mb-1.5">
              <span className="text-[#E24B4A]">*</span> {plan.dept === "Latex" ? "Empty Tank" : "Export on Pallet"}
            </div>
            <div className="flex gap-1.5">
              {(["Yes", "No"] as const).map(l => {
                const key = plan.dept === "Latex" ? "empty_tank" : "export_on_pallet";
                const isYes = l === "Yes";
                const active = isYes ? plan[key] === true : plan[key] !== true;
                const activeColor = isYes ? "#27500A" : "#475569";
                const activeBg = isYes ? "#EAF3DE" : "#F4F5F7";
                return (
                  <button
                    key={l}
                    onClick={() => set(key, isYes)}
                    className="flex-1 p-2 rounded-lg text-[13px] font-semibold cursor-pointer border-[1.5px]"
                    style={{
                      borderColor: active ? activeColor : "#DDE2EE",
                      background: active ? activeBg : "#fff",
                      color: active ? activeColor : "#9BA3BA",
                    }}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ════════════════════ [SHARED] Estimated Containers ════════════════════ */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 mb-3 max-w-full">
          {/* Header */}
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
            Estimated Containers
          </div>

          {/* Calculation Row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex items-center gap-3 bg-white border border-[#E2E8F0] rounded-lg px-3.5 py-2 shadow-sm">
              {/* Target */}
              <div className="text-center min-w-[70px]">
                <div className="text-[16px] font-bold text-[#0F2347]">
                  {targetKg > 0 ? targetKg.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "—"} <span className="text-[12px] font-normal text-[#64748B]">kg</span>
                </div>
                <div className="text-[10px] text-[#94A3B8] uppercase font-medium mt-0.5">target</div>
              </div>

              {/* Divide Sign */}
              <div className="text-[14px] font-bold text-[#94A3B8] px-1">÷</div>

              {/* Std. Weight */}
              <div className="text-center min-w-[70px]">
                <div className="text-[16px] font-bold text-[#0F2347]">
                  {stdWeight > 0 ? stdWeight.toLocaleString() : "—"} <span className="text-[12px] font-normal text-[#64748B]">kg</span>
                </div>
                <div className="text-[10px] text-[#94A3B8] uppercase font-medium mt-0.5">std. weight</div>
              </div>

              {/* Equal Sign */}
              <div className="text-[14px] font-bold text-[#94A3B8] px-1">=</div>

              {/* Result Totes/Drums */}
              <div className="text-center min-w-[60px]">
                <div className="text-[20px] font-extrabold text-[#185FA5] leading-none">
                  {drumCount ?? "—"}
                </div>
                <div className="text-[10px] text-[#64748B] font-medium lowercase mt-1">
                  {isTote ? "totes" : "drums"}
                </div>
              </div>
            </div>

            {/* Pallet Summary Badge */}
            {drumCount != null && (
              <div className="flex items-center gap-1.5 bg-[#EEF2F6] border border-[#CBD5E1] rounded-lg px-3 py-2.5 shadow-sm self-stretch">
                <span className="text-[12px] text-[#334155] font-medium">≈</span>
                <span className="text-[16px] font-bold text-[#1E293B]">
                  {Math.ceil(drumCount / (isTote ? 1 : 4))}
                </span>
                <span className="text-[12px] text-[#64748B] font-medium">pallets</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Planned Pallets ── */}
        <Inp
          label="Planned Pallets"
          type="number"
          req
          value={String(plan.planned_pallets || "")}
          onChange={v => set("planned_pallets", v)}
          placeholder="e.g. 22"
        />

        {/* ════ [PUF / PU ONLY] Flush Blender — excluded for Latex & IBC ════ */}
        {!["Latex", "IBC"].includes(plan.dept) && (
          <Inp
            label="Flush Blender (type)"
            value={(plan.flush_blender as string) || ""}
            onChange={v => set("flush_blender", v)}
          />
        )}
      </div>

      {/* ═══════════════ [SHARED] Label no. range + LabelCalcBox ═══════════════ */}
      <div className="mt-2.5 mb-2.5 px-3.5 py-3 bg-[#FFFDF5] border-[1.5px] border-amber-500 rounded-xl">
        <div className="text-xs font-bold text-amber-900 mb-2.5">Label no. (drum / tote range)</div>
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <div className="text-xs text-[#5A617A] font-medium mb-1">
              <span className="text-[#E24B4A]">*</span> Label no. (start)
            </div>
            <input
              type="number"
              value={(plan.drum_serial_start as string) || ""}
              onChange={e => set("drum_serial_start", e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
              placeholder="e.g. 1"
              className="w-full box-border text-lg font-bold px-3 py-[9px] rounded-lg bg-white outline-none border-[1.5px] transition-colors focus:border-amber-600 text-slate-800"
              style={{ borderColor: plan.drum_serial_start ? "#F59E0B" : "#DDE2EE" }}
            />
          </div>
          <div>
            <div className="text-xs text-[#5A617A] font-medium mb-1">
              <span className="text-[#E24B4A]">*</span> Label no. (end)
            </div>
            <input
              type="number"
              value={(plan.drum_serial_end as string) || ""}
              onChange={e => set("drum_serial_end", e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
              placeholder="e.g. 24"
              className="w-full box-border text-lg font-bold px-3 py-[9px] rounded-lg bg-white outline-none border-[1.5px] transition-colors focus:border-amber-600 text-slate-800"
              style={{ borderColor: plan.drum_serial_end ? "#F59E0B" : "#DDE2EE" }}
            />
          </div>
        </div>
        <div className="mb-2">
          <div className="text-xs text-[#5A617A] font-medium mb-1">
            Packaging type (for calculation)
          </div>
          <div className="flex gap-1.5">
            {["Drum", "Tote"].map(t => {
              const active = ((plan.label_pkg_type as string) || derivedLabelPkgType) === t;
              const isAuto = active && t === derivedLabelPkgType;
              return (
                <button
                  key={t}
                  onClick={() => set("label_pkg_type", t)}
                  className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold cursor-pointer border-[1.5px] transition-all"
                  style={{
                    borderColor: active ? "#ffa60c" : "#DDE2EE",
                    background: active ? "#ffa60c" : "#fff",
                    color: active ? "#fff" : "#9BA3BA",
                  }}
                >
                  {t === "Drum" ? "Drum (4/pallet)" : "Tote (1/pallet)"}
                  {isAuto}
                </button>
              );
            })}
          </div>
        </div>
        <LabelCalcBox
          start={plan.drum_serial_start as string | number | undefined}
          end={plan.drum_serial_end as string | number | undefined}
          packagingType={(plan.label_pkg_type as string) || derivedLabelPkgType}
        />
        <div className="text-[11px] text-[#9BA3BA] mt-2 leading-tight">
          Packer sees this range as read-only · each shift picks up where previous left off
        </div>

      </div>

      {/* ════════════════════ [SHARED] Footer fields ════════════════════ */}
      <Inp
        label="Draft note"
        value={(plan.draft_note as string) || ""}
        onChange={v => set("draft_note", v)}
        placeholder="e.g. Pending lot no. confirmation"
        sm
      />
      <Inp
        label="Special Comment"
        value={(plan as any).special_comm || ""}
        onChange={v => setPlan(p => p ? ({ ...p, special_comm: v } as any) : p)}
        placeholder="หมายเหตุพิเศษ เช่น ระวัง reactivity สูง..."
        className="placeholder:text-xs"
      />
    </Card>
  );
}