'use client'
import React, { useState, useEffect } from 'react'
import { AlertTriangle, AlertOctagon, XCircle, ArrowLeft, ChevronRight, ChevronLeft, LogOut } from 'lucide-react'
import { DEPT, getWtStandard, isPerPalletChecklistItem } from '@/app/components/constants'
import type { MduMachine, LocalExportIbc, DrumMmType } from '@/app/components/constants'
import {
  Card,
  DeptBadge,
  useAutosave,
  LotStepBar, PauseControls, PausedCard,
  Badge,
  ConfirmModal,
} from '@/app/components/shared'
import { buildPlanFields } from '@/lib/planFields'
import { formatDate, fromThaiInputToUTC, toThaiTime, formatDuration, formatDowntimeDate } from '@/lib/utils'
import type { DeptKey } from '@/app/components/constants'

import type { Lot, Session, RecheckEntry, DowntimeLog, MduVals, PauseTypeKey, ApiChecklistItem } from './types'
import { useScalePoll } from './hooks/useScalePoll'
import { Step0Date } from './steps/Step0Date'
import { Step1Scale } from './steps/Step1Scale'
import { Step2PreCheck } from './steps/Step2PreCheck'
import { Step3Drumming } from './steps/Step3Drumming'
import { Step4PostCheck } from './steps/Step4PostCheck'
import { Step5Submit } from './steps/Step5Submit'


function getStandardWeight(drumSet?: string, custom?: string): number {
  if (!drumSet) return 210
  if (drumSet.includes('210')) return 210
  if (drumSet.includes('1000')) return 1000
  if (drumSet === 'อื่นๆ' && custom) return Number(custom) || 210
  return 210
}

function getTolerance(drumSet?: string, customTol?: string): number {
  if (drumSet === 'อื่นๆ' && customTol) return Number(customTol) || 0.5
  return 0.5
}

interface OperatorEntry {
  name: string
  action: 'start' | 'resume' | 'resubmit'
  time: string
}

interface PKFormProps {
  lot: Lot
  onBack: () => void
  onSubmit: (data: Record<string, unknown>) => void
  currentUser: string
  setLots: React.Dispatch<React.SetStateAction<Lot[]>>
}

export function PKForm({ lot, onBack, onSubmit, currentUser, setLots }: PKFormProps) {
  const dc = DEPT[lot.dept as DeptKey]?.accent || '#0F6E56'
  const fixStepMap: Record<string, number> = { checklist: 1, scale: 2, drumming: 3, amount: 3, submit: 5 }
  const initStep = lot.fixSection ? (fixStepMap[lot.fixSection] ?? 0) : (lot.current_pk_step ?? 0)
  const [pkStep, setPkStepRaw] = useState(initStep)

  async function savePkStep(step: number) {
    try {
      const payload: Record<string, unknown> = {
        current_pk_step: step,

        // Step 0
        operation_date: opDate || null,
        label_check: labelCheck || null,
        sl_follow: slFollow || null,
        label_remark: labelRemark || null,

        // Step 1
        mdu_machine: mduLocked || null,
        drum_set: mduVals.drumSet || null,
        recalibration: recalib || null,

        // Step 2
        empty_drum_wt: emptyDrumWt ? Number(emptyDrumWt) : null,
        sample_type: sampleType || null,

        // Step 3
        lot_drumming_start: drumStart ? fromThaiInputToUTC(`${opDate}T${drumStart}`) : null,
        batch_size_kg: batchSizeKg ? Number(batchSizeKg) : null,
        flush_kg: flushKg ? Number(flushKg) : null,
        purge_kg: purgeKg ? Number(purgeKg) : null,
        drain_kg: drainKg ? Number(drainKg) : null,
        ...(isTote ? {
          container_tote: containerQty ? Number(containerQty) : null,
          container_drum: capLarge ? Number(capLarge) : null,
        } : {
          container_drum: containerQty ? Number(containerQty) : null,
          container_tote: capLarge ? Number(capLarge) : null,
        }),
        cap_large: capSmall ? Number(capSmall) : null,
        cap_small: capXSmall ? Number(capXSmall) : null,
        actual_pallet_count: sessions.length > 0 ? sessions.length : null,

        // Step 5
        lot_drumming_end: drumEnd ? fromThaiInputToUTC(`${opDate}T${drumEnd}`) : null,
      }

      await fetch(`/api/lots/${lot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Save IBC-specific fields
      if (lot.dept === 'IBC') {
        await fetch(`/api/lots/${lot.id}/ibc`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operator_name: ibcOperatorName || null,
            quality_status_lab: ibcQualityStatus || null,
            residue_kg: ibcResidueKg || null,
            empty_before_kg: ibcEmptyBeforeKg || null,
            with_product_kg: ibcWithProductKg || null,
            product_net_kg: ibcProductNetKg || null,
          }),
        }).catch(e => console.error('[PKForm] IBC save failed:', e))
      }

      // Save Latex-specific fields
      if (lot.dept === 'Latex') {
        await fetch(`/api/lots/${lot.id}/latex`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            no_bacteria: latexNoBact || null,
            no_bacteria_by: latexNoBactBy || null,
            temperature_ok: latexTemp || null,
            temperature_by: latexTempBy || null,
            prev_product: latexPrevProductName || null,
            weight_set_by: latexPrevProduct || null,
            flush_kg: latexFlushKg || null,
            product_purge_kg: latexProductPurgeKg || null,
            drain_kg: latexDrainKg || null,
            total_kg: latexTotalKg || null,
            sample_collected: latexSample || null,
            drummer_name: latexDrummer || null,
            storage_area: latexStorageArea || null,
            tag_status: latexTagStatus || null,
            tag_checked_by: latexTagBy || null,
            lot1_qty: latexLot1Qty || null,
            lot2_qty: latexLot2Qty || null,
          }),
        }).catch(e => console.error('[PKForm] Latex save failed:', e))
      }

      // Save checklists on every navigation so isIssueMode/rejected nav persists answers
      if (Object.keys(preChk).length > 0) {
        await Promise.all(
          Object.entries(preChk).map(([itemId, value]) =>
            fetch('/api/checklist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                production_detail_id: lot.id,
                checklist_item_id: Number(itemId),
                phase: 'pre',
                response_value: value,
              }),
            })
          )
        ).catch(e => console.error('[PKForm] pre-checklist autosave failed:', e))
      }
      if (Object.keys(postChk).length > 0) {
        await Promise.all(
          Object.entries(postChk).map(([itemId, value]) =>
            fetch('/api/checklist', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                production_detail_id: lot.id,
                checklist_item_id: Number(itemId),
                phase: 'post',
                response_value: value,
              }),
            })
          )
        ).catch(e => console.error('[PKForm] post-checklist autosave failed:', e))
      }

    } catch (err) {
      console.error('[PKForm] save failed:', err)
    }
  }

  function setPkStep(s: number, skipAutosave = false) {
    setPkStepRaw(s)
    setLots(p => p.map(l => l.id === lot.id ? { ...l, current_pk_step: s } : l))
    if (!skipAutosave) {
      savePkStep(s).catch(err => console.error('[PKForm] step autosave failed:', err))
    }
  }

  const isIssueMode = ['paused_issue', 'paused_emergency', 'rejected'].includes(lot.status)
  const isLockedByPause = ['paused_shift_end', 'paused_issue', 'paused_emergency'].includes(lot.status)
  const isViewOnly = ['submitted', 'head_approved', 'sl_rejected', 'completed'].includes(lot.status)
  const forceReadOnly = isLockedByPause || isViewOnly

  // ── Operator tracking state ──────────────────────────────────
  const [operators, setOperators] = useState<OperatorEntry[]>([])

  async function saveOperators(ops: OperatorEntry[]) {
    await fetch(`/api/lots/${lot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operators_json: JSON.stringify(ops) }),
    }).catch(err => console.error('[PKForm] saveOperators failed:', err))
  }

  // ── Pause state ──────────────────────────────────────────────
  const [paused, setPaused] = useState(false)
  const [pauseType, setPauseType] = useState<PauseTypeKey | ''>('')
  const [showShiftEndConfirm, setShowShiftEndConfirm] = useState(false)
  const [downtimeLogs, setDowntimeLogs] = useState<DowntimeLog[]>([])
  const [approvalLogs, setApprovalLogs] = useState<any[]>([])
  const [openDowntimeId, setOpenDowntimeId] = useState<number | null>(null)
  const [openDowntimeStart, setOpenDowntimeStart] = useState<string>('')

  // ── Step 0 state ─────────────────────────────────────────────
  const todayDate = new Date().toISOString().slice(0, 10)
  const [opDate, setOpDate] = useState(todayDate)
  const opAS = useAutosave(opDate, () => { })
  const [labelCheck, setLabelCheck] = useState('')
  const [slFollow, setSlFollow] = useState('')
  const [labelRemark, setLabelRemark] = useState('')
  const [latexNoBact, setLatexNoBact] = useState('')
  const [latexNoBactBy, setLatexNoBactBy] = useState('')
  const [latexTemp, setLatexTemp] = useState('')
  const [latexTempBy, setLatexTempBy] = useState('')

  // ── IBC state (production_detail_ibc) ───────────────────────
  const [ibcOperatorName, setIbcOperatorName] = useState('')
  const [ibcQualityStatus, setIbcQualityStatus] = useState('')
  const [ibcResidueKg, setIbcResidueKg] = useState('')
  const [ibcEmptyBeforeKg, setIbcEmptyBeforeKg] = useState('')
  const [ibcWithProductKg, setIbcWithProductKg] = useState('')
  const [ibcProductNetKg, setIbcProductNetKg] = useState('')

  // ── Step 1 state ─────────────────────────────────────────────
  const [mduLocked, setMduLocked] = useState<string | null>(null)
  const [mduVals, setMduVals] = useState<MduVals>({})
  const stdWeight = getStandardWeight(mduVals.drumSet, mduVals.drumSetCustom)
  const tolerance = getTolerance(mduVals.drumSet, mduVals.customTolerance)
  const [recalib, setRecalib] = useState('')
  const [scaleApproved, setScaleApproved] = useState(false)
  const [scalePendingPL, setScalePendingPL] = useState(false)
  const [scaleVerificationId, setScaleVerificationId] = useState<number | null>(null)
  const [scaleApprovedBy, setScaleApprovedBy] = useState('')
  const [latexScaleRound, setLatexScaleRound] = useState(1)
  const [latexScale1Approved, setLatexScale1Approved] = useState(false)
  const [latexScale1Pending, setLatexScale1Pending] = useState(false)
  const [latexScale2Approved, setLatexScale2Approved] = useState(false)
  const [latexScale2Pending, setLatexScale2Pending] = useState(false)
  const [latexMdu1, setLatexMdu1] = useState<MduVals>({ drumSet: 'Tote Set 1000.0 Kg' })
  const [latexMdu2, setLatexMdu2] = useState<MduVals>({ drumSet: 'Tote Set 1000.0 Kg' })
  const [latexRound1By, setLatexRound1By] = useState('')
  const [latexRound2By, setLatexRound2By] = useState('')

  // ── Step 2 state ─────────────────────────────────────────────
  const [preChk, setPreChk] = useState<Record<number, string>>({})
  const preAS = useAutosave(preChk, () => { })
  const [emptyDrumWt, setEmptyDrumWt] = useState('')
  const [sampleType, setSampleType] = useState('')

  // ── Step 3 state ─────────────────────────────────────────────
  const [drumStart, setDrumStart] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
  const [flushKg, setFlushKg] = useState('')
  const [purgeKg, setPurgeKg] = useState('')
  const [drainKg, setDrainKg] = useState('')
  const [latexPrevProduct, setLatexPrevProduct] = useState('')
  const [latexPrevProductName, setLatexPrevProductName] = useState('')
  const [latexFlushKg, setLatexFlushKg] = useState('')
  const [latexSample, setLatexSample] = useState('')
  const [latexDrummer, setLatexDrummer] = useState('')
  const [latexLot1Qty, setLatexLot1Qty] = useState('')
  const [latexLot2Qty, setLatexLot2Qty] = useState('')
  const [latexProductPurgeKg, setLatexProductPurgeKg] = useState('')
  const [latexDrainKg, setLatexDrainKg] = useState('')
  const [latexTotalKg, setLatexTotalKg] = useState('')
  const drumAS = useAutosave({ drumStart, flushKg, purgeKg, drainKg }, () => { })
  const [sessions, setSessions] = useState<Session[]>([])
  const [drummingSessionId, setDrummingSessionId] = useState<number | null>(null)
  const [palletNo, setPalletNo] = useState(1)
  const [wtMachine, setWtMachine] = useState<MduMachine | ''>('')
  const [wtCategory, setWtCategory] = useState<LocalExportIbc | ''>('')
  const [wtDrumType, setWtDrumType] = useState<DrumMmType | ''>('')
  const [wtIbcSub, setWtIbcSub] = useState<'Local' | 'Export' | ''>('')
  const [sessionWt, setSessionWt] = useState('')
  const [recheckList, setRecheckList] = useState<RecheckEntry[]>([])
  const [recheckDone, setRecheckDone] = useState(false)
  const [isCompletingPallet, setIsCompletingPallet] = useState(false)
  const [batchSizeKg, setBatchSizeKg] = useState('')
  const [containerQty, setContainerQty] = useState('')
  const [capLarge, setCapLarge] = useState('')
  const [capSmall, setCapSmall] = useState('')
  const [capXSmall, setCapXSmall] = useState('')
  const lotRecordAS = useAutosave({ batchSizeKg, containerQty, capLarge, capSmall, capXSmall }, () => { })

  // ── Checklist items from DB (keyed by item.id) ───────────────
  const [preItemsDB, setPreItemsDB] = useState<ApiChecklistItem[]>([])
  const [postItemsDB, setPostItemsDB] = useState<ApiChecklistItem[]>([])

  // ── Step 4 state ─────────────────────────────────────────────
  const [latexStorageArea, setLatexStorageArea] = useState('')
  const [latexTagStatus, setLatexTagStatus] = useState('')
  const [latexTagBy, setLatexTagBy] = useState('')
  const [postChk, setPostChk] = useState<Record<number, string>>({})
  const postAS = useAutosave(postChk, () => { })

  // ── Step 5 state ─────────────────────────────────────────────
  const [drumEnd, setDrumEnd] = useState('')
  const drumEndAS = useAutosave(drumEnd, () => { })

  // ── Init: load existing scale verification ────────────────────
  useEffect(() => {
    if (!lot.id) return
    fetch(`/api/scale-verifications?production_detail_id=${lot.id}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) return

        if (lot.dept === 'Latex') {
          const r1 = data.find((v: any) => v.round_no === 1)
          const r2 = data.find((v: any) => v.round_no === 2)
          const deriveDrumSet = (stdKg: unknown) => {
            const w = Number(stdKg)
            if (w === 210) return 'Drum Set 210.0 Kg'
            if (w === 1000) return 'Tote Set 1000.0 Kg'
            return 'อื่นๆ'
          }
          if (r1?.pl_approved_at || r1?.is_locked) {
            setLatexScale1Approved(true)
            setLatexScale1Pending(false)
            if (r1.standard_weight_kg != null)
              setLatexMdu1(p => ({ ...p, drumSet: deriveDrumSet(r1.standard_weight_kg) }))
            if (r1.measured_weight_kg)
              setLatexMdu1(p => ({ ...p, w: String(r1.measured_weight_kg) }))
            if (r1.recalibration_required != null)
              setLatexMdu1(p => ({ ...p, recalib: r1.recalibration_required ? 'Yes' : 'No' }))
            if (r1.pl_approver?.full_name) setLatexRound1By(r1.pl_approver.full_name)
          } else if (r1) {
            setLatexScale1Pending(true)
            if (r1.standard_weight_kg != null)
              setLatexMdu1(p => ({ ...p, drumSet: deriveDrumSet(r1.standard_weight_kg) }))
            if (r1.measured_weight_kg)
              setLatexMdu1(p => ({ ...p, w: String(r1.measured_weight_kg) }))
            if (r1.recalibration_required != null)
              setLatexMdu1(p => ({ ...p, recalib: r1.recalibration_required ? 'Yes' : 'No' }))
          }
          if (r2?.pl_approved_at || r2?.is_locked) {
            setLatexScale2Approved(true)
            setLatexScale2Pending(false)
            if (r2.standard_weight_kg != null)
              setLatexMdu2(p => ({ ...p, drumSet: deriveDrumSet(r2.standard_weight_kg) }))
            if (r2.measured_weight_kg)
              setLatexMdu2(p => ({ ...p, w: String(r2.measured_weight_kg) }))
            if (r2.recalibration_required != null)
              setLatexMdu2(p => ({ ...p, recalib: r2.recalibration_required ? 'Yes' : 'No' }))
            if (r2.pl_approver?.full_name) setLatexRound2By(r2.pl_approver.full_name)
          } else if (r2) {
            setLatexScale2Pending(true)
            if (r2.standard_weight_kg != null)
              setLatexMdu2(p => ({ ...p, drumSet: deriveDrumSet(r2.standard_weight_kg) }))
            if (r2.measured_weight_kg)
              setLatexMdu2(p => ({ ...p, w: String(r2.measured_weight_kg) }))
            if (r2.recalibration_required != null)
              setLatexMdu2(p => ({ ...p, recalib: r2.recalibration_required ? 'Yes' : 'No' }))
          }
        } else {
          const anyApproved = data.some((v: any) =>
            v.is_locked === true || v.pl_approved_at !== null
          )
          const anyPending = data.some((v: any) =>
            !v.pl_approved_at && !v.is_locked
          )
          // Restore latest record fields
          const latest = data[0]
          if (latest.measured_weight_kg)
            setMduVals(p => ({ ...p, w: String(latest.measured_weight_kg) }))
          if (latest.machine_code) {
            setMduLocked(latest.machine_code)
            // Auto-fill wtMachine for PU/PUF from approved scale verification
            if (lot.dept === 'PU' || lot.dept === 'PUF') {
              const mc = String(latest.machine_code).replace(/\s/g, '')
              if (mc === 'MDU2450' || mc === '2450') setWtMachine('MDU2450')
              else if (mc === 'MDU2451' || mc === '2451' || mc === 'MDU2452' || mc === '2452' ||
                mc.includes('2451') || mc.includes('2452'))
                setWtMachine('MDU2451/52')
            }
          }
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
          if (latest.recalibration_required !== null)
            setRecalib(latest.recalibration_required ? 'Yes' : 'No')

          const approvedRecord = data.find((v: any) => v.pl_approved_at)
          if (approvedRecord?.pl_approver?.full_name) setScaleApprovedBy(approvedRecord.pl_approver.full_name)

          if (anyApproved) {
            setScaleApproved(true)
            setScalePendingPL(false)
          } else if (anyPending) {
            setScalePendingPL(true)
          }
        }
      })
      .catch(() => { })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  // ── Init: load saved form data from DB ───────────────────────
  useEffect(() => {
    if (!lot.id) return

    async function loadLotData() {
      try {
        const res = await fetch(`/api/lots/${lot.id}`)
        if (!res.ok) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json()
        // Step 0
        if (data.operation_date) setOpDate(String(data.operation_date).slice(0, 10))
        if (data.label_check) setLabelCheck(data.label_check)
        if (data.sl_follow) setSlFollow(data.sl_follow)
        if (data.label_remark) setLabelRemark(data.label_remark)

        // Step 1
        if (data.mdu_machine) setMduLocked(data.mdu_machine)
        if (data.recalibration) setRecalib(data.recalibration)
        if (data.drum_set) setMduVals(p => ({ ...p, drumSet: data.drum_set }))

        // Step 2
        if (data.empty_drum_wt) setEmptyDrumWt(String(data.empty_drum_wt))
        if (data.sample_type) setSampleType(data.sample_type)

        // Step 3
        if (data.lot_drumming_start) {
          const t = String(data.lot_drumming_start)
          setDrumStart(t.includes('T') ? toThaiTime(t) : t)
        }
        if (data.batch_size_kg) setBatchSizeKg(String(data.batch_size_kg))
        if (data.flush_kg) setFlushKg(String(data.flush_kg))
        if (data.purge_kg) setPurgeKg(String(data.purge_kg))
        if (data.drain_kg) setDrainKg(String(data.drain_kg))

        // ── Auto-fill PU/PUF weight selection from lot data ──────
        // ดึงชื่อ packaging type จาก join relation
        const dept = data.dept || lot.dept
        if (dept === 'PU' || dept === 'PUF') {
          const pkgName: string =
            (data.packaging_type as any)?.name ??
            data.packaging ??
            ''
          const pkgLower = pkgName.toLowerCase()
          const isTotePkg = pkgLower.includes('tote') || pkgLower.includes('ibc')

          if (isTotePkg) {
            // Tote: wtCategory = 'IBC Tote', Local/Export ไปที่ wtIbcSub แทน
            setWtCategory('IBC Tote')
            if (data.export_on_pallet != null) {
              setWtIbcSub(data.export_on_pallet ? 'Export' : 'Local')
            }
          } else {
            // Drum: wtCategory = Local/Export, wtDrumType จากชื่อ packaging
            if (data.export_on_pallet != null) {
              setWtCategory(data.export_on_pallet ? 'Export' : 'Local')
            }
            if (pkgName.includes('1.0')) setWtDrumType('Drum 1.0mm')
            else if (pkgName.includes('1.2')) setWtDrumType('Drum 1.2mm')
            else if (pkgName.includes('1.5')) setWtDrumType('Drum 1.5mm')
          }
        }
        if (isTote) {
          if (data.container_tote) setContainerQty(String(data.container_tote))
          if (data.container_drum) setCapLarge(String(data.container_drum))
        } else {
          if (data.container_drum) setContainerQty(String(data.container_drum))
          if (data.container_tote) setCapLarge(String(data.container_tote))
        }
        if (data.cap_large) setCapSmall(String(data.cap_large))
        if (data.cap_small) setCapXSmall(String(data.cap_small))

        // Step 5
        if (data.lot_drumming_end) {
          const t = String(data.lot_drumming_end)
          setDrumEnd(t.includes('T') ? toThaiTime(t) : t)
        }

        // Operators — restore existing history, or record the very first "start" entry
        // only if this lot has genuinely never been opened before (no prior operators_json).
        let restoredOps: OperatorEntry[] = []
        if (data.operators_json) {
          try {
            const ops = JSON.parse(data.operators_json)
            if (Array.isArray(ops)) restoredOps = ops
          } catch { }
        }
        if (restoredOps.length > 0) {
          setOperators(restoredOps)
        } else if (lot.status === 'in_progress' && currentUser) {
          const entry: OperatorEntry = {
            name: currentUser,
            action: 'start',
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          }
          setOperators([entry])
          await saveOperators([entry])
        }

        // IBC fields (from production_detail_ibc nested object)
        if (data.production_detail_ibc) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ibc: any = data.production_detail_ibc
          if (ibc.operator_name) setIbcOperatorName(ibc.operator_name)
          if (ibc.quality_status_lab) setIbcQualityStatus(ibc.quality_status_lab)
          if (ibc.residue_kg) setIbcResidueKg(String(ibc.residue_kg))
          if (ibc.empty_before_kg) setIbcEmptyBeforeKg(String(ibc.empty_before_kg))
          if (ibc.with_product_kg) setIbcWithProductKg(String(ibc.with_product_kg))
          if (ibc.product_net_kg) setIbcProductNetKg(String(ibc.product_net_kg))
        }

        // Latex fields (from latex_drumming_data nested object)
        // DB stores Boolean for no_bacteria/temp_below_40c — convert back to UI strings
        if (data.latex_drumming_data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const lx: any = data.latex_drumming_data
          if (lx.no_bacteria !== null && lx.no_bacteria !== undefined) setLatexNoBact(lx.no_bacteria ? 'ใช่' : 'ไม่ใช่')
          if (lx.no_bacteria_by) setLatexNoBactBy(lx.no_bacteria_by)
          if (lx.temp_below_40c !== null && lx.temp_below_40c !== undefined) setLatexTemp(lx.temp_below_40c ? 'ใช่' : 'ไม่ใช่')
          if (lx.temp_by) setLatexTempBy(lx.temp_by)
          if (lx.prev_product_loaded) setLatexPrevProductName(lx.prev_product_loaded)
          if (lx.weight_set_by) setLatexPrevProduct(lx.weight_set_by)
          if (lx.drummer_name) setLatexDrummer(lx.drummer_name)
          if (lx.flush_before_drumming_kg) setLatexFlushKg(String(lx.flush_before_drumming_kg))
          if (lx.product_purge_kg) setLatexProductPurgeKg(String(lx.product_purge_kg))
          if (lx.drain_kg) setLatexDrainKg(String(lx.drain_kg))
          if (lx.total_kg) setLatexTotalKg(String(lx.total_kg))
          if (lx.lab_sample_detail) setLatexSample(lx.lab_sample_detail)
          if (lx.storage_area_by) setLatexStorageArea(lx.storage_area_by)
          if (lx.tag_status) setLatexTagStatus(lx.tag_status)
          if (lx.tag_checked_by) setLatexTagBy(lx.tag_checked_by)
          if (lx.lot1_qty) setLatexLot1Qty(String(lx.lot1_qty))
          if (lx.lot2_qty) setLatexLot2Qty(String(lx.lot2_qty))
        }

      } catch (err) {
        console.error('[PKForm] load failed:', err)
      }
    }

    loadLotData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  // ── Init: restore drumming session + pallet rechecks ──────────
  useEffect(() => {
    if (!lot.id) return

    async function restoreDrummingSession() {
      try {
        const sessRes = await fetch(`/api/drumming-sessions?production_detail_id=${lot.id}`)
        if (!sessRes.ok) return
        const sessList = await sessRes.json()
        if (!Array.isArray(sessList) || sessList.length === 0) return

        const latest = sessList[sessList.length - 1]
        setDrummingSessionId(latest.id)

        const recheckRes = await fetch(`/api/recheck-weights?drumming_session_id=${latest.id}`)
        if (!recheckRes.ok) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const weights: any[] = await recheckRes.json()
        if (!Array.isArray(weights) || weights.length === 0) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const palletMap = new Map<number, any>()
        weights.forEach(w => {
          const existing = palletMap.get(w.pallet_no)
          if (!existing || w.attempt_no > existing.attempt_no) {
            palletMap.set(w.pallet_no, w)
          }
        })

        // Fetch per-pallet checklist data (items 4-5)
        const perPalletMap: Record<number, Record<number, string>> = {}
        try {
          const chkRes = await fetch(`/api/checklist?production_detail_id=${lot.id}`)
          if (chkRes.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chkData: any[] = await chkRes.json()
            chkData.forEach(r => {
              if (r.phase === 'pre' && r.pallet_no != null) {
                if (!perPalletMap[r.pallet_no]) perPalletMap[r.pallet_no] = {}
                perPalletMap[r.pallet_no][r.checklist_item_id] = r.response_value
              }
            })
          }
        } catch { }

        const attemptsByPallet = new Map<number, any[]>()
        weights.forEach((w: any) => {
          if (!attemptsByPallet.has(w.pallet_no)) attemptsByPallet.set(w.pallet_no, [])
          attemptsByPallet.get(w.pallet_no)!.push(w)
        })

        const restoredSessions: Session[] = Array.from(palletMap.entries())
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
              startTime: drumStart,
              pass: !w.fail_reason,
              wt: String(w.weight_kg || ''),
              ok: !w.fail_reason,
              preChk45: perPalletMap[pallet_no] ?? undefined,
            }
          })

        setSessions(restoredSessions)
        if (restoredSessions.length < totalP) {
          setPalletNo(restoredSessions.length + 1)
          setRecheckDone(false)
        } else {
          setPalletNo(totalP)
          setRecheckDone(true)
        }

        const lastPalletWeights = restoredSessions.length > 0
          ? weights.filter(w => w.pallet_no === restoredSessions[restoredSessions.length - 1].no)
          : []
        if (lastPalletWeights.length > 0) {
          setRecheckList(
            lastPalletWeights
              .sort((a: any, b: any) => (a.attempt_no ?? 0) - (b.attempt_no ?? 0))
              .map((w: any, i: number) => ({ no: i + 1, wt: String(w.weight_kg || ''), pass: !w.fail_reason }))
          )
        }

      } catch (err) {
        console.error('[PKForm] drumming session restore failed:', err)
      }
    }

    restoreDrummingSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  // ── Init: load saved checklist responses from DB ──────────────
  useEffect(() => {
    if (!lot.id) return

    async function loadChecklists() {
      try {
        const [itemsRes, responsesRes] = await Promise.all([
          fetch(`/api/checklist-items?form_type=${lot.dept}`),
          fetch(`/api/checklist?production_detail_id=${lot.id}`),
        ])
        if (!itemsRes.ok || !responsesRes.ok) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: ApiChecklistItem[] = await itemsRes.json()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responses: any[] = await responsesRes.json()

        if (!Array.isArray(responses) || !Array.isArray(items)) return

        setPreItemsDB(items.filter(i => i.phase === 'pre'))
        setPostItemsDB(items.filter(i => i.phase === 'post'))

        const preMap: Record<number, string> = {}
        const postMap: Record<number, string> = {}

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responses.forEach((resp: any) => {
          if (resp.phase === 'pre') preMap[resp.checklist_item_id] = resp.response_value
          if (resp.phase === 'post') postMap[resp.checklist_item_id] = resp.response_value
        })

        if (Object.keys(preMap).length > 0) {
          setPreChk(preMap)
        }
        if (Object.keys(postMap).length > 0) {
          setPostChk(postMap)
        }
      } catch (err) {
        console.error('[PKForm] checklist load failed:', err)
      }
    }

    loadChecklists()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id, lot.dept])

  // ── Init: restore pause state from lot.status on mount ──
  useEffect(() => {
    const pauseStatuses = [
      'paused_issue',
      'paused_emergency',
      'paused_shift_end'
    ]
    if (!pauseStatuses.includes(lot.status)) return

    setPaused(true)
    setPauseType(lot.status as PauseTypeKey)

    fetch(`/api/downtime?production_detail_id=${lot.id}&open=true`)
      .then(r => r.json())
      .then(log => {
        if (log?.id) {
          setOpenDowntimeId(log.id)
          setOpenDowntimeStart(log.start_time)
        }
      })
      .catch(() => { })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  // ── Init: fetch all historical downtime logs ──────────────────
  useEffect(() => {
    if (!lot.id) return
    fetch(`/api/downtime?production_detail_id=${lot.id}`)
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any[]) => {
        if (!Array.isArray(data)) return
        setDowntimeLogs(data
          .filter(d => d.end_time != null)
          .map(d => ({
            start: d.start_time,
            end: d.end_time,
            type: d.downtime_type,
            reason: d.reason || '',
          })))
      })
      .catch(() => { })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  // ── Init: fetch approval logs for PL rejection history ────────
  useEffect(() => {
    if (!lot.id) return
    fetch(`/api/approval-logs?production_detail_id=${lot.id}`)
      .then(r => r.json())
      .then((data: any[]) => { if (Array.isArray(data)) setApprovalLogs(data) })
      .catch(() => { })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.id])

  // ── Scale approval polling ────────────────────────────────────
  useScalePoll({
    lot, scalePendingPL, scaleApproved, setScaleApproved, setScalePendingPL, setScaleApprovedBy,
    latexScale1Pending, latexScale1Approved, setLatexScale1Approved, setLatexScale1Pending,
    latexScale2Pending, latexScale2Approved, setLatexScale2Approved, setLatexScale2Pending,
  })

  // ── Derived checklist data (keyed by item.id) ────────────────
  // Items #4 and #5 (item_order 4, 5) are per-pallet, asked only on Pallet #1.
  // PUF/PU/IBC have 5 pre items; Latex has only 3 and no per-pallet items.
  const preItems = preItemsDB.filter(i => !isPerPalletChecklistItem(i.item_label))
  const preItems45 = preItemsDB.filter(i => isPerPalletChecklistItem(i.item_label))

  const preOk = preItems.length > 0 && preItems.every((item, i) => {
    if (!preChk[item.id]) return false
    if (i === 2 && preChk[item.id] === 'Yes' && !emptyDrumWt.trim()) return false
    return true
  })
  const preFail = preItems.some((item, i) => i !== 2 && preChk[item.id] === 'No')
  const pre45Ok = (() => {
    if (palletNo > 1) return true        // only asked on pallet #1
    if (preItems45.length === 0) return true
    const item4 = preItems45[0]
    const item5 = preItems45[1]
    const a4 = item4 ? preChk[item4.id] : undefined
    if (!a4 || a4 === 'No') return false
    if (!item5) return true
    const a5 = item5 ? preChk[item5.id] : undefined
    if (!a5 || a5 === 'No') return false
    if (a5 === 'Yes' && !sampleType) return false
    return true
  })()
  const pre45Asked = recheckDone && palletNo === 1

  // ── Recheck weight ────────────────────────────────────────────
  const wtStandard = (
    wtMachine && wtCategory &&
    (wtCategory !== 'IBC Tote'
      ? !!wtDrumType
      : (wtMachine === 'MDU2450' || !!wtIbcSub))
  )
    ? getWtStandard(
      wtMachine as MduMachine,
      wtCategory as LocalExportIbc,
      wtCategory === 'IBC Tote' ? null : (wtDrumType as DrumMmType),
      wtIbcSub as 'Local' | 'Export' | undefined || undefined,
    )
    : null
  const wPass = wtStandard != null && sessionWt !== '' &&
    Math.abs(Number(sessionWt) - wtStandard.ref) <= wtStandard.tol
  const wFail = wtStandard != null && sessionWt !== '' && !wPass

  // ── Computed ──────────────────────────────────────────────────
  const latexPostOk = lot.dept !== 'Latex' || (
    !!latexStorageArea.trim() && !!latexTagStatus.trim() && !!latexTagBy.trim()
  )
  const postOk = postItemsDB.length > 0 && postItemsDB.every(item => !!postChk[item.id]) && latexPostOk
  const totalP = lot.planned_pallets || 0
  const isTote = (lot.packaging || '').toLowerCase().includes('tote') || (lot.packaging || '').toLowerCase().includes('ibc')
  const showPause = !paused && lot.status !== 'pl_review' && (pkStep <= 2 || pkStep === 3 || pkStep === 4)
  const pausePre = pkStep !== 3

  // ── Step 0 validation (mirrors Step0Date.tsx nextDisabled exactly) ──
  const latexPreScaleOk = lot.dept !== 'Latex' || (
    !!latexNoBact && !!latexNoBactBy && !!latexTemp && !!latexTempBy
  )
  const step0NextDisabled =
    !opDate ||
    !labelCheck ||
    (labelCheck === 'no' && (!slFollow || (slFollow === 'label' && !labelRemark) || slFollow === 'system')) ||
    !latexPreScaleOk

  // ── Step 3 validation (lifted from Step3Drumming.tsx) ────────
  const allPalletsDone = sessions.length >= totalP
  const isCompletingLastPallet = sessions.length + 1 >= totalP
  const step3MissingFields: string[] = []
  if (!drumStart) step3MissingFields.push('Drumming start time')
  if (isCompletingLastPallet) {
    if (lot.dept === 'Latex') {
      if (!latexPrevProduct.trim()) step3MissingFields.push('Set น้ำหนักที่ Auto Drumming โดย')
      if (!latexPrevProductName.trim()) step3MissingFields.push('Product ที่โหลดก่อนหน้านี้')
      if (!latexSample.trim()) step3MissingFields.push('เก็บ Sample ส่ง Lab')
      if (!latexDrummer.trim()) step3MissingFields.push('ผู้ที่ทำการ drumming')
      if (!latexFlushKg.trim()) step3MissingFields.push('จำนวน Product ที่ flush ก่อนการ drumming (kg)')
    }
    if (lot.dept === 'Latex') {
      if (!latexProductPurgeKg.trim()) step3MissingFields.push('Product Purge (kg)')
      if (!latexDrainKg.trim()) step3MissingFields.push('Drain (kg)')
      if (!latexTotalKg.trim()) step3MissingFields.push('Total (kg)')
    } else {
      if (!flushKg.trim()) step3MissingFields.push('Flush (kg)')
      if (!purgeKg.trim()) step3MissingFields.push('Purge (kg)')
      if (!drainKg.trim()) step3MissingFields.push('Drain (kg)')
    }
    if (!batchSizeKg.trim()) step3MissingFields.push('Batch size (kg)')
    if (lot.dept === 'Latex') {
      if (!latexLot1Qty.trim()) step3MissingFields.push('Lot 1 — Drum/Tote (ใบ)')
      if (!latexLot2Qty.trim()) step3MissingFields.push('Lot 2 — Drum/Tote (ใบ)')
    } else {
      if (!containerQty.trim()) step3MissingFields.push(isTote ? 'Tote (ใบ)' : 'Drum (ใบ)')
      if (!capLarge.trim()) step3MissingFields.push(isTote ? 'Drum (ใบ)' : 'Tote (ใบ)')
      if (!capSmall.trim()) step3MissingFields.push('ฝา Cap ใหญ่ (ใบ)')
      if (!capXSmall.trim()) step3MissingFields.push('ฝา Cap เล็ก (ใบ)')
    }
  }

  // ── canProceed per step (bottom nav gate) ────────────────────
  const step1ScaleOk = lot.dept === 'Latex'
    ? latexScale1Approved && latexScale2Approved
    : scaleApproved
  const canProceed = (() => {
    switch (pkStep) {
      case 0: return !step0NextDisabled
      case 1: return step1ScaleOk
      case 2: return preOk && !preFail
      case 3: return allPalletsDone && !(pre45Asked && !pre45Ok) && step3MissingFields.length === 0
      case 4: return postOk
      default: return false
    }
  })()

  // ── Handlers ─────────────────────────────────────────────────
  async function doPause(type: string) {
    const pauseStatus = type as PauseTypeKey

    // Update local render state immediately so PausedCard shows without waiting for awaits
    setPaused(true)
    setPauseType(pauseStatus)

    await fetch(`/api/lots/${lot.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: pauseStatus }),
    }).catch(err => { console.error('[PKForm] pause status failed:', err); return null })

    // paused_shift_end doesn't create a downtime log (no issue/emergency data to record)
    if (pauseStatus === 'paused_issue' || pauseStatus === 'paused_emergency') {
      const downtimeType = pauseStatus === 'paused_emergency' ? 'emergency' : 'issue'
      const dtRes = await fetch('/api/downtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_detail_id: lot.id,
          downtime_type: downtimeType,
          start_time: new Date().toISOString(),
          reason: '',
        }),
      }).catch(err => { console.error('[PKForm] downtime log failed:', err); return null })
      if (dtRes?.ok) {
        const dtBody = await dtRes.json().catch(() => null)
        if (dtBody?.id) {
          setOpenDowntimeId(dtBody.id)
          setOpenDowntimeStart(dtBody.start_time || new Date().toISOString())
        }
      }
    }

    // setLots last — overrides any stale poll write that landed during the awaits
    setLots(p => p.map(l =>
      l.id === lot.id
        ? { ...l, status: pauseStatus as typeof l.status, current_pk_step: pkStep }
        : l
    ))
  }

  async function doResume(dtData?: DowntimeLog) {
    if (dtData?.type && dtData?.reason) {
      setDowntimeLogs(p => [...p, dtData])

      const logId = openDowntimeId

      if (logId) {
        await fetch(`/api/downtime/${logId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            end_time: dtData.end || new Date().toISOString(),
            reason: dtData.reason,
          }),
        }).catch(err => { console.error('[PKForm] close downtime log failed:', err) })
      } else {
        // Fallback: fetch open log
        const openLog = await fetch(
          `/api/downtime?production_detail_id=${lot.id}&open=true`
        ).then(r => r.json()).catch(() => null)

        if (openLog?.id) {
          await fetch(`/api/downtime/${openLog.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              end_time: dtData.end || new Date().toISOString(),
              reason: dtData.reason,
            }),
          }).catch(err => { console.error('[PKForm] fallback close downtime log failed:', err) })
        }
      }
    }

    await fetch(`/api/lots/${lot.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    })

    setLots(p => p.map(l =>
      l.id === lot.id
        ? { ...l, status: 'in_progress' as typeof l.status }
        : l
    ))

    // Clear pause state
    setOpenDowntimeId(null)
    setOpenDowntimeStart('')
    setPaused(false)
    setPauseType('')

    // Record resuming operator — compute array explicitly so we can await the save
    const resumeEntry: OperatorEntry = {
      name: dtData?.newOperator || currentUser,
      action: 'resume',
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
    const updatedOperators = [...operators, resumeEntry]
    setOperators(updatedOperators)
    await saveOperators(updatedOperators)
  }
  async function recordResubmitOperator() {
    const entry: OperatorEntry = {
      name: currentUser,
      action: 'resubmit',
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
    const updatedOperators = [...operators, entry]
    setOperators(updatedOperators)
    await saveOperators(updatedOperators)
  }

  async function ensureDrummingSession(): Promise<number | null> {
    if (drummingSessionId) return drummingSessionId
    try {
      const res = await fetch('/api/drumming-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_detail_id: lot.id,
          session_no: 1,
        }),
      })
      if (res.ok) {
        const sess = await res.json()
        setDrummingSessionId(sess.id)
        return sess.id as number
      }
    } catch (err) {
      console.error('[PKForm] drumming session create failed:', err)
    }
    return null
  }

  function doRecheck() {
    const isLastPallet = sessions.length + 1 === totalP
    const skipWeightCheck = lot.dept === 'IBC' || lot.dept === 'Latex'
    const pass = isLastPallet || skipWeightCheck ? true : !!wPass
    setRecheckList(p => [...p, { no: p.length + 1, wt: sessionWt, pass }])
    if (pass) setRecheckDone(true)
    else setSessionWt('')
  }

  async function undoLastRecheck() {
    if (!drummingSessionId) return
    try {
      // ดึงรายการ recheck_weight_logs ของ session นี้ แล้วลบรายการล่าสุดออก
      const res = await fetch(`/api/recheck-weights?drumming_session_id=${drummingSessionId}`)
      if (!res.ok) return
      const logs: { id: number }[] = await res.json()
      if (logs.length === 0) return
      const lastId = logs[logs.length - 1].id
      await fetch(`/api/recheck-weights/${lastId}`, { method: 'DELETE' })
    } catch (err) {
      console.error('[undoLastRecheck]', err)
    }
    // Reset UI ให้กรอกน้ำหนักใหม่ได้
    setRecheckList(p => p.slice(0, -1))
    setRecheckDone(false)
    setSessionWt('')
  }

  async function clearAllWeights() {
    try {
      await fetch(`/api/recheck-weights?production_detail_id=${lot.id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('[clearAllWeights]', err)
    }
    // reset state ทั้งหมดกลับจุดเริ่มต้น Step 3
    setSessions([])
    setPalletNo(1)
    setSessionWt('')
    setRecheckList([])
    setRecheckDone(false)
    setDrummingSessionId(null)
  }

  async function completePallet() {
    if (sessions.length >= totalP) {
      console.warn('[completePallet] blocked — already at totalP, ignoring duplicate call')
      return
    }
    if (isCompletingPallet) {
      console.warn('[completePallet] blocked — already in progress')
      return
    }
    setIsCompletingPallet(true)
    try {
      // Capture checklist items 4-5 snapshot — pallet #1 only
      const preChk45Snapshot: Record<number, string> = {}
      if (palletNo === 1) {
        for (const item of preItems45) {
          if (preChk[item.id]) preChk45Snapshot[item.id] = preChk[item.id]
        }
      }

      const s: Session = {
        no: palletNo, recheck: recheckList,
        startTime: drumStart, pass: true,
        wt: sessionWt || undefined,
        preChk45: palletNo === 1 && Object.keys(preChk45Snapshot).length > 0 ? preChk45Snapshot : undefined,
        sampleType: palletNo === 1 ? (sampleType || undefined) : undefined,
      }
      const updatedSessions = [...sessions, s]
      setSessions(updatedSessions)

      const sessionId = await ensureDrummingSession()

      if (sessionId) {
        // Save final pass weight for this pallet
        await fetch('/api/recheck-weights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            drumming_session_id: sessionId,
            pallet_no: palletNo,
            attempt_no: recheckList.length + 1,
            weight_kg: Number(sessionWt) || null,
            fail_reason: null,
            action_taken: null,
          }),
        }).catch(err => console.error('[completePallet] recheck save:', err))

        // Also save failed recheck attempts leading up to the pass
        if (recheckList.length > 0) {
          await Promise.all(
            recheckList
              .filter(r => !r.pass)
              .map((r, i) =>
                fetch('/api/recheck-weights', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    drumming_session_id: sessionId,
                    pallet_no: palletNo,
                    attempt_no: i + 1,
                    weight_kg: Number(r.wt) || null,
                    fail_reason: wtStandard && Number(r.wt) < wtStandard.ref ? 'underweight' : 'overweight',
                    action_taken: 'adjusted',
                  }),
                })
              )
          )
        }
      }

      // Save per-pallet checklist items 4-5
      if (Object.keys(preChk45Snapshot).length > 0) {
        await Promise.all(
          preItems45
            .filter(item => preChk45Snapshot[item.id])
            .map(item =>
              fetch('/api/checklist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  production_detail_id: lot.id,
                  checklist_item_id: item.id,
                  phase: 'pre',
                  response_value: preChk45Snapshot[item.id],
                  pallet_no: palletNo,
                }),
              })
            )
        ).catch(err => console.error('[completePallet] checklist save:', err))
      }

      // ← save ทุกครั้ง ไม่ว่าจะครบหรือยังไม่ครบ
      try {
        await fetch(`/api/lots/${lot.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lot_drumming_start: drumStart ? fromThaiInputToUTC(`${opDate}T${drumStart}`) : null,
            batch_size_kg: Number(batchSizeKg) || null,
            flush_kg: Number(flushKg) || null,
            purge_kg: Number(purgeKg) || null,
            drain_kg: Number(drainKg) || null,
            ...(isTote ? {
              container_tote: containerQty ? Number(containerQty) : null,
              container_drum: capLarge ? Number(capLarge) : null,
            } : {
              container_drum: containerQty ? Number(containerQty) : null,
              container_tote: capLarge ? Number(capLarge) : null,
            }),
            cap_large: capSmall ? Number(capSmall) : null,
            cap_small: capXSmall ? Number(capXSmall) : null,
            actual_pallet_count: updatedSessions.length,
            current_pk_step: updatedSessions.length < totalP ? 3 : 4,
          }),
        })
      } catch (err) {
        console.error('[PKForm] drumming save failed:', err)
      }

      if (updatedSessions.length < totalP) {
        setPalletNo(n => n + 1)
        setSessionWt('')
        setRecheckList([])
        setRecheckDone(false)
      } else {
        // Close drumming session
        if (sessionId) {
          await fetch(`/api/drumming-sessions/${sessionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_status: 'completed' }),
          }).catch(err => console.error('[completePallet] close session:', err))
        }
        setPkStep(4)
      }
    } finally {
      setIsCompletingPallet(false)
    }
  }

  async function handleNextStep() {
    switch (pkStep) {
      case 0:
        if (lot.status === 'waiting') {
          await fetch(`/api/lots/${lot.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in_progress' }),
          })
          setLots(p => p.map(l =>
            l.id === lot.id ? { ...l, status: 'in_progress' as typeof l.status } : l
          ))
        }
        setPkStep(1)
        break
      case 1:
        setPkStep(2)
        break
      case 2:
        await ensureDrummingSession()
        setPkStep(3)
        break
      case 3:
        // allPalletsDone is true (canProceed gate) — pallets already saved, just advance
        setPkStep(4)
        break
      case 4:
        await onPostChkComplete()
        break
    }
  }

  async function onPostChkComplete() {
    const autoEnd = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    setDrumEnd(autoEnd)
    try {
      await Promise.all(
        Object.entries(postChk).map(([itemId, value]) =>
          fetch('/api/checklist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              production_detail_id: lot.id,
              checklist_item_id: Number(itemId),
              phase: 'post',
              response_value: value,
            }),
          })
        )
      )
      await fetch(`/api/lots/${lot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_pk_step: 5 }),
      })
    } catch (err) {
      console.error('[PKForm] post-checklist save failed:', err)
    }
    setPkStep(5)
  }

  // ── Plan banner data ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planFields = buildPlanFields(lot as Record<string, any>)

  return (
    <div>
      {/* Back button */}
      <button onClick={async () => {
        if (lot.status === 'in_progress' && !isIssueMode) {
          setShowShiftEndConfirm(true)
        } else {
          try { await savePkStep(pkStep) } catch (err) { console.error('[PKForm Back] autosave failed:', err) }
          onBack()
        }
      }}
        className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer">
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Issue / Emergency / Rejected banner */}
      {isIssueMode && (
        <div className="rounded-xl border-2 px-4 py-3 mb-4 flex items-start gap-3"
          style={{
            background: lot.status === 'paused_issue' ? '#FEF3C7' : '#FCEBEB',
            borderColor: lot.status === 'paused_issue' ? '#EF9F27' : '#E24B4A',
          }}>
          {lot.status === 'paused_emergency'
            ? <AlertOctagon size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#E24B4A' }} />
            : lot.status === 'rejected'
              ? <XCircle size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#E24B4A' }} />
              : <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" style={{ color: '#EF9F27' }} />
          }
          <div>
            <div className="text-[14px] font-bold"
              style={{ color: lot.status === 'paused_issue' ? '#633806' : '#791F1F' }}>
              {lot.status === 'paused_emergency'
                ? 'Emergency Stop — Review all steps'
                : lot.status === 'rejected'
                  ? 'Lot Rejected — Fix and resubmit'
                  : 'Issue Paused — Review and resolve'}
            </div>
            <div className="text-[12px] mt-1"
              style={{ color: lot.status === 'paused_issue' ? '#854F0B' : '#501313' }}>
              {lot.status === 'rejected' && lot.reject_remark
                ? `Reason: ${lot.reject_remark}`
                : 'Use Previous/Next to navigate between steps'}
            </div>
          </div>
        </div>
      )}

      {/* Step progress for issue mode */}
      {isIssueMode && (
        <div className="flex gap-1 mb-4">
          {(['Date', 'Scale', 'Pre-check', 'Drumming', 'Post-check', 'Submit'] as const).map((label, i) => (
            <button key={i} onClick={() => setPkStep(i)}
              className="flex-1 text-center cursor-pointer bg-transparent border-none p-0">
              <div className="h-1.5 rounded-full mb-1 transition-colors"
                style={{ background: i < pkStep ? '#27500A' : i === pkStep ? '#185FA5' : '#DDE2EE' }} />
              <div className="text-[9px] transition-colors"
                style={{ color: i < pkStep ? '#27500A' : i === pkStep ? '#185FA5' : '#9BA3BA', fontWeight: i === pkStep ? 600 : 400 }}>
                {label}
              </div>
            </button>
          ))}
        </div>
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
        {lot.special_comm && (
          <div className="mt-3 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-0.5">Special Comment (SL)</div>
              <div className="text-[12px] text-amber-900 leading-relaxed">
                {String(lot.special_comm)}
              </div>
            </div>
          </div>
        )}
        <div className="rounded-xl p-3 flex items-center gap-3 mt-3" style={{ background: dc }}>
          <div>
            <div className="text-[10px] font-medium text-white/65">Packing Date (set by SL)</div>
            <div className="text-xl font-bold text-white">{formatDate(lot.packing_date)}</div>
          </div>
        </div>
        {(lot.current_pk_step ?? 0) > 0 && !lot.fixSection && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-3 flex items-center gap-2">
            <div>
              <div className="text-xs font-semibold text-blue-900">Resume — กลับมาต่อจาก Step {lot.current_pk_step}</div>
              <div className="text-[11px] text-blue-700 mt-0.5">ข้อมูลที่กรอกไว้ถูก autosave ไว้แล้ว</div>
            </div>
          </div>
        )}
      </div>

      {/* Operator */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
        <div className="text-[11px] font-medium text-blue-900 mb-1.5">
          Operator (auto-recorded)
        </div>
        {operators.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {operators.map((op, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-[12px] font-bold text-blue-900">
                  {op.name}
                </span>
                <span className="text-[10px] text-blue-500">
                  ({op.action === 'start' ? `เริ่ม ${op.time}`
                    : op.action === 'resubmit' ? `resubmit ${op.time}`
                      : `resume ${op.time}`})
                </span>
                {i < operators.length - 1 && (
                  <span className="text-[#9BA3BA] mx-0.5">→</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm font-bold text-blue-900">
            {currentUser}
          </div>
        )}
      </div>

      <LotStepBar pkStep={pkStep} dc={dc} planned_pallets={totalP} sessions={sessions} />

      {showPause && !paused && <PauseControls onPause={doPause} pre={pausePre} onShiftEndClick={() => setShowShiftEndConfirm(true)} />}
      {paused && pauseType && (
        <PausedCard
          pauseType={pauseType as PauseTypeKey}
          onResume={doResume}
          currentUser={currentUser}
          initialStartTime={openDowntimeStart}
        />
      )}

      {(() => {
        const rejectionLogs = approvalLogs.filter((l: any) =>
          l.action === 'rejected_by_pl' || l.action === 'rejected_by_sl'
        )
        return (lot.reject_remark || rejectionLogs.length > 0 || downtimeLogs.length > 0) && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 mb-3">
            <div className="text-xs font-bold text-amber-800 mb-2">ประวัติ — หมายเหตุ / ปัญหาที่บันทึกไว้</div>
            {lot.reject_remark && (
              <div className="bg-red-50 border border-red-400 rounded-lg p-2.5 mb-2">
                <div className="text-xs font-semibold text-red-900 mb-0.5">
                  {lot.status === 'rejected' ? 'Rejected — please fix and resubmit' : 'Reject remark (history)'}
                </div>
                <div className="text-xs text-red-800">{lot.reject_remark}</div>
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
            {downtimeLogs.length > 0 && (
              <div className="mt-1">
                <div className="text-[10px] font-semibold text-amber-800 mb-1">Downtime ({downtimeLogs.length})</div>
                {downtimeLogs.map((l, i) => (
                  <div key={i} className="text-[11px] text-amber-700 py-0.5">
                    {formatDowntimeDate(l.start)} {toThaiTime(l.start)}–{toThaiTime(l.end)}
                    {formatDuration(l.start, l.end) && ` (${formatDuration(l.start, l.end)})`}
                    {' · '}<strong>{l.type.replace(/_/g, ' ')}</strong> · {l.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Step 0 ── */}
      {pkStep === 0 && (
        <Step0Date
          lot={lot} dc={dc}
          opDate={opDate} setOpDate={setOpDate} opAS={opAS}
          latexNoBact={latexNoBact} setLatexNoBact={setLatexNoBact}
          latexNoBactBy={latexNoBactBy} setLatexNoBactBy={setLatexNoBactBy}
          latexTemp={latexTemp} setLatexTemp={setLatexTemp}
          latexTempBy={latexTempBy} setLatexTempBy={setLatexTempBy}
          labelCheck={labelCheck} setLabelCheck={setLabelCheck}
          slFollow={slFollow} setSlFollow={setSlFollow}
          labelRemark={labelRemark} setLabelRemark={setLabelRemark}
          onNext={async () => {
            if (lot.status === 'waiting') {
              await fetch(`/api/lots/${lot.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' }),
              })
              setLots(p => p.map(l =>
                l.id === lot.id
                  ? { ...l, status: 'in_progress' as typeof l.status }
                  : l
              ))
            }
            setPkStep(1)
          }}
          onNextSkipSave={async () => {
            if (lot.status === 'waiting') {
              await fetch(`/api/lots/${lot.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'in_progress' }),
              })
              setLots(p => p.map(l =>
                l.id === lot.id
                  ? { ...l, status: 'in_progress' as typeof l.status }
                  : l
              ))
            }
            setPkStep(1, true)
          }}
          readOnly={forceReadOnly}
        />
      )}

      {/* ── Step 1 ── */}
      {pkStep === 1 && (
        <Step1Scale
          lot={lot} dc={dc} isIssueMode={isIssueMode} pkStep={pkStep}
          mduLocked={mduLocked} setMduLocked={setMduLocked}
          mduVals={mduVals} setMduVals={setMduVals}
          stdWeight={stdWeight} tolerance={tolerance}
          recalib={recalib} setRecalib={setRecalib}
          scaleApproved={scaleApproved} setScaleApproved={setScaleApproved} scalePendingPL={scalePendingPL}
          scaleApprovedBy={scaleApprovedBy}
          setScaleVerificationId={setScaleVerificationId}
          setScalePendingPL={setScalePendingPL}
          latexScaleRound={latexScaleRound} setLatexScaleRound={setLatexScaleRound}
          latexScale1Approved={latexScale1Approved} latexScale1Pending={latexScale1Pending}
          setLatexScale1Approved={setLatexScale1Approved} setLatexScale1Pending={setLatexScale1Pending}
          latexScale2Approved={latexScale2Approved} latexScale2Pending={latexScale2Pending}
          setLatexScale2Approved={setLatexScale2Approved} setLatexScale2Pending={setLatexScale2Pending}
          latexMdu1={latexMdu1} setLatexMdu1={setLatexMdu1}
          latexMdu2={latexMdu2} setLatexMdu2={setLatexMdu2}
          latexRound1By={latexRound1By} latexRound2By={latexRound2By}
          doPause={doPause} setLots={setLots}
          onBack={() => setPkStep(0)} onNext={() => setPkStep(2)}
          readOnly={forceReadOnly || step1ScaleOk}
          onClearSessions={() => {
            setSessions([])
            setRecheckList([])
            setRecheckDone(false)
            setPalletNo(1)
            setSessionWt('')
            setWtMachine('')
            setWtCategory('')
            setWtDrumType('')
            setWtIbcSub('')
            setDrummingSessionId(null)
          }}
        />
      )}

      {/* ── Step 2 ── */}
      {pkStep === 2 && (
        <Step2PreCheck
          dc={dc} isIssueMode={isIssueMode} lotId={lot.id} lotDept={lot.dept}
          preItems={preItems} preChk={preChk} setPreChk={setPreChk} preAS={preAS}
          emptyDrumWt={emptyDrumWt} setEmptyDrumWt={setEmptyDrumWt}
          isTote={isTote} preOk={preOk} preFail={preFail}
          doPause={doPause}
          onBack={() => setPkStep(1)}
          onNext={async () => {
            await ensureDrummingSession()
            setPkStep(3)
          }}
          readOnly={forceReadOnly}
        />
      )}

      {/* ── Step 3 ── */}
      {pkStep === 3 && (
        <Step3Drumming
          dc={dc} lotId={lot.id} lotDept={lot.dept} totalP={totalP} isTote={isTote}
          sessions={sessions} palletNo={palletNo}
          wtMachine={wtMachine} setWtMachine={setWtMachine}
          wtCategory={wtCategory} setWtCategory={setWtCategory}
          wtDrumType={wtDrumType} setWtDrumType={setWtDrumType}
          wtIbcSub={wtIbcSub} setWtIbcSub={setWtIbcSub}
          wtStandard={wtStandard}
          sessionWt={sessionWt} setSessionWt={setSessionWt}
          recheckList={recheckList} recheckDone={recheckDone}
          wPass={wPass} wFail={wFail}
          skipWeightCheck={lot.dept === 'IBC' || lot.dept === 'Latex'}
          drumStart={drumStart} setDrumStart={setDrumStart} drumAS={drumAS}
          flushKg={flushKg} setFlushKg={setFlushKg}
          purgeKg={purgeKg} setPurgeKg={setPurgeKg}
          drainKg={drainKg} setDrainKg={setDrainKg}
          batchSizeKg={batchSizeKg} setBatchSizeKg={setBatchSizeKg}
          containerQty={containerQty} setContainerQty={setContainerQty}
          capLarge={capLarge} setCapLarge={setCapLarge}
          capSmall={capSmall} setCapSmall={setCapSmall}
          capXSmall={capXSmall} setCapXSmall={setCapXSmall}
          latexPrevProduct={latexPrevProduct} setLatexPrevProduct={setLatexPrevProduct}
          latexPrevProductName={latexPrevProductName} setLatexPrevProductName={setLatexPrevProductName}
          latexSample={latexSample} setLatexSample={setLatexSample}
          latexDrummer={latexDrummer} setLatexDrummer={setLatexDrummer}
          latexFlushKg={latexFlushKg} setLatexFlushKg={setLatexFlushKg}
          latexProductPurgeKg={latexProductPurgeKg} setLatexProductPurgeKg={setLatexProductPurgeKg}
          latexDrainKg={latexDrainKg} setLatexDrainKg={setLatexDrainKg}
          latexTotalKg={latexTotalKg} setLatexTotalKg={setLatexTotalKg}
          latexLot1Qty={latexLot1Qty} setLatexLot1Qty={setLatexLot1Qty}
          latexLot2Qty={latexLot2Qty} setLatexLot2Qty={setLatexLot2Qty}
          preChk={preChk} setPreChk={setPreChk}
          preItems45={preItems45} pre45Ok={pre45Ok} pre45Asked={pre45Asked}
          sampleType={sampleType} setSampleType={setSampleType}
          missingFields={step3MissingFields}
          isCompletingPallet={isCompletingPallet}
          doPause={doPause} doRecheck={doRecheck} completePallet={completePallet}
          undoLastRecheck={undoLastRecheck}
          onClearAllWeights={lot.dept === 'IBC' || lot.dept === 'Latex' ? clearAllWeights : undefined}
          readOnly={forceReadOnly}
          canClearDrumming={!['submitted', 'head_approved', 'sl_rejected', 'completed', 'paused_shift_end', 'paused_issue', 'paused_emergency'].includes(lot.status)}
          onClearDrumming={async () => {
            await fetch(`/api/recheck-weights?production_detail_id=${lot.id}`, { method: 'DELETE' })
              .catch(e => console.error('[clear drumming]', e))
            setSessions([])
            setRecheckList([])
            setRecheckDone(false)
            setPalletNo(1)
            setSessionWt('')
            setDrummingSessionId(null)
            await fetch(`/api/lots/${lot.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ actual_pallet_count: null }),
            }).catch(e => console.error('[clear drumming] lot update', e))
          }}
        />
      )}

      {/* ── Step 4 ── */}
      {pkStep === 4 && (
        <Step4PostCheck
          dc={dc} isIssueMode={isIssueMode} lotId={lot.id} lotDept={lot.dept}
          postItems={postItemsDB}
          postChk={postChk} setPostChk={setPostChk} postAS={postAS}
          latexStorageArea={latexStorageArea} setLatexStorageArea={setLatexStorageArea}
          latexTagStatus={latexTagStatus} setLatexTagStatus={setLatexTagStatus}
          latexTagBy={latexTagBy} setLatexTagBy={setLatexTagBy}
          postOk={postOk} onComplete={onPostChkComplete}
          readOnly={forceReadOnly}
        />
      )}

      {/* ── Step 5 ── */}
      {pkStep === 5 && (
        <Step5Submit
          lot={lot} dc={dc} isIssueMode={isIssueMode} pkStep={pkStep}
          drumEnd={drumEnd} setDrumEnd={setDrumEnd} drumEndAS={drumEndAS}
          drumStart={drumStart} sessions={sessions}
          downtimeLogs={downtimeLogs} labelRemark={labelRemark}
          currentUser={currentUser}
          setPkStep={setPkStep}
          onSubmit={onSubmit}
          setLots={setLots}
          onBackToList={onBack}
          readOnly={forceReadOnly}
          onResubmitOperator={recordResubmitOperator}
        />
      )}

      {/* Issue mode: global Previous/Next navigation bar (all steps) */}
      {isIssueMode && (
        <div className="sticky bottom-0 z-50 bg-[#F5F5F5] border-t border-[#DDE2EE] px-4 py-3 flex items-center gap-2 mt-4">
          <button
            disabled={pkStep === 0}
            onClick={() => setPkStep(Math.max(0, pkStep - 1))}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-500 cursor-pointer disabled:opacity-40 bg-white">
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <div className="flex-1 text-center">
            <div className="text-[12px] text-[#9BA3BA]">Step {pkStep + 1} of 6</div>
            <div className="text-[10px] text-[#9BA3BA]">
              {(['Date & Label', 'Scale MDU', 'Pre-checklist', 'Drumming', 'Post-checklist', 'Submit'] as const)[pkStep]}
            </div>
          </div>
          <button
            disabled={pkStep === 5}
            onClick={() => setPkStep(Math.min(5, pkStep + 1))}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1a3a6c] text-white cursor-pointer disabled:opacity-40 border-none hover:bg-[#0f2347] transition-colors">
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Shift End confirmation modal — shown when Back is clicked while in_progress */}
      <ConfirmModal
        open={showShiftEndConfirm}
        title="ออกจากงานตอนนี้?"
        message={'ระบบจะบันทึกเป็น "Shift End" โดยอัตโนมัติ ข้อมูลที่กรอกไว้จะถูก autosave และพนักงานคนต่อไปสามารถกด "Resume" เพื่อทำงานต่อได้'}
        confirmLabel="ยืนยันออกจากงาน"
        cancelLabel="ยกเลิก"
        confirmColor="#EF9F27"
        icon={<LogOut size={44} />}
        onCancel={() => setShowShiftEndConfirm(false)}
        onConfirm={async () => {
          setShowShiftEndConfirm(false)
          try { await savePkStep(pkStep) } catch (err) { console.error('[PKForm Back] autosave failed:', err) }
          await doPause('paused_shift_end')
          onBack()
        }}
      />

      {/* In-progress: Previous / Step X of 6 / Next navigation bar */}
      {!isIssueMode && !paused && !isLockedByPause && lot.status === 'in_progress' && (
        <div className="sticky bottom-0 z-50 bg-[#F5F5F5] border-t border-[#DDE2EE] px-4 py-3 flex items-center gap-2 mt-4">
          <button
            disabled={pkStep === 0}
            onClick={async () => {
              await savePkStep(pkStep - 1)
              setPkStepRaw(pkStep - 1)
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-300 text-gray-500 cursor-pointer disabled:opacity-40 bg-white min-h-[48px]">
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>
          <div className="flex-1 text-center">
            <div className="text-[12px] text-[#9BA3BA]">Step {pkStep + 1} of 6</div>
            <div className="text-[10px] text-[#9BA3BA]">
              {(['Date & Label', 'Scale MDU', 'Pre-checklist', 'Drumming', 'Post-checklist', 'Submit'] as const)[pkStep]}
            </div>
          </div>
          {pkStep < 5 && (
            <button
              disabled={!canProceed}
              onClick={handleNextStep}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#1a3a6c] text-white cursor-pointer disabled:opacity-40 border-none hover:bg-[#0f2347] transition-colors min-h-[48px]">
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}