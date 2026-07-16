'use client'

import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ArrowLeft, XCircle, CheckCircle2, PencilLine } from 'lucide-react'
import { DEPT, isPerPalletChecklistItem } from './constants'
import type { DeptKey } from './constants'
import { DeptBadge, Badge, LotStepBar } from './shared'
import { formatDate, formatTime, toThaiTime, formatDuration, formatDowntimeDate } from '@/lib/utils'
import { buildPlanFields } from '@/lib/planFields'

import type { Lot as PackerLot, MduVals, ApiChecklistItem, DowntimeLog } from '@/app/screens/Packer/types'
import { Step0Date } from '@/app/screens/Packer/steps/Step0Date'
import { Step1Scale, getStandardWeight, getTolerance, deriveLatexDrumSet } from '@/app/screens/Packer/steps/Step1Scale'
import { Step2PreCheck } from '@/app/screens/Packer/steps/Step2PreCheck'
import { Step3Drumming } from '@/app/screens/Packer/steps/Step3Drumming'
import { Step4PostCheck } from '@/app/screens/Packer/steps/Step4PostCheck'
import { Step5Submit } from '@/app/screens/Packer/steps/Step5Submit'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lot {
  id: number
  dept: DeptKey
  product: string
  lot: string
  packing_date: string
  status: string
  pauseReason?: string
  target_mt: number
  blender?: string
  customer?: string
  packaging?: string
  planned_pallets?: number
  done_pallets?: number
  actual_mt?: number
  reject_remark?: string | null
  label_count?: number
  label_no_start?: number | string
  label_no_end?: number | string
  cut_off_date?: string
  current_pk_step?: number
  fixSection?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface PKFormViewerProps {
  lot: Lot
  readOnly?: boolean
  onBack?: () => void
  currentUser?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setLots?: React.Dispatch<React.SetStateAction<any[]>>
  onApprove?: () => Promise<void> | void
  onReject?: (remark: string) => Promise<void> | void
  approveLabel?: string
  onEditPlan?: () => void
}


export default function PKFormViewer({ lot, onBack, onApprove, onReject, approveLabel = 'Approve', onEditPlan }: PKFormViewerProps) {
  const dc = DEPT[lot.dept]?.accent || '#0F6E56'

  const [loading, setLoading] = useState(true)
  const [pkStep, setPkStep] = useState(0)

  // Step 0
  const [opDate, setOpDate] = useState('')
  const [labelCheck, setLabelCheck] = useState('')
  // Latex Step 0
  const [latexNoBact, setLatexNoBact] = useState('')
  const [latexNoBactBy, setLatexNoBactBy] = useState('')
  const [latexTemp, setLatexTemp] = useState('')
  const [latexTempBy, setLatexTempBy] = useState('')

  // Step 1
  const [mduLocked, setMduLocked] = useState<string | null>(null)
  const [mduVals, setMduVals] = useState<MduVals>({})
  const [recalib, setRecalib] = useState('')
  const [scaleApproved, setScaleApproved] = useState(false)
  const [scalePendingPL, setScalePendingPL] = useState(false)
  const [scaleApprovedBy, setScaleApprovedBy] = useState('')
  const [latexMdu1, setLatexMdu1] = useState<MduVals>(() => ({
    drumSet: lot.dept === 'Latex' ? (deriveLatexDrumSet(lot.packaging_category) ?? 'Tote Set 1000.0 Kg') : 'Tote Set 1000.0 Kg',
  }))
  const [latexMdu2, setLatexMdu2] = useState<MduVals>(() => ({
    drumSet: lot.dept === 'Latex' ? (deriveLatexDrumSet(lot.packaging_category) ?? 'Tote Set 1000.0 Kg') : 'Tote Set 1000.0 Kg',
  }))
  const [latexScaleApproved, setLatexScaleApproved] = useState(false)
  const [latexRound1Machine, setLatexRound1Machine] = useState('')
  const [latexRound2Machine, setLatexRound2Machine] = useState('')
  const [latexRound1By, setLatexRound1By] = useState('')
  const [latexRound2By, setLatexRound2By] = useState('')

  // Step 2
  const [preChk, setPreChk] = useState<Record<number, string>>({})
  const [preItemsDB, setPreItemsDB] = useState<ApiChecklistItem[]>([])
  const [postItemsDB, setPostItemsDB] = useState<ApiChecklistItem[]>([])
  const [emptyDrumWt, setEmptyDrumWt] = useState('')
  const [sampleType, setSampleType] = useState('')

  // Step 3
  const [drumStart, setDrumStart] = useState('')
  const [batchSizeKg, setBatchSizeKg] = useState('')
  const [containerQty, setContainerQty] = useState('')
  const [capLarge, setCapLarge] = useState('')
  const [capSmall, setCapSmall] = useState('')
  const [capXSmall, setCapXSmall] = useState('')
  const [flushKg, setFlushKg] = useState('')
  const [purgeKg, setPurgeKg] = useState('')
  const [drainKg, setDrainKg] = useState('')
  // Latex Step 3
  const [latexPrevProduct, setLatexPrevProduct] = useState('')
  const [latexPrevProductName, setLatexPrevProductName] = useState('')
  const [latexSample, setLatexSample] = useState('')
  const [latexDrummer, setLatexDrummer] = useState('')
  const [latexFlushKg, setLatexFlushKg] = useState('')
  const [latexProductPurgeKg, setLatexProductPurgeKg] = useState('')
  const [latexDrainKg, setLatexDrainKg] = useState('')
  const [latexTotalKg, setLatexTotalKg] = useState('')
  const [latexLot1Qty, setLatexLot1Qty] = useState('')
  const [latexLot2Qty, setLatexLot2Qty] = useState('')

  // Step 4
  const [postChk, setPostChk] = useState<Record<number, string>>({})
  // Latex Step 4
  const [latexStorageArea, setLatexStorageArea] = useState('')
  const [latexTagStatus, setLatexTagStatus] = useState('')
  const [latexTagBy, setLatexTagBy] = useState('')

  // Step 5
  const [drumEnd, setDrumEnd] = useState('')

  const [sessions, setSessions] = useState<any[]>([])

  const [approvalLogs, setApprovalLogs] = useState<any[]>([])
  const [operatorsJson, setOperatorsJson] = useState<any[]>([])
  const [downtimeLogs, setDowntimeLogs] = useState<DowntimeLog[]>([])

  const [rejecting, setRejecting] = useState(false)
  const [decisionRemark, setDecisionRemark] = useState('')
  const [deciding, setDeciding] = useState(false)

  // isTote must be derived before useEffect so the closure can use it
  const isTote = (lot.packaging || '').toLowerCase().includes('tote') || (lot.packaging || '').toLowerCase().includes('ibc')

  // ── Fetch all data on mount ──────────────────────────────────
  useEffect(() => {
    if (!lot.id) return
    async function fetchAll() {
      setLoading(true)
      let localSampleType = ''
      try {
        const [lotRes, scaleRes, chkRes, itemsRes, approvalRes, dtRes] = await Promise.all([
          fetch(`/api/lots/${lot.id}`),
          fetch(`/api/scale-verifications?production_detail_id=${lot.id}`),
          fetch(`/api/checklist?production_detail_id=${lot.id}`),
          fetch(`/api/checklist-items?form_type=${lot.dept}`),
          fetch(`/api/approval-logs?production_detail_id=${lot.id}`),
          fetch(`/api/downtime?production_detail_id=${lot.id}`),
        ])

        if (lotRes.ok) {
          const data = await lotRes.json()

          // Step 0
          if (data.operation_date) setOpDate(String(data.operation_date).slice(0, 10))
          if (data.label_check) setLabelCheck(data.label_check)

          // Step 1
          if (data.mdu_machine) setMduLocked(data.mdu_machine)
          if (data.recalibration) setRecalib(data.recalibration)
          if (data.drum_set) setMduVals(p => ({ ...p, drumSet: data.drum_set }))

          // Step 2
          if (data.empty_drum_wt) setEmptyDrumWt(String(data.empty_drum_wt))
          if (data.sample_type) { setSampleType(data.sample_type); localSampleType = data.sample_type }

          // Step 3 — isTote-aware container mapping (mirrors PKForm.tsx loadLotData)
          if (data.lot_drumming_start) setDrumStart(formatTime(data.lot_drumming_start))
          if (data.batch_size_kg) setBatchSizeKg(String(data.batch_size_kg))
          if (isTote) {
            if (data.container_tote) setContainerQty(String(data.container_tote))
            if (data.container_drum) setCapLarge(String(data.container_drum))
          } else {
            if (data.container_drum) setContainerQty(String(data.container_drum))
            if (data.container_tote) setCapLarge(String(data.container_tote))
          }
          if (data.cap_large) setCapSmall(String(data.cap_large))
          if (data.cap_small) setCapXSmall(String(data.cap_small))
          if (data.flush_kg) setFlushKg(String(data.flush_kg))
          if (data.purge_kg) setPurgeKg(String(data.purge_kg))
          if (data.drain_kg) setDrainKg(String(data.drain_kg))

          // Step 5
          if (data.lot_drumming_end) setDrumEnd(formatTime(data.lot_drumming_end))

          // Operators
          if (data.operators_json) {
            try {
              const ops = JSON.parse(data.operators_json)
              if (Array.isArray(ops)) setOperatorsJson(ops)
              else setOperatorsJson([])
            } catch { setOperatorsJson([]) }
          } else {
            setOperatorsJson([])
          }

          // Latex fields (from latex_drumming_data nested object, included by GET /api/lots/[id])
          if (data.latex_drumming_data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lx: any = data.latex_drumming_data
            // Step 0 Latex
            if (lx.no_bacteria !== null && lx.no_bacteria !== undefined) setLatexNoBact(lx.no_bacteria ? 'ใช่' : 'ไม่ใช่')
            if (lx.no_bacteria_by) setLatexNoBactBy(lx.no_bacteria_by)
            if (lx.temp_below_40c !== null && lx.temp_below_40c !== undefined) setLatexTemp(lx.temp_below_40c ? 'ใช่' : 'ไม่ใช่')
            if (lx.temp_by) setLatexTempBy(lx.temp_by)
            // Step 3 Latex
            if (lx.weight_set_by) setLatexPrevProduct(lx.weight_set_by)
            if (lx.prev_product_loaded) setLatexPrevProductName(lx.prev_product_loaded)
            if (lx.lab_sample_detail) setLatexSample(lx.lab_sample_detail)
            if (lx.drummer_name) setLatexDrummer(lx.drummer_name)
            if (lx.flush_before_drumming_kg) setLatexFlushKg(String(lx.flush_before_drumming_kg))
            if (lx.product_purge_kg) setLatexProductPurgeKg(String(lx.product_purge_kg))
            if (lx.drain_kg) setLatexDrainKg(String(lx.drain_kg))
            if (lx.total_kg) setLatexTotalKg(String(lx.total_kg))
            if (lx.lot1_qty) setLatexLot1Qty(String(lx.lot1_qty))
            if (lx.lot2_qty) setLatexLot2Qty(String(lx.lot2_qty))
            // Step 4 Latex
            if (lx.storage_area_by) setLatexStorageArea(lx.storage_area_by)
            if (lx.tag_status) setLatexTagStatus(lx.tag_status)
            if (lx.tag_checked_by) setLatexTagBy(lx.tag_checked_by)
          }
        }

        // Restore approval logs
        if (approvalRes.ok) {
          const logs = await approvalRes.json()
          if (Array.isArray(logs)) setApprovalLogs(logs)
        }

        // Restore historical downtime logs
        if (dtRes.ok) {
          const dtLogs = await dtRes.json()
          if (Array.isArray(dtLogs)) {
            setDowntimeLogs(dtLogs
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((d: any) => d.end_time != null)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((d: any) => ({
                start: d.start_time as string,
                end: d.end_time as string,
                type: d.downtime_type as string,
                reason: (d.reason || '') as string,
              })))
          }
        }

        // Restore scale verifications + checker names
        if (scaleRes.ok) {
          const svData = await scaleRes.json()
          if (Array.isArray(svData) && svData.length > 0) {
            if (lot.dept === 'Latex') {
              const r1 = svData.find((v: any) => v.round_no === 1)
              const r2 = svData.find((v: any) => v.round_no === 2)
              const r1Approved = !!(r1?.is_locked || r1?.pl_approved_at)
              const r2Approved = !!(r2?.is_locked || r2?.pl_approved_at)
              if (r1) {
                if (r1.standard_weight_kg != null) {
                  const w1 = Number(r1.standard_weight_kg)
                  setLatexMdu1(p => ({ ...p, drumSet: w1 === 200 ? 'Drum Set 200.0 Kg' : w1 === 1000 ? 'Tote Set 1000.0 Kg' : 'อื่นๆ' }))
                }
                if (r1.measured_weight_kg) setLatexMdu1(p => ({ ...p, w: String(r1.measured_weight_kg) }))
                if (r1.recalibration_required != null) setLatexMdu1(p => ({ ...p, recalib: r1.recalibration_required ? 'Yes' : 'No' }))
                if (r1.machine_code) setLatexRound1Machine(String(r1.machine_code))
                if (r1Approved && r1.pl_approver?.full_name) setLatexRound1By(r1.pl_approver.full_name)
              }
              if (r2) {
                if (r2.standard_weight_kg != null) {
                  const w2 = Number(r2.standard_weight_kg)
                  setLatexMdu2(p => ({ ...p, drumSet: w2 === 200 ? 'Drum Set 200.0 Kg' : w2 === 1000 ? 'Tote Set 1000.0 Kg' : 'อื่นๆ' }))
                }
                if (r2.measured_weight_kg) setLatexMdu2(p => ({ ...p, w: String(r2.measured_weight_kg) }))
                if (r2.recalibration_required != null) setLatexMdu2(p => ({ ...p, recalib: r2.recalibration_required ? 'Yes' : 'No' }))
                if (r2.machine_code) setLatexRound2Machine(String(r2.machine_code))
                if (r2Approved && r2.pl_approver?.full_name) setLatexRound2By(r2.pl_approver.full_name)
              }
              // Manual + Auto are approved together as one pair
              if (r1Approved && r2Approved) setLatexScaleApproved(true)
            } else {
              const latest = svData[0]
              if (latest.measured_weight_kg) setMduVals(p => ({ ...p, w: String(latest.measured_weight_kg) }))
              if (latest.machine_code) setMduLocked(String(latest.machine_code))
              const approvedRecord = svData.find((v: any) => v.pl_approved_at)
              if (approvedRecord?.pl_approver?.full_name) setScaleApprovedBy(approvedRecord.pl_approver.full_name)
              if (latest.standard_weight_kg != null) {
                const stdW = Number(latest.standard_weight_kg)
                setMduVals(p => ({
                  ...p,
                  drumSet: stdW === 210 ? 'Drum Set 210.0 Kg'
                    : stdW === 1000 ? 'Tote Set 1000.0 Kg'
                      : 'อื่นๆ',
                  ...(stdW !== 210 && stdW !== 1000 ? { drumSetCustom: String(stdW) } : {}),
                }))
              }
              if (latest.recalibration_required != null) setRecalib(latest.recalibration_required ? 'Yes' : 'No')
              const anyApproved = svData.some((v: any) => v.is_locked || v.pl_approved_at)
              const anyPending = svData.some((v: any) => !v.pl_approved_at && !v.is_locked)
              if (anyApproved) setScaleApproved(true)
              else if (anyPending) setScalePendingPL(true)
            }
          }
        }

        // Restore checklist items
        if (itemsRes.ok) {
          const items = await itemsRes.json()
          if (Array.isArray(items)) {
            const preI = items.filter((ci: any) => ci.phase === 'pre')
            setPreItemsDB(preI)
            setPostItemsDB(items.filter((ci: any) => ci.phase === 'post'))
          }
        }

        // Restore checklist responses (lot-level + per-pallet)
        const perPalletMap: Record<number, Record<number, string>> = {}
        if (chkRes.ok) {
          const responses = await chkRes.json()
          if (Array.isArray(responses)) {
            const preMap: Record<number, string> = {}
            const postMap: Record<number, string> = {}
            responses.forEach((r: any) => {
              if (r.phase === 'pre' && r.pallet_no != null) {
                if (!perPalletMap[r.pallet_no]) perPalletMap[r.pallet_no] = {}
                perPalletMap[r.pallet_no][r.checklist_item_id] = r.response_value
                if (r.pallet_no === 1) {
                  preMap[r.checklist_item_id] = r.response_value
                }
              } else {
                if (r.phase === 'pre') preMap[r.checklist_item_id] = r.response_value
                if (r.phase === 'post') postMap[r.checklist_item_id] = r.response_value
              }
            })
            setPreChk(preMap)
            setPostChk(postMap)
          }
        }

        // Restore drumming session + pallet rechecks
        const sessRes = await fetch(`/api/drumming-sessions?production_detail_id=${lot.id}`)
        if (sessRes.ok) {
          const sessList = await sessRes.json()
          if (Array.isArray(sessList) && sessList.length > 0) {
            const latest = sessList[sessList.length - 1]

            const recheckRes = await fetch(`/api/recheck-weights?drumming_session_id=${latest.id}`)
            if (recheckRes.ok) {
              const weights = await recheckRes.json()
              if (Array.isArray(weights)) {
                const palletMap = new Map<number, any>()
                weights.forEach((w: any) => {
                  const existing = palletMap.get(w.pallet_no)
                  if (!existing || w.attempt_no > existing.attempt_no) {
                    palletMap.set(w.pallet_no, w)
                  }
                })

                const attemptsByPallet = new Map<number, any[]>()
                weights.forEach((w: any) => {
                  if (!attemptsByPallet.has(w.pallet_no)) attemptsByPallet.set(w.pallet_no, [])
                  attemptsByPallet.get(w.pallet_no)!.push(w)
                })

                const restored = Array.from(palletMap.entries())
                  .sort(([a], [b]) => a - b)
                  .map(([pallet_no, w]) => {
                    const attempts = (attemptsByPallet.get(pallet_no) ?? [])
                      .sort((a: any, b: any) => (a.attempt_no ?? 0) - (b.attempt_no ?? 0))
                      .map((a: any, i: number) => ({
                        no: i + 1,
                        wt: String(a.weight_kg || ''),
                        pass: !a.fail_reason,
                        failReason: a.fail_reason || undefined,
                      }))
                    return {
                      no: pallet_no,
                      recheck: attempts,
                      startTime: '',
                      pass: !w.fail_reason,
                      wt: String(w.weight_kg || ''),
                      preChk45: perPalletMap[pallet_no] ?? undefined,
                      sampleType: pallet_no === 1 ? localSampleType || undefined : undefined,
                    }
                  })

                setSessions(restored)
              }
            }
          }
        }
      } catch (err) {
        console.error('[PKFormViewer] fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  const preItems = preItemsDB.filter(i => !isPerPalletChecklistItem(i.item_label))
  const preItems45 = preItemsDB.filter(i => isPerPalletChecklistItem(i.item_label))

  const stdWeight = getStandardWeight(mduVals.drumSet, mduVals.drumSetCustom, lot.dept)
  const tolerance = getTolerance(mduVals.drumSet, mduVals.customTolerance)

  const planFields = buildPlanFields(lot as Record<string, any>)
  const packerLot = lot as unknown as PackerLot

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="w-6 h-6 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin" />
        <div className="text-[13px] text-[#9BA3BA]">Loading lot data...</div>
      </div>
    )
  }

  const rejectionLogs = approvalLogs.filter((l: any) =>
    l.action === 'rejected_by_pl' || l.action === 'rejected_by_sl'
  )

  return (
    <div>
      {/* Back */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:block">Home</span>
        </button>
      )}

      {/* Plan banner */}
      <div className="rounded-xl p-4 mb-3 border" style={{ background: dc + '0d', borderColor: dc }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[12px] font-medium uppercase tracking-widest" style={{ color: dc }}>Plan from Site Logistics</div>
        </div>
        <div className="flex gap-1.5 mb-2 flex-wrap">
          <DeptBadge dept={lot.dept} /> <Badge s={lot.status} />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {planFields.map(r => (
            <div key={r.l} className="bg-white/85 rounded-lg p-2">
              <div className="text-[10px] font-medium" style={{ color: dc }}>{r.l}</div>
              <div className="text-xs font-medium text-gray-900 mt-0.5">{String(r.v)}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-3 flex items-center gap-3 mt-3" style={{ background: dc }}>
          <div>
            <div className="text-[10px] font-medium text-white/65">Packing Date (set by SL)</div>
            <div className="text-xl font-bold text-white">{formatDate(lot.packing_date)}</div>
          </div>
        </div>
      </div>

      {/* Persistent remarks / downtime history */}
      {(lot.reject_remark || downtimeLogs.length > 0 || rejectionLogs.length > 0) && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-3">
          <div className="text-xs font-bold text-amber-800 mb-2">ประวัติ — หมายเหตุ / ปัญหาที่บันทึกไว้</div>
          {lot.reject_remark && (
            <div className="bg-white border border-red-300 rounded-lg p-2.5 mb-2">
              <div className="text-[10px] font-semibold text-red-800 mb-0.5">Reject Remark</div>
              <div className="text-xs text-red-700">{lot.reject_remark}</div>
            </div>
          )}
          {rejectionLogs.map((l: any, i: number) => (
            <div key={`reject-${i}`} className="bg-white border border-red-300 rounded-lg p-2.5 mb-2">
              <div className="text-[10px] font-semibold text-red-800 mb-0.5">
                {l.action === 'rejected_by_sl' ? 'SL Reject' : 'PL Reject'} — {l.actor?.full_name || l.actor?.username || 'Unknown'}
                {l.created_at && ` · ${formatDowntimeDate(l.created_at)} ${toThaiTime(l.created_at)}`}
              </div>
              <div className="text-xs text-red-700">{l.remark || '—'}</div>
            </div>
          ))}
          {downtimeLogs.map((l, i) => (
            <div key={i} className="bg-white border border-amber-300 rounded-lg p-2.5 mb-2 last:mb-0">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="text-[10px] font-semibold text-amber-800 mb-0.5">
                    {l.type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-amber-700">{l.reason || '—'}</div>
                </div>
                <div className="text-[10px] text-amber-500 flex-shrink-0 text-right">
                  {formatDowntimeDate(l.start)} {toThaiTime(l.start)}
                  {l.end && l.end !== l.start && `–${toThaiTime(l.end)}`} น.
                  {formatDuration(l.start, l.end) && ` (${formatDuration(l.start, l.end)})`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Summary Overview ── */}
      <div className="mb-4">
        <div className="bg-white border border-[#DDE2EE] rounded-xl p-4 mb-3">
          <div className="text-[11px] font-bold text-[#9BA3BA] uppercase tracking-wide mb-3">สรุปภาพรวม</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Operation Date</div>
              <div className="text-[13px] font-semibold text-[#0E1117]">
                {opDate ? opDate.split('-').reverse().join('-') : '—'}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Label Check</div>
              <div className={`text-[13px] font-semibold ${labelCheck === 'yes' ? 'text-[#27500A]' : labelCheck === 'no' ? 'text-[#E24B4A]' : 'text-[#9BA3BA]'
                }`}>
                {labelCheck === 'yes' ? '✓ ตรงกัน' : labelCheck === 'no' ? '✗ ไม่ตรง' : '—'}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Drumming Start</div>
              <div className="text-[13px] font-semibold text-[#0E1117]">{drumStart || '—'}</div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Drumming End</div>
              <div className="text-[13px] font-semibold text-[#0E1117]">{drumEnd || '—'}</div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Batch Size</div>
              <div className="text-[13px] font-semibold text-[#0E1117]">
                {batchSizeKg ? `${batchSizeKg} kg` : '—'}
              </div>
            </div>

            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Containers</div>
              <div className="text-[13px] font-semibold text-[#0E1117]">
                {containerQty ? `${containerQty} ${isTote ? 'tote' : 'drum'}` : '—'}
              </div>
            </div>

            {/* PL who approved — always show */}
            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Pack Lead (อนุมัติ)</div>
              <div className="text-[13px] font-semibold text-[#534AB7]">
                {(() => {
                  const plLog = approvalLogs.find((l: any) =>
                    l.action === 'pack_lead_approved' ||
                    l.action === 'submitted'
                  )
                  return plLog?.actor?.full_name || plLog?.actor?.username || '—'
                })()}
              </div>
            </div>

            {/* SL who completed — always show */}
            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Site Logistics (Final Check)</div>
              <div className="text-[13px] font-semibold text-[#185FA5]">
                {(() => {
                  const slLog = approvalLogs.find((l: any) =>
                    l.action === 'completed' ||
                    l.action === 'rejected_by_sl'
                  )
                  return slLog?.actor?.full_name || slLog?.actor?.username || '—'
                })()}
              </div>
            </div>

            {/* Packer operators — always show, full width */}
            <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-3 py-2.5 col-span-2">
              <div className="text-[10px] text-[#9BA3BA] font-medium mb-1">Packer (operator)</div>
              {operatorsJson.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {operatorsJson.map((op: any, i: number) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-[12px] font-semibold text-[#0E1117]">
                        {op.name}
                      </span>
                      <span className="text-[10px] text-[#9BA3BA]">
                        ({op.action === 'start' ? `เริ่ม ${op.time}`
                          : op.action === 'resubmit' ? `resubmit ${op.time}`
                            : `resume ${op.time}`} น.)
                      </span>
                      {i < operatorsJson.length - 1 && (
                        <span className="text-[#DDE2EE] mx-0.5">→</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[13px] font-semibold text-[#9BA3BA]">—</div>
              )}
            </div>
          </div>
        </div>

        {/* Scale MDU summary — always show */}
        {(() => {
          const isLatex = lot.dept === 'Latex'
          const approved = isLatex ? latexScaleApproved : scaleApproved
          const machineLabel = isLatex
            ? ([latexRound1Machine, latexRound2Machine].filter(Boolean).join(' → ') || '—')
            : (mduLocked || '—')
          const checkerLabel = isLatex
            ? ([latexRound1By, latexRound2By].filter(Boolean).join(' / ') || '')
            : scaleApprovedBy
          return (
            <div className={`rounded-xl p-3 mb-3 flex items-center gap-3 border ${approved ? 'bg-[#EAF3DE] border-[#27500A]' : 'bg-[#F8FAFC] border-[#DDE2EE]'
              }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${approved ? 'bg-[#27500A]' : 'bg-[#DDE2EE]'
                }`}>
                <span className="text-white text-sm font-bold">{approved ? '✓' : '—'}</span>
              </div>
              <div>
                <div className={`text-[12px] font-bold ${approved ? 'text-[#27500A]' : 'text-[#9BA3BA]'}`}>
                  Scale MDU — {approved ? 'PL Approved' : 'Pending / Not recorded'}
                </div>
                <div className="text-[11px] text-[#9BA3BA]">
                  {machineLabel}
                  {!isLatex && mduVals.w ? ` · ${mduVals.w} kg` : ''}
                  {recalib === 'Yes' ? ' · Recalibrated' : ''}
                  {checkerLabel ? ` · Checked by: ${checkerLabel}` : ''}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Checklist summary — always show */}
        <div className="bg-white border border-[#DDE2EE] rounded-xl p-3 mb-3">
          <div className="text-[11px] font-bold text-[#9BA3BA] uppercase tracking-wide mb-2">Checklist Summary</div>
          <div className="flex gap-4">
            {/* Pre-checklist */}
            <div className="flex-1">
              <div className="text-[10px] text-[#5A617A] font-medium mb-1.5">Pre-check</div>
              {preItemsDB.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {preItemsDB.map(item => {
                    const val = preChk[item.id]
                    return (
                      <span key={item.id}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${val === 'Yes' ? 'bg-[#EAF3DE] text-[#27500A]' : val === 'No' ? 'bg-[#FCEBEB] text-[#791F1F]' : 'bg-[#F4F5F7] text-[#9BA3BA]'
                          }`}>
                        {val || '-'}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <span className="text-[12px] text-[#9BA3BA]">—</span>
              )}
            </div>

            {/* Post-checklist */}
            <div className="flex-1">
              <div className="text-[10px] text-[#5A617A] font-medium mb-1.5">Post-check</div>
              {postItemsDB.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {postItemsDB.map(item => {
                    const val = postChk[item.id]
                    return (
                      <span key={item.id}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${val === 'Yes' ? 'bg-[#EAF3DE] text-[#27500A]' : val === 'No' ? 'bg-[#FCEBEB] text-[#791F1F]' : 'bg-[#F4F5F7] text-[#9BA3BA]'
                          }`}>
                        {val || '-'}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <span className="text-[12px] text-[#9BA3BA]">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="text-[11px] font-bold text-[#9BA3BA] uppercase tracking-wide mb-2 mt-1">
          ดูรายละเอียดแต่ละ Step
        </div>
      </div>

      <LotStepBar pkStep={pkStep} dc={dc} planned_pallets={lot.planned_pallets || 0} sessions={sessions} />

      {/* Step 0 */}
      {pkStep === 0 && (
        <Step0Date
          lot={packerLot} dc={dc}
          opDate={opDate} setOpDate={() => { }} opAS={null}
          labelCheck={labelCheck} setLabelCheck={() => { }}
          latexNoBact={latexNoBact} setLatexNoBact={() => { }}
          latexNoBactBy={latexNoBactBy} setLatexNoBactBy={() => { }}
          latexTemp={latexTemp} setLatexTemp={() => { }}
          latexTempBy={latexTempBy} setLatexTempBy={() => { }}
          onNext={() => setPkStep(1)}
          readOnly={true}
        />
      )}

      {/* Step 1 */}
      {pkStep === 1 && (
        <Step1Scale
          lot={packerLot} dc={dc}
          mduLocked={mduLocked} setMduLocked={() => { }}
          mduVals={mduVals} setMduVals={() => { }}
          stdWeight={stdWeight} tolerance={tolerance}
          recalib={recalib} setRecalib={() => { }}
          scaleApproved={scaleApproved} setScaleApproved={() => { }} scalePendingPL={scalePendingPL}
          scaleApprovedBy={scaleApprovedBy}
          setScaleVerificationId={() => { }} setScalePendingPL={() => { }}
          isIssueMode={false} pkStep={1}
          latexScaleApproved={latexScaleApproved} latexScalePending={false}
          setLatexScaleApproved={() => { }} setLatexScalePending={() => { }}
          latexMdu1={latexMdu1} setLatexMdu1={() => { }}
          latexMdu2={latexMdu2} setLatexMdu2={() => { }}
          latexRound1By={latexRound1By} latexRound2By={latexRound2By}
          doPause={() => { }} setLots={() => { }}
          onBack={() => setPkStep(0)} onNext={() => setPkStep(2)}
          readOnly={true}
          hideClearScale={true}
        />
      )}

      {/* Step 2 */}
      {pkStep === 2 && (
        <Step2PreCheck
          dc={dc} isIssueMode={false}
          lotId={lot.id} lotDept={lot.dept}
          preItems={preItems}
          preChk={preChk} setPreChk={() => { }} preAS={null}
          emptyDrumWt={emptyDrumWt} setEmptyDrumWt={() => { }}
          isTote={isTote} preOk={true} preFail={false}
          doPause={() => { }}
          onBack={() => setPkStep(1)} onNext={() => setPkStep(3)}
          readOnly={true}
        />
      )}

      {/* Step 3 — Drumming (read-only, reuses the real Step3Drumming component) */}
      {pkStep === 3 && (
        <Step3Drumming
          dc={dc} lotId={lot.id} lotDept={lot.dept}
          totalP={lot.planned_pallets || 0} isTote={isTote}
          sessions={sessions} palletNo={sessions.length + 1}
          wtMachine={''} setWtMachine={() => { }}
          wtCategory={''} setWtCategory={() => { }}
          wtDrumType={''} setWtDrumType={() => { }}
          wtIbcSub={''} setWtIbcSub={() => { }}
          wtStandard={null}
          sessionWt={''} setSessionWt={() => { }}
          recheckList={[]} recheckDone={false}
          wPass={false} wFail={false}
          skipWeightCheck={lot.dept === 'IBC' || lot.dept === 'Latex'}
          drumStart={drumStart} setDrumStart={() => { }} drumAS={null}
          flushKg={flushKg} setFlushKg={() => { }}
          purgeKg={purgeKg} setPurgeKg={() => { }}
          drainKg={drainKg} setDrainKg={() => { }}
          batchSizeKg={batchSizeKg} setBatchSizeKg={() => { }}
          containerQty={containerQty} setContainerQty={() => { }}
          capLarge={capLarge} setCapLarge={() => { }}
          capSmall={capSmall} setCapSmall={() => { }}
          capXSmall={capXSmall} setCapXSmall={() => { }}
          latexPrevProduct={latexPrevProduct} setLatexPrevProduct={() => { }}
          latexPrevProductName={latexPrevProductName} setLatexPrevProductName={() => { }}
          latexSample={latexSample} setLatexSample={() => { }}
          latexDrummer={latexDrummer} setLatexDrummer={() => { }}
          latexFlushKg={latexFlushKg} setLatexFlushKg={() => { }}
          latexProductPurgeKg={latexProductPurgeKg} setLatexProductPurgeKg={() => { }}
          latexDrainKg={latexDrainKg} setLatexDrainKg={() => { }}
          latexTotalKg={latexTotalKg} setLatexTotalKg={() => { }}
          latexLot1Qty={latexLot1Qty} setLatexLot1Qty={() => { }}
          latexLot2Qty={latexLot2Qty} setLatexLot2Qty={() => { }}
          preChk={preChk} setPreChk={() => { }}
          preItems45={preItems45}
          pre45Ok={true} pre45Asked={sessions.length > 0}
          sampleType={sampleType} setSampleType={() => { }}
          missingFields={[]}
          doPause={() => { }} doRecheck={() => { }} completePallet={async () => { }}
          undoLastRecheck={async () => { }}
          readOnly={true}
        />
      )}

      {/* Step 4 */}
      {pkStep === 4 && (
        <Step4PostCheck
          dc={dc} isIssueMode={false}
          lotId={lot.id} lotDept={lot.dept}
          postItems={postItemsDB}
          postChk={postChk} setPostChk={() => { }} postAS={null}
          latexStorageArea={latexStorageArea} setLatexStorageArea={() => { }}
          latexTagStatus={latexTagStatus} setLatexTagStatus={() => { }}
          latexTagBy={latexTagBy} setLatexTagBy={() => { }}
          postOk={true} onComplete={async () => { }}
          readOnly={true}
        />
      )}

      {/* Step 5 */}
      {pkStep === 5 && (
        <Step5Submit
          lot={packerLot} dc={dc}
          isIssueMode={false} pkStep={5}
          drumEnd={drumEnd} setDrumEnd={() => { }} drumEndAS={null}
          drumStart={drumStart} sessions={sessions}
          downtimeLogs={[]}
          currentUser={operatorsJson.length > 0 ? operatorsJson[0].name : ''}
          setPkStep={setPkStep}
          onSubmit={() => { }}
          setLots={() => { }}
          onBackToList={onBack || (() => { })}
          readOnly={true}
        />
      )}

      {/* Step navigation + optional decision bar */}
      <div className="sticky bottom-0 z-50 bg-[#F5F5F5] border-t border-[#DDE2EE] px-4 py-3 mt-4">
        <div className="flex items-center gap-2">
          <button
            disabled={pkStep === 0}
            onClick={() => setPkStep(p => Math.max(0, p - 1))}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-500 cursor-pointer disabled:opacity-40 bg-white">
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <div className="flex-1 text-center">
            <div className="text-[12px] text-[#9BA3BA]">Step {pkStep + 1} of 6</div>
          </div>
          <button
            disabled={pkStep === 5}
            onClick={() => setPkStep(p => Math.min(5, p + 1))}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1a3a6c] text-white cursor-pointer disabled:opacity-40 border-none">
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {(onApprove || onReject) && (
          <div className="mt-3 border-t border-[#DDE2EE] pt-3">
            {rejecting ? (
              <div>
                <textarea
                  value={decisionRemark}
                  onChange={e => setDecisionRemark(e.target.value)}
                  rows={2}
                  placeholder="Enter reason for rejection... (required)"
                  autoFocus
                  className="w-full box-border text-sm px-3 py-2.5 border border-[#E24B4A] rounded-lg resize-none outline-none mb-2.5 block"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setRejecting(false); setDecisionRemark('') }}
                    className="h-11 rounded-xl text-[13px] cursor-pointer bg-white border border-[#DDE2EE] text-[#9BA3BA]">
                    Cancel
                  </button>
                  <button
                    disabled={!decisionRemark.trim() || deciding}
                    onClick={async () => {
                      if (!decisionRemark.trim() || !onReject) return
                      setDeciding(true)
                      try { await onReject(decisionRemark.trim()) }
                      finally { setDeciding(false); setRejecting(false); setDecisionRemark('') }
                    }}
                    className="h-11 rounded-xl text-[13px] font-bold cursor-pointer border-none disabled:cursor-not-allowed"
                    style={{ background: decisionRemark.trim() && !deciding ? '#CC0000' : '#DDE2EE', color: decisionRemark.trim() && !deciding ? '#fff' : '#9BA3BA' }}>
                    {deciding ? 'Rejecting...' : 'Confirm Reject'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={`grid gap-2 ${onEditPlan && onReject && onApprove ? 'grid-cols-[1fr_1fr_2fr]'
                : onReject && onApprove ? 'grid-cols-[1fr_2fr]'
                  : 'grid-cols-1'
                }`}>
                {onReject && (
                  <button
                    onClick={() => setRejecting(true)}
                    className="flex items-center justify-center gap-1.5 h-11 rounded-xl text-[13px] font-bold cursor-pointer border-none bg-[#CC0000] text-white">
                    <XCircle size={16} />
                    Reject
                  </button>
                )}
                {onEditPlan && (
                  <button
                    onClick={onEditPlan}
                    className="flex items-center justify-center gap-1.5 h-11 rounded-xl text-[13px] font-bold cursor-pointer text-white"
                    style={{ backgroundColor: '#534AB7' }}>
                    <PencilLine size={16} />
                    Edit plan
                  </button>
                )}
                {onApprove && (
                  <button
                    disabled={deciding}
                    onClick={async () => {
                      setDeciding(true)
                      try { await onApprove() }
                      finally { setDeciding(false) }
                    }}
                    className="flex items-center justify-center gap-1.5 h-11 rounded-xl text-[13px] font-bold cursor-pointer border-none text-white disabled:opacity-60"
                    style={{ background: '#27500A' }}>
                    <CheckCircle2 size={16} />
                    {deciding ? 'Processing...' : approveLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}