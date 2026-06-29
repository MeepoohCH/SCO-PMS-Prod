"use client";

import { useState, useRef, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ArrowLeft, ArrowDown, ArrowUp, AlertTriangle, CheckCircle2, Eye, PencilLine } from "lucide-react";
import { Btn } from "../components/shared";
import { LotForm } from "../components/LotForm";
import type { LotPlan } from "../components/LotForm";
import { formatDate, cleanDate } from "@/lib/utils";
import { flattenLot } from "@/lib/fetchLots";

// ── Types ──────────────────────────────────────────────────────

interface User {
  username: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
}

interface DB {
  users: User[];
}

interface LoginScreenProps {
  onLogin: (roles: string[], fullName: string, user: User) => void;
  db?: DB;
}

type ForgotStep = "email" | "otp" | "newpw" | null;

interface Lot {
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
  [key: string]: unknown;
}

interface DowntimeLogEntry {
  id: number
  downtime_type: string
  start_time?: string
  end_time?: string
  duration_min?: number
  reason?: string
  logger?: { full_name: string }
}

const DT_LABEL: Record<string, string> = {
  emergency: 'Emergency',
  issue:     'Issue',
}

// ── Constants ──────────────────────────────────────────────────

const INIT_DB: DB = {
  users: [
    { username: "admin", full_name: "Admin User", roles: ["admin"], is_active: true },
    { username: "sl_somchai", full_name: "Somchai Wongso", roles: ["sl"], is_active: true },
    { username: "pl_mana", full_name: "Mana Pakdee", roles: ["pl"], is_active: true },
    { username: "pk_somying", full_name: "Somying Boonma", roles: ["packer"], is_active: true },
    { username: "pk_pl_joe", full_name: "Joe Packer-PL", roles: ["packer", "pl"], is_active: true },
    { username: "admin_nat", full_name: "Nat Admin-SL", roles: ["admin", "sl"], is_active: true },
  ],
};

const DEPT: Record<string, { label: string; badge: { bg: string; color: string }; accent: string }> = {
  PUF: { label: "PUF Drumming", badge: { bg: "#EEEDFE", color: "#26215C" }, accent: "#534AB7" },
  PU: { label: "PU Drumming", badge: { bg: "#E6F1FB", color: "#042C53" }, accent: "#185FA5" },
  IBC: { label: "IBC Record", badge: { bg: "#FCEBEB", color: "#501313" }, accent: "#E24B4A" },
  Latex: { label: "Latex Drumming", badge: { bg: "#E1F5EE", color: "#04342C" }, accent: "#1D9E75" },
};

const STATUS: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: "#F1EFE8", color: "#5F5E5A", label: "Draft" },
  waiting: { bg: "#FEF3C7", color: "#633806", label: "Waiting" },
  in_progress: { bg: "#E6F1FB", color: "#042C53", label: "In progress" },
  submitted: { bg: "#EEEDFE", color: "#26215C", label: "Submitted" },
  head_approved: { bg: "#E1F5EE", color: "#04342C", label: "PL Approved" },
  completed: { bg: "#EAF3DE", color: "#173404", label: "Complete" },
  rejected: { bg: "#FCEBEB", color: "#501313", label: "Rejected" },
};

// ── Shared UI helpers ──────────────────────────────────────────

function DowLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size * 1.8}
      height={size}
      viewBox="0 0 90 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon points="45,2 88,25 45,48 2,25" fill="#CC0000" />
      <text
        x="45"
        y="32"
        textAnchor="middle"
        fill="#fff"
        fontSize="20"
        fontWeight="900"
        fontFamily="Arial,sans-serif"
      >
        DOW
      </text>
    </svg>
  );
}

function Badge({ s }: { s: string }) {
  const cfg = STATUS[s] ?? { bg: "#F1EFE8", color: "#5F5E5A", label: s };
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function DeptBadge({ dept }: { dept: string }) {
  const cfg = DEPT[dept];
  if (!cfg) return null;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap"
      style={{ background: cfg.badge.bg, color: cfg.badge.color }}
    >
      {dept}
    </span>
  );
}


// ── Reusable class strings 🎯 (แก้จุดสลักสีตายตัวตรงนี้ให้เป็นสีกรมท่าเข้ม #193f5e ทั้งหมด) ────────────────

const inputCls =
  "w-full h-12 px-4 text-base border-[1.5px] border-[#DDE2EE] rounded-xl bg-gray-50 outline-none focus:border-[#193f5e] text-[#193f5e] transition-colors";
const labelCls = "block text-sm font-semibold text-[#193f5e] mb-2";
const primaryBtnCls =
  "w-full h-14 rounded-xl text-base font-bold text-white bg-[#CC0000] disabled:bg-gray-200 disabled:text-gray-400 transition-colors cursor-pointer disabled:cursor-default";
const ghostBtnCls =
  "w-full h-12 rounded-xl text-base font-bold text-[#193f5e] bg-white border-[1.5px] border-[#DDE2EE] cursor-pointer";

// ── LoginScreen ────────────────────────────────────────────────

export default function LoginScreen({ onLogin, db }: LoginScreenProps) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState(["", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(120);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwDone, setPwDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startOtpTimer() {
    setOtpTimer(120);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function sendEmail() {
    if (!forgotEmail.includes("@")) return;
    setForgotStep("otp");
    startOtpTimer();
  }

  function handleOtpKey(i: number, v: string) {
    if (v.length > 1) return;
    const next = [...forgotOtp];
    next[i] = v;
    setForgotOtp(next);
    if (v && i < 4)
      (document.getElementById(`otp-${i + 1}`) as HTMLInputElement)?.focus();
  }

  function verifyOtp() {
    if (forgotOtp.join("").length === 5) setForgotStep("newpw");
  }

  function submitNewPw() {
    if (newPw.length >= 8 && newPw === confirmPw) setPwDone(true);
  }

  function resetForgot() {
    setForgotStep(null);
    setForgotEmail("");
    setForgotOtp(["", "", "", "", ""]);
    setNewPw("");
    setConfirmPw("");
    setPwDone(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function doLogin() {
    if (!user || !pass) { setErr("กรุณากรอก Username และ Password"); return; }
    setLoading(true);
    setErr("");
    setTimeout(() => {
      const found = (db?.users ?? INIT_DB.users).find(
        u => u.username === user && u.is_active,
      );
      if (!found) {
        setErr("ไม่พบ Username หรือ Password ไม่ถูกต้อง");
        setLoading(false);
        return;
      }
      onLogin(found.roles, found.full_name, found);
      setLoading(false);
    }, 600);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Navy header ── */}
      <header className="bg-[#0F2347] px-6 pt-10 pb-8">
        <div className="w-full max-w-lg mx-auto text-center">
          <div className="flex justify-center mb-5">
            <DowLogo size={44} />
          </div>
          <p className="text-sm font-semibold text-[#CC0000] mb-1">Welcome to</p>
          <h1 className="text-[22px] font-black text-white leading-tight">
            Packaging Management{" "}
            <span className="text-[#EF9F27]">System</span>
          </h1>
          <p className="mt-3 text-sm text-white/60 leading-relaxed">
            ระบบจัดการบรรจุภัณฑ์แบบครบวงจร สำหรับการติดตามและควบคุมคุณภาพการดำเนินงาน
          </p>

          {/* Feature bullets — shown only on main login */}
          {!forgotStep && (
            <div className="mt-6 space-y-3 text-left">
              {(["วางแผนและจัดการงานบรรจุ", "ตรวจสอบและติดตามสถานะแบบ Real-time", "รายงานและวิเคราะห์ข้อมูล"] as const).map(
                (text, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-white/70">
                        {["M", "R", "A"][i]}
                      </span>
                    </div>
                    <span className="text-sm text-white/75">{text}</span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Form area ── */}
      <main className="flex-1 w-full max-w-lg mx-auto px-6 py-8">

        {/* ── MAIN LOGIN ── */}
        {!forgotStep && (
          <>
            <h2 className="text-2xl font-black text-[#193f5e] mb-1">เข้าสู่ระบบ</h2>
            <p className="text-sm text-gray-500 mb-8">Dow Site Logistics Operation</p>

            <label className={labelCls}>Username</label>
            <div className="mb-5">
              <input
                value={user}
                onChange={e => { setUser(e.target.value); setErr(""); }}
                placeholder="กรอกชื่อผู้ใช้"
                className={inputCls}
                onKeyDown={e => e.key === "Enter" && doLogin()}
              />
            </div>

            <label className={labelCls}>Password</label>
            <div className="mb-5">
              <input
                type="password"
                value={pass}
                onChange={e => { setPass(e.target.value); setErr(""); }}
                placeholder="กรอกรหัสผ่าน"
                className={inputCls}
                onKeyDown={e => e.key === "Enter" && doLogin()}
              />
            </div>

            {err && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 mb-4 text-center">
                {err}
              </div>
            )}

            <button
              onClick={doLogin}
              disabled={!user || !pass || loading}
              className={primaryBtnCls}
            >
              {loading ? "กำลังเข้าระบบ..." : "Sign in"}
            </button>

            {/* <div className="text-center mt-4 mb-4">
              <button
                onClick={() => setForgotStep("email")}
                className="text-sm text-[#193f5e] font-medium underline bg-transparent border-none cursor-pointer"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>  */}

            <p className="text-xs text-gray-400 text-center leading-relaxed mb-5">
              สำหรับพนักงาน: รีเซตรหัสผ่านผ่านอีเมลบริษัท | สำหรับ Contractor: ติดต่อ Admin
            </p>

            <div className="bg-gray-100 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Demo accounts:</p>
              {(
                [
                  ["sl_somchai", "Site Logistics"],
                  ["pl_mana", "Pack Lead"],
                  ["pk_somying", "Packer"],
                  ["pk_pl_joe", "Packer+PL"],
                  ["admin_nat", "Admin+SL"],
                  ["admin", "Admin"],
                ] as [string, string][]
              ).map(([u, r]) => (
                <div key={u} className="flex justify-between py-0.5">
                  <button
                    onClick={() => { setUser(u); setPass("demo1234"); setErr(""); }}
                    className="text-[11px]   text-[#CC0000] bg-transparent border-none cursor-pointer p-0"
                  >
                    {u}
                  </button>
                  <span className="text-[11px] text-gray-400">{r}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── FORGOT: Email step ── */}
        {forgotStep === "email" && !pwDone && (
          <>
            <h2 className="text-2xl font-black text-[#193f5e] mb-2">ลืมรหัสผ่าน</h2>
            <p className="text-sm text-gray-500 mb-8">กรอกอีเมลองค์กรเพื่อรีเซ็ตรหัสผ่าน</p>

            <label className={labelCls}>Email (@dow.com)</label>
            <input
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              placeholder="yourname@dow.com"
              className={`${inputCls} mb-5`}
            />

            <button
              onClick={sendEmail}
              disabled={!forgotEmail.includes("@")}
              className={`${primaryBtnCls} mb-5`}
            >
              Send Email
            </button>

            <div className="bg-red-50 border-[1.5px] border-red-200 rounded-xl p-4 mb-6">
              <p className="text-sm font-bold text-red-800 mb-1">สำหรับ Contractor</p>
              <p className="text-sm text-red-900 leading-relaxed">
                Contractor ไม่สามารถรีเซ็ตรหัสผ่านด้วยตัวเองได้ กรุณาติดต่อ Admin เพื่อรีเซตรหัสผ่าน
              </p>
            </div>

            <button
              onClick={resetForgot}
              className="w-full text-sm text-[#193f5e] font-semibold bg-transparent border-none cursor-pointer text-center"
            >
              ← กลับไปหน้า Sign in
            </button>
          </>
        )}

        {/* ── FORGOT: OTP step ── */}
        {forgotStep === "otp" && (
          <>
            <h2 className="text-2xl font-black text-[#193f5e] mb-2">Code Verification</h2>
            <p className="text-sm text-gray-500 mb-8">Enter OTP sent to {forgotEmail}</p>

            <div className="flex gap-3 mb-2 justify-center">
              {forgotOtp.map((v, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  maxLength={1}
                  value={v}
                  onChange={e => handleOtpKey(i, e.target.value)}
                  className="w-[60px] h-16 text-2xl font-black   text-center border-[1.5px] border-[#DDE2EE] rounded-xl bg-gray-50 text-[#193f5e] outline-none focus:border-[#193f5e]"
                />
              ))}
            </div>

            <p className="text-right text-sm text-gray-500 mb-6">
              {String(Math.floor(otpTimer / 60)).padStart(2, "0")}:
              {String(otpTimer % 60).padStart(2, "0")} mins
            </p>

            <button
              onClick={verifyOtp}
              disabled={forgotOtp.join("").length < 5}
              className={`${primaryBtnCls} mb-3`}
            >
              Verify Code
            </button>

            <button
              onClick={() => { startOtpTimer(); setForgotOtp(["", "", "", "", ""]); }}
              className={`${ghostBtnCls} mb-6`}
            >
              Resend Code
            </button>

            <button
              onClick={resetForgot}
              className="w-full text-sm text-[#193f5e] font-semibold bg-transparent border-none cursor-pointer text-center"
            >
              ← กลับไปหน้า Sign in
            </button>
          </>
        )}

        {/* ── FORGOT: New password step ── */}
        {forgotStep === "newpw" && !pwDone && (
          <>
            <h2 className="text-2xl font-black text-[#193f5e] mb-8">New Credential</h2>

            <label className={labelCls}>New Password</label>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className={`${inputCls} mb-5`}
            />

            <label className={labelCls}>Confirm Password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              className={[
                "w-full h-12 px-4 text-base border-[1.5px] rounded-xl bg-gray-50 text-[#193f5e] outline-none transition-colors mb-2",
                confirmPw && confirmPw !== newPw
                  ? "border-[#CC0000]"
                  : "border-[#DDE2EE]",
              ].join(" ")}
            />
            {confirmPw && confirmPw !== newPw && (
              <p className="text-xs text-[#CC0000] mb-4">รหัสผ่านไม่ตรงกัน</p>
            )}

            <button
              onClick={submitNewPw}
              disabled={newPw.length < 8 || newPw !== confirmPw}
              className={`${primaryBtnCls} mb-3`}
            >
              Submit
            </button>

            <button onClick={resetForgot} className={ghostBtnCls}>
              Cancel
            </button>
          </>
        )}

        {/* ── FORGOT: Success ── */}
        {forgotStep === "newpw" && pwDone && (
          <div className="text-center pt-8">
            <p className="text-5xl font-black text-green-700 mb-4">✓</p>
            <h2 className="text-2xl font-black text-[#193f5e] mb-2">เปลี่ยนรหัสผ่านสำเร็จ</h2>
            <p className="text-sm text-gray-500 mb-8">เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย</p>
            <button onClick={resetForgot} className={primaryBtnCls}>
              กลับไป Sign in
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

// ── SuccessTab ─────────────────────────────────────────────────

interface SuccessTabProps {
  lots: Lot[];
  onEdit?: (lot: Lot) => void;
  onViewProgress?: (lot: Lot) => void;
  isAdmin?: boolean;
}

export function SuccessTab({ lots, onEdit, onViewProgress, isAdmin = false }: SuccessTabProps) {
  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(oneMonthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [deptFilter, setDeptFilter] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "mt_desc">("date_desc");
  const [expanded, setExpanded] = useState<string | number | null>(null);
  const [downtimeMap, setDowntimeMap] = useState<Record<string | number, DowntimeLogEntry[]>>({});

  async function loadDowntime(lotId: string | number) {
    if (downtimeMap[lotId]) return;
    try {
      const res = await fetch(`/api/downtime?production_detail_id=${lotId}`);
      const data = res.ok ? await res.json() : [];
      setDowntimeMap(p => ({ ...p, [lotId]: data }));
    } catch {
      setDowntimeMap(p => ({ ...p, [lotId]: [] }));
    }
  }

  const completedLots = lots.filter(l => l.status === "completed");

  const filtered = completedLots
    .filter(l => {
      const d = l.packing_date ?? "";
      const inRange = (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
      const inDept = deptFilter.length === 0 || deptFilter.includes(l.dept);
      const kw = keyword.toLowerCase();
      const matchKw =
        !kw ||
        (l.product ?? "").toLowerCase().includes(kw) ||
        (l.lot ?? "").toLowerCase().includes(kw) ||
        (l.blender ?? "").toLowerCase().includes(kw) ||
        (l.customer ?? "").toLowerCase().includes(kw);
      return inRange && inDept && matchKw;
    })
    .sort((a, b) => {
      if (sortBy === "date_asc") return (a.packing_date ?? "").localeCompare(b.packing_date ?? "");
      if (sortBy === "mt_desc") return (Number(b.actual_mt) || 0) - (Number(a.actual_mt) || 0);
      return (b.packing_date ?? "").localeCompare(b.packing_date ?? "");
    });

  const totalMT = filtered.reduce((s, l) => s + (parseFloat(String(l.actual_mt)) || 0), 0);
  const depts = ["PUF", "PU", "IBC", "Latex"];

  function toggleDept(d: string) {
    setDeptFilter(p => (p.includes(d) ? p.filter(x => x !== d) : [...p, d]));
  }

  const quickPresets: [string, number][] = [["7d", 7], ["30d", 30], ["90d", 90], ["1y", 365]];

  return (
    <div>
      {/* ── Query bar ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold text-[#193f5e] mb-3">Query + Filter</p>

        {/* Date range */}
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="text-xs font-medium text-gray-500 min-w-[72px]">Date range</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="box-border text-sm font-medium px-2 py-1.5 rounded-lg bg-white outline-none border border-[#DDE2EE] focus:border-[#185FA5] text-slate-800"
            style={{ width: '148px' }}
          />
          <span className="text-xs text-gray-400">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="box-border text-sm font-medium px-2 py-1.5 rounded-lg bg-white outline-none border border-[#DDE2EE] focus:border-[#185FA5] text-slate-800"
            style={{ width: '148px' }}
          />
          <div className="flex gap-1">
            {quickPresets.map(([l, days]) => (
              <button key={l} onClick={() => { setDateFrom(new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)); setDateTo(today); }}
                className="h-8 px-2.5 text-[11px] rounded-full border border-gray-200 bg-gray-100 text-gray-600 cursor-pointer">{l}</button>
            ))}
            <button onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="h-8 px-2.5 text-[11px] rounded-full border border-gray-200 bg-gray-100 text-gray-400 cursor-pointer">All time</button>
          </div>
        </div>

        {/* Keyword */}
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="text-xs font-medium text-gray-500 min-w-[72px]">Search</span>
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="Product · LOT no. · Blender · Customer"
            className="h-9 px-3 text-xs border border-gray-200 rounded-lg w-72 text-[#193f5e]" />
          {keyword && (
            <button onClick={() => setKeyword("")} className="text-[11px] text-gray-400 bg-transparent border-none cursor-pointer">✕ Clear</button>
          )}
        </div>

        {/* Dept filter */}
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="text-xs font-medium text-gray-500 min-w-[72px]">Dept</span>
          <div className="flex gap-1.5">
            {depts.map(d => {
              const active = deptFilter.includes(d);
              const cfg = DEPT[d];
              return (
                <button key={d} onClick={() => toggleDept(d)}
                  className="h-8 px-3 rounded-full text-[11px] border cursor-pointer"
                  style={active
                    ? { background: cfg.badge.bg, color: cfg.badge.color, borderColor: cfg.badge.color, fontWeight: 500 }
                    : { background: "transparent", color: "#9BA3BA", borderColor: "#DDE2EE", fontWeight: 400 }
                  }
                >
                  {d}
                </button>
              );
            })}
            {deptFilter.length > 0 && (
              <button onClick={() => setDeptFilter([])} className="text-[11px] text-gray-400 bg-transparent border-none cursor-pointer">Clear</button>
            )}
          </div>
        </div>

        {/* Sort */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-gray-500 min-w-[72px]">Sort by</span>
          <div className="flex gap-1.5">
            {(
              [
                ["date_desc", "Date", <ArrowDown className="w-3.5 h-3.5" />],
                ["date_asc", "Date", <ArrowUp className="w-3.5 h-3.5" />],
                ["mt_desc", "MT", <ArrowDown className="w-3.5 h-3.5" />],
              ] as [typeof sortBy, string, React.ReactNode][]
            ).map(([v, l, icon]) => {
              const isActive = sortBy === v;
              return (
                <button
                  key={v}
                  onClick={() => setSortBy(v)}
                  className={[
                    "h-8 px-3 rounded-full text-[11px] border cursor-pointer flex items-center gap-1.5 transition-all",
                    isActive
                      ? "bg-[#E6F1FB] text-[#185FA5] border-[#185FA5] font-medium"
                      : "bg-transparent text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-500",
                  ].join(" ")}
                >
                  <span>{l}</span>
                  <span className={isActive ? "text-[#185FA5]" : "text-gray-400"}>
                    {icon}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-4 gap-2.5 mb-4">
        {[
          { l: "Lots found", v: filtered.length, color: "#185FA5" },
          { l: "Total MT", v: `${totalMT.toFixed(2)} MT`, color: "#27500A" },
          { l: "Date range", v: dateFrom && dateTo ? `${formatDate(dateFrom)} - ${formatDate(dateTo)}` : dateFrom ? `From ${formatDate(dateFrom)}` : dateTo ? `To ${formatDate(dateTo)}` : "All time", color: "#534AB7" },
          { l: "Dept filter", v: deptFilter.length === 0 ? "All depts" : deptFilter.join(", "), color: "#92400E" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl px-3 py-3">
            <p className="text-[11px] text-gray-400 mb-1">{s.l}</p>
            <p className="text-sm font-semibold   break-all" style={{ color: s.color }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* ── Lot list ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-14 text-gray-400">
          <p className="text-4xl font-black text-[#1D9E75] mb-2.5">✓</p>
          <p className="text-sm font-medium text-[#193f5e]">No completed lots match</p>
          <p className="text-xs mt-1.5">Try adjusting date range or filters</p>
        </div>
      ) : (
        <>
          {filtered.map((lot, i) => {
            const isExp = expanded === lot.id;
            return (
              <div key={i}
                className="bg-white border-l-[3px] border border-gray-200 rounded-r-xl px-3.5 py-3 mb-2 cursor-pointer"
                style={{ borderLeftColor: "#27500A" }}
                onClick={() => { setExpanded(isExp ? null : lot.id); if (!isExp) loadDowntime(lot.id); }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex gap-1.5 mb-1 flex-wrap">
                      <DeptBadge dept={lot.dept} />
                      <Badge s="completed" />
                      <span className="text-[10px] text-gray-400  ">Date: {formatDate(lot.packing_date)}</span>
                    </div>
                    <p className="text-sm font-black text-[#193f5e]">{lot.product}</p>
                    <p className="text-[11px] text-gray-400  ">{lot.lot} · {lot.blender}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-[#1D9E75]  ">{lot.blender || "—"}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{isExp ? "▲ collapse" : "▼ details"}</p>
                  </div>
                </div>

                {isExp && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2.5 mb-2.5">
                      {[
                        { l: "Customer", v: lot.customer || "—" },
                        { l: "Tank No./Blender No.", v: lot.blender || "—" },
                        { l: "Target MT", v: `${lot.target_mt || "—"} MT` },
                        { l: "LOT no.", v: lot.lot || "—" },
                        { l: "Packing date", v: formatDate(lot.packing_date) },
                        { l: "Site Logistic", v: (lot.sl_name || lot.recorded_by_name) as string || "—" },
                        { l: "Pack Lead", v: (lot.pl_approved_by || lot.pl_name) as string || "—" },
                        { l: "Packer", v: lot.packer_name as string || "—" },
                      ].map((r, ri) => (
                        <div key={ri} className="bg-gray-100 rounded-lg px-2.5 py-2">
                          <p className="text-[10px] text-gray-400 mb-0.5">{r.l}</p>
                          <p className="text-xs font-black text-[#193f5e]  ">{r.v}</p>
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const logs = downtimeMap[lot.id] || [];
                      if (logs.length === 0) return null;
                      const totalMin = logs.reduce((s, l) => s + (l.duration_min || 0), 0);
                      return (
                        <div className="mt-3 pt-3 border-t border-[#DDE2EE]">
                          <div className="text-[11px] font-bold text-[#9BA3BA] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            Downtime Log ({logs.length} events)
                            <span className="text-[11px] font-normal">— รวม {totalMin} min</span>
                          </div>
                          {logs.map((log, li) => {
                            const isEmg = log.downtime_type === 'emergency';
                            return (
                              <div key={li} className="rounded-lg px-3 py-2.5 mb-1.5 border"
                                style={{ background: isEmg ? '#FCEBEB' : '#FEF3C7', borderColor: isEmg ? '#E24B4A' : '#EF9F27' }}>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-[11px] font-bold"
                                    style={{ color: isEmg ? '#791F1F' : '#633806' }}>
                                    {DT_LABEL[log.downtime_type] || log.downtime_type}
                                  </span>
                                  {log.duration_min && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                                      style={{ background: isEmg ? '#E24B4A' : '#EF9F27' }}>
                                      {log.duration_min} min
                                    </span>
                                  )}
                                  <span className="text-[10px] text-[#9BA3BA] ml-auto">
                                    {log.start_time
                                      ? new Date(log.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
                                      : '—'}
                                    {log.end_time
                                      ? ` → ${new Date(log.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
                                      : ' → ยังไม่สิ้นสุด'}
                                  </span>
                                </div>
                                {log.reason && (
                                  <div className="text-[11px] leading-relaxed"
                                    style={{ color: isEmg ? '#501313' : '#854F0B' }}>
                                    {log.reason}
                                  </div>
                                )}
                                {log.logger?.full_name && (
                                  <div className="text-[10px] text-[#9BA3BA] mt-1">บันทึกโดย: {log.logger.full_name}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#DDE2EE]">
                      <span className="text-[11px] text-[#9BA3BA] flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        Completed · Read-only history
                      </span>
                      <div className="flex gap-2">
                        {onViewProgress && (
                          <Btn
                            label={<span className="flex items-center gap-1.5"><Eye size={13} />View Progress</span>}
                            color="#185FA5"
                            outline
                            sm
                            onClick={() => onViewProgress(lot)}
                          />
                        )}
                        {(onEdit || isAdmin) && (
                          <Btn
                            label={<span className="flex items-center gap-1.5"><PencilLine size={13} />Edit</span>}
                            color="#534AB7"
                            sm
                            onClick={() => onEdit && onEdit(lot)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[11px] text-gray-400 text-center py-3">
            Showing {filtered.length} of {completedLots.length} completed lots
          </p>
        </>
      )}
    </div>
  );
}

// ── AdminEditLot ───────────────────────────────────────────────

interface AdminEditLotProps {
  lots: Lot[];
  setLots: React.Dispatch<React.SetStateAction<Lot[]>>;
  editLot: Lot | null;
  setEditLot: (lot: Lot | null) => void;
}

type AdminPlan = LotPlan & Lot;

type AImportItem = { lot: string; blender: string; };

export function AdminEditLot({ lots, setLots, editLot, setEditLot }: AdminEditLotProps) {
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<AdminPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [downtimeLogs, setDowntimeLogs] = useState<DowntimeLogEntry[]>([]);

  useEffect(() => {
    if (!plan?.id) { setDowntimeLogs([]); return; }
    fetch(`/api/downtime?production_detail_id=${plan.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(setDowntimeLogs)
      .catch(() => setDowntimeLogs([]));
  }, [plan?.id]);

  const filtered = (lots ?? []).filter(l => {
    const kw = search.toLowerCase();
    return !kw || (l.product ?? "").toLowerCase().includes(kw) || (l.lot ?? "").toLowerCase().includes(kw) || (l.customer ?? "").toLowerCase().includes(kw);
  });

  function openEdit(lot: Lot) {
    setEditLot(lot);
    const r = lot as Record<string, unknown>;
    const flatLot: AdminPlan = {
      ...lot,
      packing_date:      cleanDate(lot.packing_date),
      date:              cleanDate(r.operation_date as string || lot.packing_date),
      cut_off_date:      cleanDate(r.cut_off_date as string),
      target_mt:         (r.target_amount_mt as number) || lot.target_mt || 0,
      packaging_type:    typeof r.packaging_type === "object"
        ? (r.packaging_type as Record<string, string>)?.name || ""
        : (r.packaging_type as string) || "",
      packaging_type_id: (r.packaging_type as Record<string, unknown>)?.id as number | undefined,
      product_name:      (r.product_name as string)
        || (r.product as Record<string, unknown>)?.product_name as string
        || lot.product || "",
      product_id:        (r.product as Record<string, unknown>)?.id as number | undefined,
      customer:          (r.customer as Record<string, unknown>)?.country_label as string
        || lot.customer || "",
      country_label:     (r.customer as Record<string, unknown>)?.country_label as string
        || (r.country_label as string) || "",
      customer_id:       (r.customer as Record<string, unknown>)?.id as number | undefined,
      blender:           (r.blender as Record<string, unknown>)?.code as string
        || (r.blender as string) || lot.blender || "",
      lot_no:            (r.lot_no as string) || lot.lot || "",
    };
    setPlan(flatLot);
  }





  async function handleSave() {
    if (!plan) return;
    setSaving(true);
    console.log('[AdminEditLot handleSave] plan:', JSON.stringify({
      id: plan.id, dept: plan.dept, status: plan.status,
      lot_no: plan.lot_no, product_name: plan.product_name,
      target_mt: plan.target_mt,
    }));
    try {
      const ibcData = plan.dept === 'IBC' ? {
        operator_name:       plan.operator_name       ?? null,
        quality_status:      plan.quality_status      ?? null,
        ibc_residue_kg:      plan.ibc_residue_kg      ?? null,
        ibc_empty_before_kg: plan.ibc_empty_before_kg ?? null,
        ibc_with_product_kg: plan.ibc_with_product_kg ?? null,
        ibc_product_net_kg:  plan.ibc_product_net_kg  ?? null,
      } : undefined;
      const savePayload = {
        lot_no:            plan.lot_no || plan.lot,
        product_id:        plan.product_id,
        customer_id:       plan.customer_id,
        packaging_type_id: plan.packaging_type_id,
        target_mt:         plan.target_mt,
        packing_date:      plan.date || plan.packing_date,
        cut_off_date:      plan.cut_off_date,
        planned_pallets:   plan.planned_pallets,
        country_label:     plan.country_label,
        draft_note:        plan.draft_note,
        flush_blender:     plan.flush_blender,
        label_no_start:    plan.drum_serial_start,
        label_no_end:      plan.drum_serial_end,
        label_count:       plan.label_count,
        label_pkg_type:    plan.label_pkg_type,
        detail_status:     plan.status,
        ...(ibcData && { ibc_data: ibcData }),
      };
      console.log('[AdminEditLot handleSave] PATCH payload:', JSON.stringify(savePayload));
      const res = await fetch(`/api/lots/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savePayload),
      });
      console.log('[AdminEditLot handleSave] PATCH status:', res.status);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('[AdminEditLot handleSave] PATCH error:', errBody);
      }
      if (res.ok) {
        // Blender lives on production_plans, not production_details — PATCH separately.
        const currentPlanId = (plan as any).plan_id
        if (currentPlanId && plan.blender) {
          let resolvedBlenderId = (plan as any).blender_id as number | undefined
          if (!resolvedBlenderId) {
            const blendersRes = await fetch('/api/blenders')
            const blendersList = blendersRes.ok ? await blendersRes.json() : []
            resolvedBlenderId = blendersList.find(
              (b: { code: string; id: number }) => b.code === plan.blender
            )?.id
          }
          if (resolvedBlenderId) {
            console.log('[AdminEditLot handleSave] PATCH /api/plans/' + currentPlanId + ' blender_id:', resolvedBlenderId)
            await fetch(`/api/plans/${currentPlanId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ blender_id: resolvedBlenderId }),
            }).catch(e => console.error('[AdminEditLot handleSave] update plan blender_id failed:', e))
          } else {
            console.warn('[AdminEditLot handleSave] could not resolve blender_id for:', plan.blender)
          }
        }
        const refetched = await fetch(`/api/lots/${plan.id}`).then(r => r.json());
        const flat = flattenLot(refetched);
        setLots(prev => prev.map(l => l.id === plan.id ? { ...l, ...flat } : l));
        setEditLot(null);
        setPlan(null);
      }
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (editLot && !plan) openEdit(editLot);
  }, [editLot]);

  // ── Edit detail view ──────────────────────────────────────────
  if (editLot && plan) {
    return (
      <div>
        <button
          onClick={() => { setEditLot(null); setPlan(null); }}
          className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex items-center gap-2 mb-2">
          <DeptBadge dept={plan.dept} />
          <Badge s={plan.status} />
          <span className="text-[13px] font-medium text-[#0E1117]">{plan.product_name || plan.product || "Edit Lot"}</span>
          <span className="text-[11px] text-[#9BA3BA]  ml-1">{plan.lot_no || plan.lot}</span>
        </div>
        {(plan as any).plan_created_by && (
          <div className="text-[11px] text-[#9BA3BA] mb-4">
            สร้างแผนโดย SL:
            <span className="font-medium text-[#5A617A] ml-1">{(plan as any).plan_created_by}</span>
          </div>
        )}

        {/* Excel upload — PUF re-import
        {isUploadDept && !xlsxParsing && !xlsxPlans && (
          <label
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleXlsxFileDrop(e.dataTransfer.files?.[0]); }}
            className="block rounded-xl p-7 text-center cursor-pointer mb-3.5 border-[1.5px] border-dashed"
            style={{ borderColor: dc, background: deptCfg.badge.bg }}
          >
            <input type="file" accept=".xlsx,.xls" onChange={handleXlsxFile} className="hidden" />
            <div className="text-[15px] font-medium" style={{ color: dc }}>Re-import .xlsx file</div>
            <div className="text-xs text-[#9BA3BA] mt-1">Upload Production Schedule Excel to update lot data</div>
          </label>
        )}

        {xlsxParsing && (
          <div className="rounded-xl p-8 text-center mb-3.5 border-[1.5px] border-dashed" style={{ borderColor: dc, background: deptCfg.badge.bg }}>
            <div className="text-[13px]" style={{ color: dc }}>Parsing {xlsxFileName}...</div>
          </div>
        )}

        {xlsxPlans && (
          <div className="mb-3.5">
            <div className="bg-[#EAF3DE] border-[0.5px] border-[#639922] rounded-lg px-3.5 py-2.5 mb-3 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#27500A]">
                  <CheckCircle2 size={15} className="text-[#27500A]" />
                  Parsed — {xlsxFileName}
                </div>
                <div className="text-[11px] text-[#27500A] mt-0.5">{xlsxPlans.length} Blenders · เลือก Blender ที่ต้องการ Import</div>
              </div>
              <label className="text-xs text-[#27500A] underline cursor-pointer">
                เปลี่ยนไฟล์<input type="file" accept=".xlsx,.xls" onChange={handleXlsxFile} className="hidden" />
              </label>
            </div>

            {xlsxPlans.map((p, i) => {
              const hasData = Object.values(p.shifts).some(s => s.product_name);
              const checked = !!xlsxSelected[i];
              return (
                <div key={i} className="rounded-xl px-3.5 py-3 mb-2.5 border-[1.5px]"
                  style={{ borderColor: checked ? dc : "#DDE2EE", opacity: hasData ? 1 : 0.5, background: checked ? dc + "08" : "#fff" }}>
                  <div className="flex items-center gap-2.5">
                    <button onClick={() => hasData && setXlsxSelected(prev => ({ ...prev, [i]: !prev[i] }))}
                      className="w-[22px] h-[22px] rounded-md flex items-center justify-center flex-shrink-0 border-2"
                      style={{ borderColor: checked ? dc : "#DDE2EE", background: checked ? dc : "#fff", cursor: hasData ? "pointer" : "default" }}>
                      {checked && <span className="text-white text-[13px] font-black leading-none">v</span>}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-[#0E1117]">{p.blender} <span className="text-xs text-[#9BA3BA]">({p.blender_cap} MT)</span></div>
                      <div className="text-[11px] text-[#9BA3BA]">{Object.values(p.shifts).filter(s => s.product_name).length} shifts</div>
                    </div>
                    {!hasData && <span className="text-[11px] text-[#9BA3BA] bg-[#F4F5F7] rounded-md px-2 py-0.5">ไม่มีข้อมูล</span>}
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-[1fr_2fr] gap-2.5 mt-3">
              <Btn label="Cancel" color="#9BA3BA" outline onClick={() => { setXlsxPlans(null); setXlsxSelected({}); setXlsxFileName(""); }} />
              <Btn label={`Import ${Object.values(xlsxSelected).filter(Boolean).length} Blenders`} color={dc} full
                disabled={!Object.values(xlsxSelected).some(Boolean)} onClick={applyXlsx} />
            </div>
          </div>
        )} */}

        <LotForm
          plan={plan as LotPlan}
          setPlan={setPlan as Dispatch<SetStateAction<LotPlan | null>>}
          mode="admin"
        />

        {downtimeLogs.length > 0 && (() => {
          const totalMin = downtimeLogs.reduce((s, l) => s + (l.duration_min || 0), 0);
          return (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="text-[11px] font-bold text-[#9BA3BA] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Downtime Log ({downtimeLogs.length} events)
                <span className="font-normal">— รวม {totalMin} min</span>
              </div>
              {downtimeLogs.map((log, i) => {
                const isEmg = log.downtime_type === 'emergency';
                return (
                  <div key={i} className="rounded-lg px-3 py-2.5 mb-1.5 border"
                    style={{ background: isEmg ? '#FCEBEB' : '#FEF3C7', borderColor: isEmg ? '#E24B4A' : '#EF9F27' }}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] font-bold" style={{ color: isEmg ? '#791F1F' : '#633806' }}>
                        {DT_LABEL[log.downtime_type] || log.downtime_type}
                      </span>
                      {log.duration_min && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                          style={{ background: isEmg ? '#E24B4A' : '#EF9F27' }}>
                          {log.duration_min} min
                        </span>
                      )}
                      <span className="text-[10px] text-[#9BA3BA] ml-auto">
                        {log.start_time ? new Date(log.start_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        {log.end_time
                          ? ` → ${new Date(log.end_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
                          : ' → ยังไม่สิ้นสุด'}
                      </span>
                    </div>
                    {log.reason && (
                      <div className="text-[11px] leading-relaxed" style={{ color: isEmg ? '#501313' : '#854F0B' }}>
                        {log.reason}
                      </div>
                    )}
                    {log.logger?.full_name && (
                      <div className="text-[10px] text-[#9BA3BA] mt-1">บันทึกโดย: {log.logger.full_name}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Sticky action bar */}
        <div className="sticky bottom-0 bg-[#F5F5F5] pt-2.5 pb-2.5 border-t-[0.5px] border-[#DDE2EE] grid grid-cols-2 gap-2.5">
          <Btn label="Cancel" color="#9BA3BA" outline onClick={() => { setEditLot(null); setPlan(null); }} />
          <Btn label={saving ? "Saving..." : "Save changes"} color="#0F2347" full disabled={saving} onClick={handleSave} />
        </div>
      </div>
    );
  }

  // ── Lot list view ──────────────────────────────────────────────
  return (
    <div>
      <p className="text-base font-black text-[#0E1117] mb-1">Edit Lot</p>
      <p className="text-xs text-gray-400 mb-4">Select any lot to edit its fields — Admin can edit any status</p>

      <div className="relative mb-3.5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by product · lot no. · customer"
          className="w-full h-12 px-4 text-sm border border-gray-200 rounded-xl text-[#193f5e] outline-none"
        />
        {search && (
          <button onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 bg-transparent border-none cursor-pointer text-base">
            ×
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2.5">🔍</p>
          <p className="text-sm">No lots found</p>
        </div>
      ) : (
        filtered.map((lot, i) => {
          const deptColor = DEPT[lot.dept]?.accent || "#185FA5";
          return (
            <div key={i} onClick={() => openEdit(lot)}
              className="bg-white border border-gray-200 border-l-4 rounded-r-xl p-4 mb-3 cursor-pointer hover:bg-blue-50 transition-colors"
              style={{ borderLeftColor: deptColor }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex gap-1.5 mb-1.5 flex-wrap items-center">
                    <DeptBadge dept={lot.dept} />
                    <Badge s={lot.status} />
                    {lot.packing_date && <span className="text-[11px] text-gray-400">{formatDate(lot.packing_date)}</span>}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">{lot.product || "(no product)"}</div>
                  <div className="text-xs pt-1 text-gray-400 mt-0.5">{lot.lot || "—"} · {lot.blender || "—"}</div>
                </div>
                <div className="text-right flex-shrink-0 ml-3 flex flex-col items-end">
                  <div className="text-[15px] font-bold leading-tight" style={{ color: deptColor }}>
                    {lot.blender || "—"}
                  </div>
                  <div className="text-[13px] font-medium text-[#9BA3BA] mt-1.5 leading-none">
                    {lot.target_mt} MT
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}