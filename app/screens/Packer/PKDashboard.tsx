'use client'
import React, { useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Clock, Play, PauseCircle, AlertTriangle, AlertOctagon, XCircle, CheckCircle2, LayoutGrid, ListTodo } from 'lucide-react'
import { DEPT } from '@/app/components/constants'
import type { DeptKey, LotStatus } from '@/app/components/constants'
import { Badge, DeptBadge, ProgressBar } from '@/app/components/shared'
import { formatDate } from '@/lib/utils'
import type { Lot } from './types'

const STATUS_TABS = [
  { k: 'all',       icon: <LayoutGrid size={12} />,    l: 'All',         col: '#0E1117', bg: '#F4F5F7', statuses: ['waiting', 'in_progress', 'pl_review', 'paused_shift_end', 'paused_issue', 'paused_emergency', 'rejected'] as LotStatus[] },
  { k: 'waiting',   icon: <Clock size={12} />,          l: 'Waiting',     col: '#633806', bg: '#FEF3C7', statuses: ['waiting'] as LotStatus[] },
  { k: 'inprog',    icon: <Play size={12} />,           l: 'In Progress', col: '#185FA5', bg: '#E6F1FB', statuses: ['in_progress', 'pl_review'] as LotStatus[] },
  { k: 'shiftend',  icon: <PauseCircle size={12} />,   l: 'Shift End',   col: '#854F0B', bg: '#FEF3C7', statuses: ['paused_shift_end'] as LotStatus[] },
  { k: 'issue',     icon: <AlertTriangle size={12} />, l: 'Issue',        col: '#791F1F', bg: '#FCEBEB', statuses: ['paused_issue'] as LotStatus[] },
//   { k: 'emerg',     icon: <AlertOctagon size={12} />,  l: 'Emergency',   col: '#501313', bg: '#FCEBEB', statuses: ['paused_emergency'] as LotStatus[] },
  { k: 'rejected',  icon: <XCircle size={12} />,        l: 'Rejected',    col: '#791F1F', bg: '#FCEBEB', statuses: ['rejected'] as LotStatus[] },
  { k: 'submitted', icon: <CheckCircle2 size={12} />,  l: 'Submitted',   col: '#534AB7', bg: '#EEEDFE', statuses: ['submitted', 'head_approved'] as LotStatus[] },
  { k: 'done',      icon: <CheckCircle2 size={12} />,  l: 'Completed',   col: '#27500A', bg: '#EAF3DE', statuses: ['completed'] as LotStatus[] },
]

interface FilterBarProps {
  lots: Lot[]
  statusTab: string
  setStatusTab: (t: string) => void
  deptSel: string[]
  setDeptSel: React.Dispatch<React.SetStateAction<string[]>>
  allowedDepts: string[]
}

function FilterBar({ lots, statusTab, setStatusTab, deptSel, setDeptSel, allowedDepts }: FilterBarProps) {
  const deptOk = (dept: string) =>
    allowedDepts.includes(dept) && (deptSel.length === 0 || deptSel.includes(dept))

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4">
      <div className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b border-gray-200">
        {STATUS_TABS.map(t => {
          const cnt = lots.filter(l => (!t.statuses || t.statuses.includes(l.status)) && deptOk(l.dept)).length
          const active = statusTab === t.k
          return (
            <button key={t.k} onClick={() => setStatusTab(t.k)}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
              style={{
                fontWeight: active ? 600 : 400,
                background: active ? t.bg : 'transparent',
                color: active ? t.col : '#9BA3BA',
                border: `0.5px solid ${active ? t.col : 'transparent'}`,
              }}>
              {t.icon}{t.l}
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: active ? t.col : '#DDE2EE', color: active ? '#fff' : '#9BA3BA' }}>
                {cnt}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-medium text-gray-400">Dept:</span>
        {(allowedDepts as DeptKey[]).map(d => {
          const on = deptSel.includes(d)
          const dc = DEPT[d]?.accent || '#185FA5'
          return (
            <button key={d} onClick={() => setDeptSel(p => on ? p.filter(x => x !== d) : [...p, d])}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all"
              style={{ borderColor: on ? dc : '#DDE2EE', background: on ? DEPT[d].badge.bg : '#F4F5F7', color: on ? dc : '#9BA3BA' }}>
              {on && <span className="text-[10px] font-bold" style={{ color: dc }}>✓</span>}
              {d}
            </button>
          )
        })}
        {deptSel.length > 0 && (
          <button onClick={() => setDeptSel([])} className="text-[11px] text-gray-400 bg-transparent border-none cursor-pointer px-1">Clear ×</button>
        )}
        <div className="ml-auto text-[11px] text-gray-400">
          {lots.filter(l => {
            const tab = STATUS_TABS.find(t => t.k === statusTab)
            return (!tab?.statuses || tab.statuses.includes(l.status)) && deptOk(l.dept)
          }).length} lots
        </div>
      </div>
    </div>
  )
}

function applyFilter(lots: Lot[], statusTab: string, deptSel: string[], allowedDepts: string[]): Lot[] {
  const tab = STATUS_TABS.find(t => t.k === statusTab)
  const thisMonth = new Date().getMonth()
  const thisYear = new Date().getFullYear()
  return lots.filter(l => {
    const statusOk = !tab?.statuses || tab.statuses.includes(l.status)
    const deptOk = allowedDepts.includes(l.dept) && (deptSel.length === 0 || deptSel.includes(l.dept))
    // completed แสดงแค่เดือนปัจจุบัน
    if (l.status === 'completed') {
      const d = new Date(l.packing_date || '')
      const monthOk = d.getMonth() === thisMonth && d.getFullYear() === thisYear
      return statusOk && deptOk && monthOk
    }
    return statusOk && deptOk
  })
}

export interface PKDashboardProps {
  lots: Lot[]
  setLots: React.Dispatch<React.SetStateAction<Lot[]>>
  onOpen: (lot: Lot) => void
}

export function PKDashboard({ lots, setLots, onOpen }: PKDashboardProps) {
  const { data: session } = useSession()
  const allowedDepts = useMemo(() => {
    const d = session?.user?.allowed_depts ?? 'all'
    if (!d || d === 'all') return ['PUF', 'PU', 'IBC', 'Latex']
    return d.split(',').map(s => s.trim()).filter(Boolean)
  }, [session?.user?.allowed_depts])

  const [statusTab, setStatusTab] = useState('all')
  const [deptSel, setDeptSel] = useState<string[]>([])
  const filtered = applyFilter(lots, statusTab, deptSel, allowedDepts)
  const paused = filtered.filter(l => ['paused_shift_end', 'paused_issue', 'paused_emergency'].includes(l.status))
  const other  = filtered.filter(l => !['paused_shift_end', 'paused_issue', 'paused_emergency'].includes(l.status))

  function TaskCard({ lot }: { lot: Lot }) {
    const dc = DEPT[lot.dept]?.accent || '#185FA5'
    const isPaused   = ['paused_shift_end', 'paused_issue', 'paused_emergency'].includes(lot.status)
    const isWaiting  = lot.status === 'waiting'
    const isPLReview = lot.status === 'pl_review'
    const isRejected = lot.status === 'rejected'
    const accent = isPaused
      ? lot.status === 'paused_shift_end' ? '#EF9F27' : '#E24B4A'
      : isRejected ? '#E24B4A'
      : isWaiting ? '#C8CDD8'
      : dc

    const pmeta: Record<string, { icon: React.ReactNode; text: string; sub: string }> = {
      paused_shift_end: { icon: <PauseCircle size={18} className="text-amber-600" />, text: 'Paused - shift ended',                   sub: 'Previous shift saved. Tap to resume as new shift operator.' },
      paused_issue:     { icon: <AlertTriangle size={18} className="text-red-600" />, text: `Paused - ${lot.pauseReason || 'issue / problem'}`, sub: 'Close downtime log before resuming.' },
      paused_emergency: { icon: <AlertOctagon size={18} className="text-red-600" />,  text: `Emergency - ${lot.pauseReason || 'chemical leak'}`, sub: 'Log started. Close downtime log before resuming.' },
    }
    const pm = pmeta[lot.status]
    const statusIcon: Record<string, React.ReactNode> = {
      waiting:           <Clock size={14} />,
      in_progress:       <Play size={14} />,
      paused_shift_end:  <PauseCircle size={14} />,
      paused_issue:      <AlertTriangle size={14} />,
      paused_emergency:  <AlertOctagon size={14} />,
      rejected:          <XCircle size={14} />,
    }

    return (
      <div
        className="bg-white border border-gray-200 rounded-r-xl p-4 mb-3 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
        style={{ borderLeft: `3px solid ${accent}` }}
        onClick={() => onOpen({ ...lot, current_pk_step: lot.current_pk_step ?? 0, fixSection: null })}>
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-start gap-3">
            <div className="text-2xl leading-none flex-shrink-0">{DEPT[lot.dept]?.icon}</div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <DeptBadge dept={lot.dept} />
                <Badge s={lot.status} />
              </div>
              <div className="text-sm font-medium text-gray-900 mb-0.5">{lot.product}</div>
              <div className="text-[11px] text-gray-400"><span className="font-bold">#{(lot as any).display_no ?? '-'}</span> {lot.lot}</div>
              <div className="text-xs font-medium mt-1" style={{ color: dc }}>Packing: {formatDate(lot.packing_date)}</div>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <div className="text-base font-bold" style={{ color: '#1D9E75' }}>{lot.blender || '-'}</div>
            <div className="text-[13px] text-gray-400 mt-0.5">{lot.target_mt} MT</div>
          </div>
        </div>
        {(isPaused || lot.status === 'in_progress') && (lot.planned_pallets ?? 0) > 0 && (
          <div className="mb-3"><ProgressBar done={lot.done_pallets} total={lot.planned_pallets} color={accent} /></div>
        )}
        {isPaused && pm && (
          <div className="rounded-xl px-3 py-2 mb-3 flex gap-2 items-start"
            style={{ background: lot.status === 'paused_shift_end' ? '#FEF3C7' : '#FCEBEB' }}>
            <span className="flex-shrink-0 mt-0.5">{pm.icon}</span>
            <div>
              <div className="text-xs font-semibold" style={{ color: lot.status === 'paused_shift_end' ? '#633806' : '#501313' }}>{pm.text}</div>
              <div className="text-[11px] mt-0.5" style={{ color: lot.status === 'paused_shift_end' ? '#854F0B' : '#791F1F' }}>{pm.sub}</div>
            </div>
          </div>
        )}
        {isWaiting && lot.plan_change_notified && (
          <div className="rounded-xl px-3 py-2 mb-3 flex gap-2 items-start bg-amber-50 border border-amber-300">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs font-semibold text-amber-800">SL แก้ไขข้อมูล lot นี้แล้ว กรุณาตรวจสอบ</div>
          </div>
        )}
        {isPLReview && (
          <div className="bg-[#EEEDFE] border border-[#534AB7] rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <div className="text-[11px] font-medium text-[#534AB7]">Waiting for Pack Lead to approve scale...</div>
          </div>
        )}
        {isWaiting && <div className="bg-gray-100 rounded-xl px-3 py-2 mb-3 text-xs text-gray-600">Not started yet. Tap to begin.</div>}
        {isRejected && lot.reject_remark && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-3">
            <div className="text-[10px] font-bold text-red-800 uppercase tracking-wide mb-1">Pack Lead remark</div>
            <div className="text-xs text-red-900 leading-relaxed">{lot.reject_remark}</div>
          </div>
        )}
        <div className="text-[11px] text-[#9BA3BA] flex items-center justify-end gap-1 mt-2">
          <Play size={11} />
          <span>
            {isWaiting   ? 'Tap to start'
              : isPLReview ? 'Tap to view — awaiting PL approval'
              : isPaused   ? 'Tap to resume'
              : isRejected ? 'Tap to fix and resubmit'
              : 'Tap to continue'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-lg font-medium text-gray-900">My tasks today</div>
          <div className="text-xs text-gray-400 mt-0.5">{lots.length} task(s) assigned</div>
        </div>
        <div className="bg-blue-50 text-blue-800 text-xs font-medium px-3 py-1 rounded-full">{lots.length} tasks</div>
      </div>
      <FilterBar lots={lots} statusTab={statusTab} setStatusTab={setStatusTab} deptSel={deptSel} setDeptSel={setDeptSel} allowedDepts={allowedDepts} />
      <div>
        {paused.length > 0 && (
          <>
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Resume paused</div>
            {paused.map((l, i) => <TaskCard key={i} lot={l} />)}
            <div className="h-2" />
          </>
        )}
        {other.length > 0 && (
          <>
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
              {statusTab === 'all' ? 'Waiting / Active' : STATUS_TABS.find(t => t.k === statusTab)?.l || 'Lots'}
            </div>
            {other.map((l, i) => <TaskCard key={i} lot={l} />)}
          </>
        )}
        {paused.length === 0 && other.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ListTodo size={40} className="text-gray-300 mx-auto mb-3" />
            No tasks in this category
          </div>
        )}
      </div>
    </div>
  )
}