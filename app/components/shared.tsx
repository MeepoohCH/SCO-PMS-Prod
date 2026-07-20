"use client";

import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { Calendar, Scale, ClipboardList, Drum, Package, ClipboardCheck, PackageOpen, CheckCircle2, PauseCircle, AlertTriangle, AlertOctagon, Trash2 } from "lucide-react";
import { DEPT, STATUS, ROLE_META } from "./constants";
import { toThaiDateTimeInputValue, fromThaiInputToUTC } from "@/lib/utils";
import type { DeptKey, StatusKey, RoleKey } from "./constants";

// ── Font / color exports (อัปเดต Base Font ให้เรียบร้อยและสุขุมขึ้น) ─────────────────────
export const F = "var(--font-roboto), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const M = "var(-- ), 'JetBrains Mono', monospace";
export const NAVY = "#0F2347";
export const RED = "#CC0000";
export const GOLD = "#EF9F27";

// ── Types ──────────────────────────────────────────────────────
export type SelectOption = string | { v: string; l: string };

interface CardProps {
  children: ReactNode;
  className?: string;
  accentLeft?: string;
  accentTop?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

interface InpProps {
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  readOnly?: boolean;
  placeholder?: string;
  req?: boolean;
  note?: string;
  mono?: boolean;
  sm?: boolean;
  autoSaveStatus?: "saving" | "saved" | null;
  className?: string;
  lang?: string;
}

interface SelProps {
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  opts: SelectOption[];
  req?: boolean;
}

interface ComboProps {
  label?: string;
  value?: string;
  onChange?: (v: string) => void;
  opts?: SelectOption[];
  req?: boolean;
  placeholder?: string;
  mono?: boolean;
  onAddNew?: (v: string) => void; // ถ้าไม่ใส่ จะ fallback ไปใช้ onChange เหมือนเดิม (พฤติกรรมเดิม)
}

interface ComboCellProps {
  value?: string;
  onChange: (v: string) => void;
  opts?: string[];
  placeholder?: string;
}

interface BtnProps {
  label: ReactNode;
  onClick?: () => void;
  color?: string;
  outline?: boolean;
  disabled?: boolean;
  full?: boolean;
  sm?: boolean;
  danger?: boolean;
  icon?: ReactNode;
}

interface ToggleProps {
  opts: string[];
  value: string;
  onChange: (v: string) => void;
}

interface SectionLabelProps {
  children: ReactNode;
  action?: ReactNode;
}

interface NavbarProps {
  role: string;
  roles?: string[];
  onSwitchRole?: (role: string) => void;
  onLogout?: () => void;
  userName?: string;
  currentUser?: string;
}

interface DowLogoProps {
  size?: number;
}

interface ProgressBarProps {
  done: number;
  total: number;
  color: string;
}

interface LotStepBarProps {
  pkStep: number;
  dc: string;
  planned_pallets: number;
  sessions?: unknown[];
}

interface PauseControlsProps {
  onPause: (key: string) => void;
  pre?: boolean;
  onShiftEndClick?: () => void;
}

interface ResumePayload {
  start: string;
  end: string;
  type: string;
  reason: string;
  newOperator: string | null;
}

interface PausedCardProps {
  pauseType: "paused_shift_end" | "paused_issue" | "paused_emergency";
  onResume: (payload: ResumePayload) => void;
  currentUser: string;
  initialStartTime?: string;
}

interface AutosaveTagProps {
  status: "saving" | "saved" | null;
}

// ── useClock ──────────────────────────────────────────────────
export function useClock(): Date {
  const [n, sN] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => sN(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return n;
}

// ── Badge (ปรับให้อ่านง่ายขึ้น) ─────────────────────────────────────────────────────
export function Badge({ s }: { s: string }) {
  const d = (s in STATUS ? STATUS[s as StatusKey] : null) ?? { bg: "#F1EFE8", color: "#5F5E5A", label: s };
  return (
    <span
      className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide whitespace-nowrap uppercase antialiased"
      style={{ background: d.bg, color: d.color }}
    >
      {d.label}
    </span>
  );
}

// ── DeptBadge ────────────────────────────────────────────────
export function DeptBadge({ dept }: { dept: string }) {
  const d = dept in DEPT ? DEPT[dept as DeptKey] : null;
  if (!d) return null;
  return (
    <span
      className="inline-block px-2.5 py-1 rounded text-xs font-bold tracking-wide whitespace-nowrap antialiased"
      style={{ background: d.badge.bg, color: d.badge.color }}
    >
      {dept}
    </span>
  );
}

// ── Card ─────────────────────────────────────────────────────
export function Card({ children, className = "", accentLeft, accentTop, style: extraStyle, onClick }: CardProps) {
  const style: React.CSSProperties = { ...extraStyle };
  if (accentLeft) style.borderLeftColor = accentLeft;
  if (accentTop) style.borderTopColor = accentTop;
  return (
    <div
      className={[
        "bg-white border border-[#DDE2EE] p-6 shadow-sm transition-all duration-200",
        accentLeft ? "rounded-r-xl border-l-[4px]" : "rounded-xl",
        accentTop ? "border-t-[4px]" : "",
        onClick ? "cursor-pointer" : "",
        className,
      ].join(" ")}
      style={Object.keys(style).length ? style : undefined}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Inp (ปรับความสูงและขนาดอักษรให้กดง่ายไม่หลุดโฟกัส) ──────────────────────────────────────────────────────
export function Inp({ label, value, onChange, type = "text", readOnly, placeholder, req, note, mono, sm, autoSaveStatus, className, lang }: InpProps) {
  return (
    <div className="mb-4 min-w-0">
      {label && (
        <div className="flex justify-between items-center mb-1.5 select-none">
          <span className="text-xs text-[#5A617A] font-bold tracking-wide">
            {req && <span className="text-[#E24B4A]">* </span>}
            {label}
          </span>
          {autoSaveStatus != null
            ? <AutosaveTag status={autoSaveStatus} />
            : note && <span className="text-[11px] text-[#9BA3BA] font-medium">{note}</span>}
        </div>
      )}
      <input
        type={type}
        value={value ?? ""}
        readOnly={readOnly}
        placeholder={placeholder ?? ""}
        onChange={e => onChange?.(e.target.value)}
        onWheel={type === 'number' ? (e => e.currentTarget.blur()) : undefined}
        onKeyDown={type === 'number' ? (e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }) : undefined}
        lang={lang}
        style={type === 'date' || type === 'time' || type === 'datetime-local' ? { colorScheme: 'light' } : undefined}
        className={[
          "w-full min-w-0 border border-[#DDE2EE] rounded-xl outline-none box-border transition-all duration-150 focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/10",
          sm ? "h-11 px-3 text-xs" : (type === 'date' || type === 'time' || type === 'datetime-local') ? "h-12 px-2.5 text-sm font-medium" : "h-12 px-4 text-sm font-medium",
          mono ? " " : "font-sans",
          readOnly ? "bg-slate-50 text-[#9BA3BA] cursor-not-allowed border-dashed" : "bg-white text-[#0E1117]",
          type === 'date' ? "max-w-full min-w-[100px] inline-block appearance-none" : "",
          className,
        ].join(" ")}
      />
    </div>
  );
}

// ── TimePicker (24-hour single-box dropdown) ─────────────────
interface TimePickerProps {
  label?: string
  value: string
  onChange: (v: string) => void
  req?: boolean
  readOnly?: boolean
}

export function TimePicker({ label, value, onChange, req, readOnly }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [h, m] = value ? value.split(':') : ['00', '00']
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function setHour(newH: string) { onChange(`${newH}:${m}`) }
  function setMinute(newM: string) { onChange(`${h}:${newM}`) }

  return (
    <div className="mb-3 relative" ref={ref}>
      {label && (
        <div className="text-xs text-[#5A617A] font-medium mb-1">
          {req && <span className="text-[#E24B4A]">* </span>}{label}
        </div>
      )}
      <button
        type="button"
        onClick={() => { if (!readOnly) setOpen(o => !o) }}
        className={[
          "w-full box-border text-lg font-bold px-3 py-[9px] rounded-lg outline-none border-[1.5px] text-left",
          readOnly ? "bg-slate-50 text-[#9BA3BA] cursor-not-allowed border-dashed border-[#DDE2EE]" : "bg-white cursor-pointer",
        ].join(" ")}
        style={!readOnly ? { borderColor: open ? '#185FA5' : '#DDE2EE' } : undefined}
      >
        {value ? `${value} น.` : '--:--'}
      </button>
      {open && !readOnly && (
        <div className="absolute z-50 mt-1 left-0 bg-white border border-[#DDE2EE] rounded-xl shadow-lg flex"
          style={{ maxHeight: '220px' }}>
          <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
            {hours.map(hh => (
              <button key={hh} type="button" onClick={() => setHour(hh)}
                className="block w-16 px-3 py-2 text-center text-sm cursor-pointer border-none"
                style={{
                  background: h === hh ? '#185FA5' : 'transparent',
                  color: h === hh ? '#fff' : '#0E1117',
                  fontWeight: h === hh ? 700 : 400,
                }}>
                {hh}
              </button>
            ))}
          </div>
          <div className="overflow-y-auto border-l border-[#F4F5F7]" style={{ maxHeight: '220px' }}>
            {minutes.map(mm => (
              <button key={mm} type="button" onClick={() => setMinute(mm)}
                className="block w-16 px-3 py-2 text-center text-sm cursor-pointer border-none"
                style={{
                  background: m === mm ? '#185FA5' : 'transparent',
                  color: m === mm ? '#fff' : '#0E1117',
                  fontWeight: m === mm ? 700 : 400,
                }}>
                {mm}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── DateTimePicker (date + 24h time, stores/receives UTC ISO) ─
interface DateTimePickerProps {
  label?: string
  value: string
  onChange: (v: string) => void
  req?: boolean
}

export function DateTimePicker({ label, value, onChange, req }: DateTimePickerProps) {
  const thaiDateTime = value ? toThaiDateTimeInputValue(value) : ''
  const [datePart, timePart] = thaiDateTime ? thaiDateTime.split('T') : ['', '']

  function setDatePart(newDate: string) {
    const combined = `${newDate}T${timePart || '00:00'}`
    onChange(fromThaiInputToUTC(combined))
  }

  function setTimePart(newTime: string) {
    const combined = `${datePart || new Date().toISOString().slice(0, 10)}T${newTime}`
    onChange(fromThaiInputToUTC(combined))
  }

  return (
    <div className="mb-3">
      {label && (
        <div className="text-xs text-[#5A617A] font-medium mb-1">
          {req && <span className="text-[#E24B4A]">* </span>}{label}
        </div>
      )}
      <div className="flex gap-2 items-start">
        <input
          type="date"
          value={datePart}
          onChange={e => setDatePart(e.target.value)}
          className="flex-1 box-border text-lg font-bold px-3 py-[9px] rounded-lg bg-white outline-none border-[1.5px] border-[#DDE2EE] focus:border-[#185FA5] text-slate-800"
        />
        <div className="flex-1 [&>div]:mb-0">
          <TimePicker value={timePart || '00:00'} onChange={setTimePart} />
        </div>
      </div>
    </div>
  )
}

// ── Sel ──────────────────────────────────────────────────────
export function Sel({ label, value, onChange, opts, req }: SelProps) {
  return (
    <div className="mb-4">
      {label && (
        <div className="text-xs text-[#5A617A] font-bold tracking-wide mb-1.5 select-none">
          {req && <span className="text-[#E24B4A]">* </span>}
          {label}
        </div>
      )}
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={e => onChange?.(e.target.value)}
          className="w-full h-12 px-4 text-sm font-medium border border-[#DDE2EE] rounded-xl bg-white text-[#0E1117] outline-none box-border appearance-none focus:border-[#185FA5]"
        >
          {opts.map(o => {
            const val = typeof o === "string" ? o : o.v;
            const lbl = typeof o === "string" ? o : o.l;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9BA3BA] pointer-events-none text-xs">▼</span>
      </div>
    </div>
  );
}

// ── Combo ────────────────────────────────────────────────────
export function Combo({ label, value, onChange, opts = [], req, placeholder, mono, onAddNew }: ComboProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!open) setQ(""); }, [open]);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = opts.filter(o => {
    const lbl = (typeof o === "string" ? o : (o.l ?? "")).toLowerCase();
    return !q || lbl.includes(q.toLowerCase());
  });
  const showAddNew = !!q && !opts.some(o =>
    (typeof o === "string" ? o : (o.l ?? "")).toLowerCase() === q.toLowerCase()
  );

  return (
    <div className="mb-4 relative" ref={ref}>
      {label && (
        <div className="text-xs text-[#5A617A] font-bold tracking-wide mb-1.5 select-none">
          {req && <span className="text-[#E24B4A]">* </span>}
          {label}
        </div>
      )}
      <div className="relative">
        <input
          value={open ? q : value ?? ""}
          onChange={e => { setQ(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQ(""); }}
          placeholder={placeholder ?? "Type or select..."}
          className={[
            "w-full h-12 px-4 pr-10 text-sm font-medium border rounded-xl bg-white text-[#0E1117] outline-none box-border transition-all",
            open ? "border-[#185FA5] ring-2 ring-[#185FA5]/10" : "border-[#DDE2EE]",
            mono ? " " : "font-sans",
          ].join(" ")}
        />
        <span
          onClick={() => setOpen(v => !v)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer text-[#9BA3BA] text-xs select-none p-1"
        >
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && (
        <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-[#DDE2EE] rounded-xl shadow-xl max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 && !showAddNew && (
            <div className="px-4 py-3 text-xs text-[#9BA3BA]">No results found</div>
          )}
          {filtered.map((o, i) => {
            const lbl = typeof o === "string" ? o : (o.l ?? "");
            const val = typeof o === "string" ? o : (o.v ?? "");
            const active = value === val;
            return (
              <div key={i}
                onMouseDown={e => { e.preventDefault(); onChange?.(val); setOpen(false); }}
                className={[
                  "px-4 py-2.5 text-sm cursor-pointer transition-colors",
                  mono ? " " : "font-sans",
                  active
                    ? "bg-[#E6F1FB] text-[#185FA5] font-bold"
                    : "bg-white text-[#0E1117] hover:bg-slate-50",
                ].join(" ")}
              >
                {lbl}
              </div>
            );
          })}
          {showAddNew && (
            <div
              onMouseDown={e => { e.preventDefault(); (onAddNew ?? onChange)?.(q); setOpen(false); }}
              className="px-4 py-2.5 text-sm cursor-pointer text-[#185FA5] border-t border-[#DDE2EE] bg-slate-50 font-bold hover:bg-[#E6F1FB]"
            >
              + Add &ldquo;{q}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ComboCell (สำหรับวางในตาราง) ────────────────────────────────────────────────
export function ComboCell({ value, onChange, opts = [], placeholder }: ComboCellProps) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border-[0.5px] border-[#DDE2EE] rounded-md bg-white box-border px-1.5 py-[5px] outline-none text-[11px] cursor-pointer"
    >
      <option value="">{placeholder || "—"}</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Btn (ถอด Inline Style ยุ่งเหยิงออก ย้ายเข้าหา Tailwind สะอาดตากว่า) ──────────────────────────────────────────────────────
export function Btn({ label, onClick, color = "#185FA5", outline, disabled, full, sm, danger, icon }: BtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl font-bold border transition-all duration-150 active:scale-98 select-none whitespace-nowrap",
        sm ? "h-10 px-4 text-xs" : "h-12 px-6 text-sm",
        full ? "w-full" : "",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
        danger
          ? "bg-[#E24B4A] text-white border-[#E24B4A] hover:bg-[#c93b3a]"
          : outline
            ? "bg-transparent hover:bg-slate-50"
            : "text-white hover:opacity-90",
      ].join(" ")}
      style={!danger && !disabled && !outline ? { background: color, borderColor: color } : outline ? { color: color, borderColor: color } : undefined}
    >
      {icon && <span className="text-base flex items-center">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

// ── Toggle (ปุ่มเลือกผ่านขยายใหญ่สะใจ ไม่กดพลาดแน่นอน) ───────────────────────────────────────────────────
export function Toggle({ opts, value, onChange }: ToggleProps) {
  return (
    <div className="flex gap-2 w-full font-sans">
      {opts.map(o => {
        const active = value === o;
        const isPass = o === "Yes" || o === "Pass";
        const isFail = o === "No" || o === "Fail";

        const activeCol = isPass ? "#27500A" : isFail ? "#791F1F" : "#26215C";
        const activeBg = isPass ? "#EAF3DE" : isFail ? "#FCEBEB" : "#EEEDFE";

        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className="flex-1 min-h-[52px] py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-95"
            style={{
              border: `1.5px solid ${active ? activeCol : "#DDE2EE"}`,
              background: active ? activeBg : "#F4F5F7",
              color: active ? activeCol : "#737D9C",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ── SectionLabel ─────────────────────────────────────────────
export function SectionLabel({ children, action }: SectionLabelProps) {
  return (
    <div className="flex justify-between items-center mb-3 select-none">
      <div className="text-xs font-bold text-[#8A94AD] tracking-wider uppercase font-sans">{children}</div>
      {action}
    </div>
  );
}

// ── DowLogo ──────────────────────────────────────────────────
export function DowLogo({ size = 48 }: DowLogoProps) {
  return (
    <svg width={size * 1.8} height={size} viewBox="0 0 90 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="select-none">
      <polygon points="45,2 88,25 45,48 2,25" fill="#CC0000" />
      <text x="45" y="32" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="900" fontFamily="Arial, sans-serif">DOW</text>
    </svg>
  );
}

// ── Navbar (เวอร์ชันสมบูรณ์แบบแก้ฟอนต์ Roboto คมกริบ สไตล์สากล) ───────────────────────────────────────────────────
export function Navbar({ role, roles = [], onSwitchRole, onLogout, userName, currentUser }: NavbarProps) {
  const displayName = userName ?? currentUser;
  const now = useClock();
  const rm = (role in ROLE_META ? ROLE_META[role as RoleKey] : null) ?? { label: role, color: "#5A617A" };
  const multiRole = roles.length > 1;

  return (
    <header className="bg-[#0F2347] h-14 flex items-center px-4 sticky top-0 z-50 justify-between shadow-md border-b border-white/10 select-none font-sans">

      {/* ฝั่งซ้าย: โลโก้ + แบรนด์ */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 transition-transform hover:scale-105 duration-200">
          <DowLogo size={26} />
        </div>
        <span className="text-[13px] sm:text-sm font-bold text-white tracking-wide truncate">
          Packaging <span className="text-[#EF9F27]">Management System</span>
        </span>
      </div>

      {/* ฝั่งขวา: Actions + ข้อมูลเวลาผู้ใช้ */}
      <div className="flex items-center gap-3.5 min-w-0">
        {/* แถบสลับสิทธิ์เฉพาะกลุ่มผู้มีหลาย Role */}
        {multiRole && (
          <div className="hidden md:flex gap-1 bg-white/[0.05] rounded-full p-1 border border-white/10">
            {roles.map(r => {
              const m = (r in ROLE_META ? ROLE_META[r as RoleKey] : null) ?? { label: r, color: "#9BA3BA" };
              const active = role === r;
              return (
                <button
                  key={r}
                  onClick={() => onSwitchRole?.(r)}
                  className={[
                    "px-3.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all active:scale-95 whitespace-nowrap border",
                    active
                      ? "bg-white text-[#0F2347] border-white shadow-sm"
                      : "bg-transparent text-white/70 border-transparent hover:text-white",
                  ].join(" ")}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        )}

        {!multiRole && (
          <div className="hidden sm:block border border-white/20 bg-white/[0.04] rounded-full px-3.5 py-1 text-xs font-bold text-white/90">
            {rm.label}
          </div>
        )}

        {/* 🕒 ส่วนนาฬิกา Real-time บังคับเป็นฟอนต์สไตล์คอมแพ็คสากล (ถอดแบบตามที่ขอ) */}
        <div className="flex flex-col items-end text-right border-r border-white/15 pr-3.5">
          <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider leading-none">
            {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase()}
          </div>
          <div className="text-sm font-bold text-white tracking-wide leading-none mt-1.5 font-sans antialiased">
            {now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </div>
        </div>

        {/* ข้อมูลโปรไฟล์ผู้ใช้จำลอง */}
        {displayName && (
          <div className="hidden lg:flex items-center gap-2 bg-white/[0.05] border border-white/10 rounded-full pl-1 pr-3 py-1 min-h-[28px]">
            <div className="w-5 h-5 rounded-full bg-[#EF9F27] flex items-center justify-center font-black text-slate-950 text-[10px]">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-white/90 max-w-[100px] truncate">{displayName}</span>
          </div>
        )}

        <button
          onClick={onLogout ?? undefined}
          className="bg-[#CC0000] hover:bg-[#b30000] border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer text-white whitespace-nowrap transition-colors active:scale-95"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

// ── useAutosave ──────────────────────────────────────────────
export function useAutosave<T>(value: T, onSave?: (value: T) => void): "saving" | "saved" | null {
  const [status, setStatus] = useState<"saving" | "saved" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === undefined || value === null) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onSave?.(value);
      setStatus("saved");
      setTimeout(() => setStatus(null), 2000);
    }, 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  return status;
}

// ── AutosaveTag ──────────────────────────────────────────────
export function AutosaveTag({ status }: AutosaveTagProps) {
  if (!status) return null;
  return (
    <span className={[
      "text-xs font-bold inline-flex items-center gap-1 font-sans",
      status === "saved" ? "text-[#27500A]" : "text-[#854F0B]",
    ].join(" ")}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
      {status === "saving" ? "Saving..." : "Saved"}
    </span>
  );
}

// ── ProgressBar ──────────────────────────────────────────────
export function ProgressBar({ done, total, color }: ProgressBarProps) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="font-sans">
      <div className="flex justify-between text-xs font-bold text-[#737D9C] mb-1.5">
        <span>Pallet progress</span>
        <span className="text-[#0E1117]  ">{done} / {total} done</span>
      </div>
      <div className="h-2 bg-[#DDE2EE] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── LotStepBar (ขยายวงกลมให้เห็นชัดเจน จิ้มง่ายไล่ตามสเต็ปโรงงาน) ───────────────────────────────────────────────
export function LotStepBar({ pkStep, dc, planned_pallets, sessions }: LotStepBarProps) {
  const STEPS = [
    { icon: <Calendar size={16} />, l: "Date" },
    { icon: <Scale size={16} />, l: "Scale" },
    { icon: <ClipboardList size={16} />, l: "Pre-check" },
    { icon: <PackageOpen size={16} />, l: "Drumming" },
    { icon: <Package size={16} />, l: "Post-check" },
    { icon: <ClipboardCheck size={16} />, l: "Confirm" },
    { icon: <CheckCircle2 size={16} />, l: "Submit" },
  ];
  const progressPct = pkStep <= 0 ? 0 : Math.min(100, (pkStep / (STEPS.length - 1)) * 100);

  return (
    <div className="bg-white border border-[#DDE2EE] rounded-xl p-5 mb-4 font-sans">
      <div className="text-xs font-bold text-[#8A94AD] mb-3.5 uppercase tracking-wider select-none">Packer steps</div>
      <div className="flex items-start relative select-none">
        <div className="absolute left-4 right-4 top-4 h-0.5 bg-[#DDE2EE] z-0" />
        <div
          className="absolute left-4 top-4 h-0.5 z-0 transition-[width] duration-500 ease-in-out"
          style={{ width: `${progressPct}%`, background: dc }}
        />
        {STEPS.map((s, i) => {
          const done = i < pkStep;
          const active = i === pkStep;
          return (
            <div key={i} className="flex-1 flex flex-col items-center z-[1]">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300"
                style={{
                  background: done ? dc : active ? "#fff" : "#F4F5F7",
                  borderColor: done || active ? dc : "#DDE2EE",
                  color: done ? "#fff" : active ? dc : "#737D9C",
                  boxShadow: active ? `0 0 0 4px ${dc}15` : undefined,
                }}
              >
                {done ? "✓" : s.icon}
              </div>
              <div
                className="text-[10px] mt-1.5 text-center transition-colors font-bold whitespace-nowrap"
                style={{ color: active ? dc : done ? dc : "#8A94AD" }}
              >
                {s.l}
              </div>
            </div>
          );
        })}
      </div>
      {pkStep === 3 && planned_pallets > 0 && (
        <div className="mt-4 pt-3.5 border-t border-[#DDE2EE]">
          <ProgressBar done={sessions?.length ?? 0} total={planned_pallets} color={dc} />
        </div>
      )}
    </div>
  );
}

// ── PauseControls (ปุ่มแจ้งหยุดปัญหาหน้างาน ขยายใหญ่เด่นสะดุดตา) ────────────────────────────────────────────
export function PauseControls({ onPause, pre, onShiftEndClick }: PauseControlsProps) {
  const [pending, setPending] = useState<string | null>(null);

  interface PauseOption {
    k: string; icon: ReactNode; label: string; sub: string;
    bg: string; color: string; border: string; confirmBg: string;
  }

  const OPTS: PauseOption[] = ([
    { k: "paused_shift_end", icon: <PauseCircle size={16} />, label: "Shift End", sub: "save · no log needed", bg: "#FEF3C7", color: "#633806", border: "#EF9F27", confirmBg: "#EF9F27" },
    { k: "paused_issue", icon: <AlertTriangle size={16} />, label: "Issue / Problem", sub: "log required", bg: "#FCEBEB", color: "#791F1F", border: "#E24B4A", confirmBg: "#E24B4A" },
    { k: "paused_emergency", icon: <AlertOctagon size={16} />, label: "Emergency", sub: "leak/block . log required", bg: "#FEF2F2", color: "#991B1B", border: "#991B1B", confirmBg: "#991B1B" },
  ] as PauseOption[]).filter(o => pre ? o.k !== "paused_emergency" : true);

  const pendingOpt = OPTS.find(x => x.k === pending);

  return (
    <div className="mb-4 font-sans">
      <div className="text-xs font-bold text-[#8A94AD] mb-2.5 tracking-wider uppercase select-none">
        Pause controls{pre ? " - issue only" : ""}
      </div>
      <div className={`grid gap-3 ${OPTS.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {OPTS.map(o => (
          <button key={o.k}
            onClick={() => o.k === 'paused_shift_end' && onShiftEndClick
              ? onShiftEndClick()
              : setPending(p => p === o.k ? null : o.k)
            }
            className="px-3 py-4.5 rounded-xl text-xs font-bold cursor-pointer text-center leading-normal transition-all duration-150 border-2 active:scale-98"
            style={{
              background: pending === o.k ? o.border : o.bg,
              color: pending === o.k ? "#fff" : o.color,
              borderColor: pending === o.k ? o.border : o.border + "60",
            }}
          >
            <div className="text-xl mb-1 flex items-center justify-center">{o.icon}</div>
            <div className="font-bold tracking-wide">{o.label}</div>
            <div className="text-[10px] font-medium mt-1 opacity-80 leading-tight">
              {pending === o.k ? "กดยกเลิกเพื่อปิด" : o.sub}
            </div>
          </button>
        ))}
      </div>

      {pending && pendingOpt && (
        <div
          className="mt-3 rounded-xl p-4 flex items-center gap-3 border-2 animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ background: pendingOpt.bg, borderColor: pendingOpt.border }}
        >
          <div className="flex-1">
            <div className="text-sm font-bold mb-0.5" style={{ color: pendingOpt.color }}>
              ยืนยันการบันทึกสถานะ: {pendingOpt.label}?
            </div>
            <div className="text-xs font-medium opacity-85" style={{ color: pendingOpt.color }}>
              กดปุ่ม &ldquo;ยืนยัน&rdquo; เพื่อดำเนินการต่อ หรือกด &ldquo;ยกเลิก&rdquo; หากเลือกผิด
            </div>
          </div>
          <button
            onClick={() => setPending(null)}
            className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer bg-white border transition-colors hover:bg-slate-50"
            style={{ color: pendingOpt.color, borderColor: pendingOpt.border }}
          >
            ยกเลิก
          </button>
          <button
            onClick={() => { setPending(null); onPause(pendingOpt.k); }}
            className="px-4 py-2 rounded-lg text-xs font-bold cursor-pointer text-white border-none transition-opacity hover:opacity-90"
            style={{ background: pendingOpt.confirmBg }}
          >
            ยืนยัน
          </button>
        </div>
      )}
    </div>
  );
}

// ── PausedCard ───────────────────────────────────────────────
export function PausedCard({ pauseType, onResume, currentUser, initialStartTime }: PausedCardProps) {
  const [dtR, setDtR] = useState("");
  const [dtT, setDtT] = useState("Equipment");
  const [dtS, setDtS] = useState(() => initialStartTime || new Date().toISOString());
  const [dtE, setDtE] = useState('');

  const isShiftEnd = pauseType === "paused_shift_end";
  const isEmergency = pauseType === "paused_emergency";
  const needsLog = !isShiftEnd;
  const ok = isShiftEnd ? true : !!(dtS && dtE && dtR);

  // กำหนดโครงสร้าง Mapping ให้ TypeScript สบายใจ
  const metadata: Record<
    "paused_shift_end" | "paused_issue" | "paused_emergency",
    { icon: React.ReactNode; title: string; sub: string; btn: string; btnC: string }
  > = {
    paused_shift_end: {
      icon: <PauseCircle size={18} className="text-[#633806]" />,
      title: "Shift Ended - new operator resuming",
      sub: "กรอกชื่อพนักงานกะใหม่เพื่อมอบหมายงานต่อ ระบบจะบันทึกรายชื่อลงในประวัติการปฏิบัติงาน",
      btn: "▶ Resume as new operator",
      btnC: "#27500A",
    },
    paused_issue: {
      icon: <AlertTriangle size={18} className="text-[#501313]" />,
      title: "Paused: Issue / Problem Log",
      sub: "กรุณากรอกข้อมูลบันทึกเวลาหยุดงาน (Downtime log) ก่อนกลับเข้าสู่สภาวะทำงานปกติ",
      btn: "✓ Close log & Resume Operation",
      btnC: "#0F6E56",
    },
    paused_emergency: {
      icon: <AlertOctagon size={18} className="text-[#501313]" />,
      title: "Paused: Emergency",
      sub: "กรุณาระบุรายละเอียดข้อผิดพลาดของระบบและประสานงานแก้ไขให้เรียบร้อยก่อนกดยืนยัน",
      btn: "✓ Close log & Resume Operation",
      btnC: "#0F6E56",
    },
  };

  // ดึงข้อมูลมาใช้งานผ่านคีย์อย่างปลอดภัย
  const m = metadata[pauseType];

  return (
    <div
      className="rounded-xl p-5 mb-4 border-2 font-sans shadow-sm"
      style={{
        background: isShiftEnd ? "#FEF3C7" : "#FCEBEB",
        borderColor: isShiftEnd ? "#EF9F27" : "#E24B4A",
      }}
    >
      <div className="text-base font-bold mb-1.5 flex items-center gap-2" style={{ color: isShiftEnd ? "#633806" : "#501313" }}>
        <span>{m.icon}</span> <span>{m.title}</span>
      </div>
      <div className="text-xs font-medium mb-4 opacity-90 leading-relaxed" style={{ color: isShiftEnd ? "#854F0B" : "#791F1F" }}>
        {m.sub}
      </div>

      {isShiftEnd && (
        <div className="space-y-3 mb-4">
          <div className="bg-white/60 border border-[#EF9F27]/20 rounded-xl px-4 py-3 text-xs text-[#5A617A]">
            <div className="font-bold mb-0.5">พนักงานปฏิบัติงานก่อนหน้า (Previous operator)</div>
            <div className="  text-[#0E1117] font-bold mt-1">{currentUser}</div>
          </div>
        </div>
      )}

      {needsLog && (
        <div className="space-y-3 mb-4">
          <DateTimePicker label="Downtime Start" value={dtS} onChange={setDtS} req />
          <DateTimePicker label="Downtime End" value={dtE} onChange={setDtE} req />
          {!isEmergency && (
            <div className="mb-3">
              <div className="text-xs font-medium text-gray-600 mb-2">
                ประเภทปัญหา <span className="text-red-500">*</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  { k: 'Equipment', l: 'Equipment — อุปกรณ์ขัดข้อง' },
                  { k: 'Chemical Leak', l: 'Chemical Leak — สารเคมีรั่วไหล' },
                  { k: 'Pipe Block', l: 'Pipe Block — ท่ออุดตัน' },
                  { k: 'Other', l: 'Other — อื่นๆ' },
                ].map(opt => (
                  <button key={opt.k}
                    onClick={() => setDtT(opt.k)}
                    className="flex items-center gap-3 p-3 rounded-xl text-left border-2 cursor-pointer min-h-[48px]"
                    style={{
                      borderColor: dtT === opt.k ? '#EF9F27' : '#DDE2EE',
                      background: dtT === opt.k ? '#FEF3C7' : '#F4F5F7',
                    }}>
                    <div className="w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center"
                      style={{
                        borderColor: dtT === opt.k ? '#EF9F27' : '#9BA3BA',
                        background: dtT === opt.k ? '#EF9F27' : '#fff',
                      }}>
                      {dtT === opt.k && <span className="text-white text-[11px] font-bold">✓</span>}
                    </div>
                    <span className="text-sm" style={{
                      color: dtT === opt.k ? '#633806' : '#0E1117',
                      fontWeight: dtT === opt.k ? 600 : 400,
                    }}>{opt.l}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Inp label="เหตุผล / รายละเอียด (Reason)" value={dtR} onChange={setDtR} placeholder="Describe the issue in detail..." />
        </div>
      )}

      <Btn
        label={m.btn}
        color={m.btnC}
        full
        disabled={!ok}
        onClick={() => onResume({
          start: isShiftEnd ? '' : (dtS || ''),
          end: isShiftEnd ? '' : (dtE || ''),
          type: isShiftEnd ? '' : (isEmergency ? "emergency" : "issue"),
          reason: isShiftEnd ? '' : (isEmergency ? dtR : `[${dtT}] ${dtR}`),
          newOperator: isShiftEnd ? currentUser : null,
        })}
      />
    </div>
  );
}

// ── ConfirmModal ───────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  confirmColor?: string
  confirmDisabled?: boolean
  icon?: React.ReactNode
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  onDismiss?: () => void
}

export function ConfirmModal({
  open, title, message, confirmLabel, cancelLabel,
  confirmColor = "#E24B4A", confirmDisabled, icon, onConfirm, onCancel, onDismiss,
}: ConfirmModalProps) {
  if (!open) return null
  const dismiss = onDismiss ?? onCancel
  return (
    <div
      className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="bg-white rounded-2xl p-8 w-full max-w-[400px] shadow-2xl border border-gray-100 flex flex-col items-center text-center relative"
        onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all cursor-pointer border-none bg-transparent"
        >
          <span className="text-[26px] font-light leading-none relative -top-[2px]">&times;</span>
        </button>

        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
          style={{ background: confirmColor + "15", border: `4px solid ${confirmColor}25` }}>
          <span style={{ color: confirmColor }}>
            {icon || <Trash2 size={44} />}
          </span>
        </div>

        <h3 className="text-[22px] font-bold text-[#0F2347] mb-2 tracking-tight">
          {title}
        </h3>

        <p className="text-[14px] text-[#5A617A] leading-relaxed mb-6 max-w-[320px] break-words">
          {message}
        </p>

        <div className="grid grid-cols-2 gap-3 w-full mt-2">
          <Btn
            label={cancelLabel || "Cancel"}
            color="#9BA3BA"
            outline
            onClick={onCancel}
          />
          <Btn
            label={confirmLabel}
            danger={confirmColor === "#E24B4A"}
            color={confirmColor !== "#E24B4A" ? confirmColor : undefined}
            full
            disabled={confirmDisabled}
            onClick={onConfirm}
          />
        </div>
      </div>
    </div>
  )
}

// ── Re-export shared UI sub-components ───────────────────────
export { PalletRow } from './PalletRow'