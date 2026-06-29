'use client'
import React, { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Card, Btn, ConfirmModal } from '@/app/components/shared'
import type { Lot, MduVals } from '../types'

export interface Step1ScaleProps {
  lot: Lot
  dc: string
  isIssueMode: boolean
  pkStep: number
  // Non-Latex MDU
  mduLocked: string | null
  setMduLocked: (v: string | null) => void
  mduVals: MduVals
  setMduVals: React.Dispatch<React.SetStateAction<MduVals>>
  stdWeight: number
  tolerance: number
  recalib: string
  setRecalib: (v: string) => void
  scaleApproved: boolean
  setScaleApproved: (v: boolean) => void
  scalePendingPL: boolean
  scaleApprovedBy?: string
  setScaleVerificationId: (v: number | null) => void
  setScalePendingPL: (v: boolean) => void
  // Latex
  latexScaleRound: number
  setLatexScaleRound: (v: number) => void
  latexScale1Approved: boolean
  latexScale1Pending: boolean
  setLatexScale1Approved: (v: boolean) => void
  setLatexScale1Pending: (v: boolean) => void
  latexScale2Approved: boolean
  latexScale2Pending: boolean
  setLatexScale2Approved: (v: boolean) => void
  setLatexScale2Pending: (v: boolean) => void
  latexMdu1: MduVals
  setLatexMdu1: React.Dispatch<React.SetStateAction<MduVals>>
  latexMdu2: MduVals
  setLatexMdu2: React.Dispatch<React.SetStateAction<MduVals>>
  latexRound1By: string
  latexRound2By: string
  doPause: (type: string) => void
  setLots: React.Dispatch<React.SetStateAction<Lot[]>>
  onBack: () => void
  onNext: () => void
  readOnly?: boolean
  hideClearScale?: boolean
  onClearSessions?: () => void
}

export function getStandardWeight(drumSet?: string, custom?: string): number {
  if (!drumSet) return 210
  if (drumSet.includes('210')) return 210
  if (drumSet.includes('1000')) return 1000
  if (drumSet === 'อื่นๆ' && custom) return Number(custom) || 210
  return 210
}

export function getTolerance(drumSet?: string, customTol?: string): number {
  if (drumSet === 'อื่นๆ' && customTol) return Number(customTol) || 0.5
  return 0.5
}

export function Step1Scale({
  lot, dc, isIssueMode, pkStep,
  mduLocked, setMduLocked, mduVals, setMduVals, stdWeight, tolerance,
  recalib, setRecalib, scaleApproved, setScaleApproved, scalePendingPL,
  scaleApprovedBy,
  setScaleVerificationId, setScalePendingPL,
  latexScaleRound, setLatexScaleRound,
  latexScale1Approved, latexScale1Pending, setLatexScale1Approved, setLatexScale1Pending,
  latexScale2Approved, latexScale2Pending, setLatexScale2Approved, setLatexScale2Pending,
  latexMdu1, setLatexMdu1, latexMdu2, setLatexMdu2,
  latexRound1By, latexRound2By,
  doPause, setLots,
  onBack, onNext,
  readOnly,
  hideClearScale,
  onClearSessions,
}: Step1ScaleProps) {

  const canClearScale = ![
    'submitted', 'head_approved', 'sl_rejected', 'completed',
    'paused_shift_end', 'paused_issue', 'paused_emergency',
  ].includes(lot.status)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  async function handleClearScale() {
    setClearing(true)
    try {
      const res = await fetch(`/api/scale-verifications?production_detail_id=${lot.id}`, { method: 'DELETE' })
      if (res.ok) {
        setMduLocked(null)
        setMduVals({})
        setRecalib('')
        setScaleApproved(false)
        setScalePendingPL(false)
        setScaleVerificationId(null)
        setLatexScale1Approved(false)
        setLatexScale1Pending(false)
        setLatexScale2Approved(false)
        setLatexScale2Pending(false)
        setLatexMdu1({ drumSet: 'Tote Set 1000.0 Kg' })
        setLatexMdu2({ drumSet: 'Tote Set 1000.0 Kg' })
        if (onClearSessions) onClearSessions()
        setShowClearConfirm(false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert('ล้างข้อมูลไม่สำเร็จ: ' + ((err as { error?: string }).error || res.status))
      }
    } catch (err) {
      console.error('[Step1Scale clear] failed:', err)
      alert('ล้างข้อมูลไม่สำเร็จ')
    } finally {
      setClearing(false)
    }
  }

  async function handleNotifyPL() {
    try {
      const res = await fetch('/api/scale-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_detail_id:   lot.id,
          machine_code:           mduLocked ?? null,
          standard_weight_kg:     stdWeight,
          measured_weight_kg:     Number(mduVals.w),
          recalibration_required: recalib === 'Yes',
          round_no:               1,
        }),
      })
      if (res.ok) {
        const v = await res.json()
        setScaleVerificationId(v.id)
        await fetch(`/api/lots/${lot.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_pk_step: pkStep }),
        })
        setScalePendingPL(true)
        if (lot.status !== 'rejected') {
          await fetch(`/api/lots/${lot.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pl_review' }),
          })
          setLots(p => p.map(l =>
            l.id === lot.id ? { ...l, status: 'pl_review' as typeof l.status } : l
          ))
        }
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('[Step1Scale] error:', err)
        alert('Failed to notify PL: ' + ((err as { error?: string }).error || res.status))
      }
    } catch (err) {
      console.error('[Step1Scale] exception:', err)
      alert('Failed to notify PL')
    }
  }

  async function handleLatexNotifyPL(r: number, mduV: MduVals, latexStd: number, setPending: (v: boolean) => void) {
    try {
      const res = await fetch('/api/scale-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          production_detail_id:   lot.id,
          machine_code:           r === 2 ? 'Auto Drumming' : 'Manual Drumming',
          standard_weight_kg:     latexStd,
          measured_weight_kg:     Number(mduV.w ?? 0),
          recalibration_required: mduV.recalib === 'Yes',
          round_no:               r,
        }),
      })
      if (res.ok) {
        await res.json()
        await fetch(`/api/lots/${lot.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_pk_step: pkStep }),
        })
        setPending(true)
        if (lot.status !== 'rejected') {
          await fetch(`/api/lots/${lot.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pl_review' }),
          })
          setLots(p => p.map(l =>
            l.id === lot.id ? { ...l, status: 'pl_review' as typeof l.status } : l
          ))
        }
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('[Step1Scale] error:', err)
        alert('Failed to save scale: ' + ((err as { error?: string }).error || res.status))
      }
    } catch (err) {
      console.error('[Step1Scale] exception:', err)
      alert('Failed to notify PL')
    }
  }

  const notes = lot.dept === 'Latex'
    ? [
        'จุดที่ใช้ในการทวนสอบเครื่องชั่งถูกระบุในตารางด้านบน',
        'ใช้ drum มาตรฐาน น้ำหนักที่ 210 kg เป็นมาตรฐานที่ใช้ในการสอบทวน',
        'หากผลการชั่งสอบทวนไม่ได้อยู่ในช่วงที่ควบคุม (209.5 - 210.5 kg) ต้องแจ้ง Site logistics โดยทันที',
        'ต้องมั่นใจว่าได้ทำการเตรียมภาชนะบรรจุถูกต้องตามใบแจ้งบรรจุ',
      ]
    : [
        'Product ที่ drain จาก Strainer ให้กำจัดเป็น Polyol waste เท่านั้น',
        'Product ที่ drain จาก Blender ห้ามนำมาเติมเพื่อทำน้ำหนัก',
        'ห้าม drumming CP 1055 ต่อจาก RA 440',
      ]

  return (
    <>
    <div>
      <Card>
        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Step 1 - การทวนสอบเครื่องชั่ง (Scale MDU)</div>
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
          <div className="text-[11px] font-bold text-amber-800 mb-2">หมายเหตุ</div>
          {notes.map((t, i) => (
            <div key={i} className="flex gap-1.5 mb-1">
              <span className="text-[11px] text-amber-700 font-bold flex-shrink-0">{i + 1}.</span>
              <span className="text-[11px] text-amber-700 leading-relaxed">{t}</span>
            </div>
          ))}
        </div>

        {/* ── Latex round switcher — outside fieldset so it stays clickable in readOnly ── */}
        {lot.dept === 'Latex' && (
          <div className="flex gap-1 mb-3">
            {[{ r: 1, l: 'รอบที่ 1: Manual', done: latexScale1Approved }, { r: 2, l: 'รอบที่ 2: Auto', done: latexScale2Approved }].map(rb => (
              <button key={rb.r} onClick={() => setLatexScaleRound(rb.r)}
                className="flex-1 py-2.5 rounded-xl text-xs cursor-pointer border-2 min-h-[48px]"
                style={{
                  borderColor: rb.done ? '#27500A' : latexScaleRound === rb.r ? dc : '#DDE2EE',
                  background:  rb.done ? '#EAF3DE' : latexScaleRound === rb.r ? dc + '12' : '#F4F5F7',
                  color:       rb.done ? '#27500A' : latexScaleRound === rb.r ? dc : '#9BA3BA',
                  fontWeight:  latexScaleRound === rb.r ? 600 : 400,
                }}>
                {rb.done ? '✓ ' : ''}{rb.l}
              </button>
            ))}
          </div>
        )}

        <fieldset disabled={readOnly} className="border-0 p-0 m-0">
        {/* ── Latex 2-round ── */}
        {lot.dept === 'Latex' ? (
          <div className="mb-4">
            {[1, 2].map(r => {
              const isActive = latexScaleRound === r
              const mduV = r === 1 ? latexMdu1 : latexMdu2
              const setMduV = r === 1 ? setLatexMdu1 : setLatexMdu2
              const approved = r === 1 ? latexScale1Approved : latexScale2Approved
              const pending  = r === 1 ? latexScale1Pending  : latexScale2Pending
              const setApproved = r === 1 ? setLatexScale1Approved : setLatexScale2Approved
              const setPending  = r === 1 ? setLatexScale1Pending  : setLatexScale2Pending
              if (!isActive) return null
              const latexStd = getStandardWeight(mduV.drumSet, mduV.drumSetCustom)
              const latexTol = getTolerance(mduV.drumSet, mduV.customTolerance)
              const wOk = mduV.w ? Math.abs(+mduV.w - latexStd) <= latexTol : false
              return (
                <div key={r}>
                  <div className="text-xs font-semibold text-gray-600 mb-2">รอบที่ {r} — {r === 1 ? 'Manual' : 'Auto'} Drumming</div>
                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-2">Set Auto Drumming weight</div>
                    <div className="flex gap-2 flex-wrap mb-2">
                      {['Drum Set 210.0 Kg', 'Tote Set 1000.0 Kg', 'อื่นๆ'].map(opt => (
                        <button key={opt}
                          onClick={() => setMduV(p => ({ ...p, drumSet: opt, drumSetCustom: '', customTolerance: '', w: '' }))}
                          className="px-3 py-2 rounded-lg text-xs cursor-pointer border-2 min-h-[40px]"
                          style={{
                            borderColor: mduV.drumSet === opt ? dc : '#DDE2EE',
                            background:  mduV.drumSet === opt ? dc + '12' : '#F4F5F7',
                            color:       mduV.drumSet === opt ? dc : '#9BA3BA',
                            fontWeight:  mduV.drumSet === opt ? 600 : 400,
                          }}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    {mduV.drumSet === 'อื่นๆ' && (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div className="text-[10px] text-gray-500 mb-1">Standard weight (kg)</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={mduV.drumSetCustom || ''}
                            onChange={e => {
                              const val = e.target.value
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                setMduV(p => ({ ...p, drumSetCustom: val, w: '' }))
                              }
                            }}
                            placeholder="e.g. 500"
                            className="w-full text-sm p-2.5 border rounded-lg outline-none min-h-[44px]" />
                        </div>
                        <div className="w-28">
                          <div className="text-[10px] text-gray-500 mb-1">Tolerance (±kg)</div>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={mduV.customTolerance || ''}
                            onChange={e => {
                              const val = e.target.value
                              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                setMduV(p => ({ ...p, customTolerance: val }))
                              }
                            }}
                            placeholder="0.5"
                            className="w-full text-sm p-2.5 border rounded-lg outline-none min-h-[44px]" />
                        </div>
                      </div>
                    )}
                  </div>
                  {mduV.drumSet && (mduV.drumSet !== 'อื่นๆ' || mduV.drumSetCustom) && (
                    <>
                      <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 mb-3 text-xs text-amber-800">
                        Standard: <strong>{latexStd} kg ±{latexTol} kg</strong>{' '}
                        (range: {latexStd - latexTol} – {latexStd + latexTol} kg)
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={mduV.w || ''}
                          onChange={e => {
                            const val = e.target.value
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setMduV(p => ({ ...p, w: val }))
                            }
                          }}
                          placeholder={String(latexStd)}
                          className="flex-1 text-3xl font-black text-center p-3 rounded-xl outline-none border-2 min-h-[64px]"
                          style={{
                            borderColor: mduV.w ? (wOk ? '#27500A' : '#E24B4A') : '#DDE2EE',
                            background:  mduV.w ? (wOk ? '#EAF3DE' : '#FCEBEB') : '#fff',
                          }} />
                        <span className="text-sm text-gray-400">Kg.</span>
                      </div>
                      {mduV.w && (
                        <div className={`p-3 rounded-xl mb-2 border-2 ${wOk ? 'bg-green-50 border-green-700' : 'bg-red-50 border-red-400'}`}>
                          <div className={`text-sm font-bold ${wOk ? 'text-green-800' : 'text-red-800'}`}>
                            {wOk ? `✓ Within control range (${latexStd - latexTol}–${latexStd + latexTol} kg)` : '✗ Out of control range'}
                          </div>
                          {!wOk && <div className="text-xs text-red-700 mt-1 font-medium">กรุณาบันทึก Issue Log และแจ้ง Site Logistics</div>}
                        </div>
                      )}
                    </>
                  )}
                  {mduV.w && !wOk && <Btn label="Log Issue + Notify SL" danger full onClick={() => doPause('paused_issue')} />}
                  {wOk && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-600 mb-2">ต้องการสอบเทียบใหม่?</div>
                      <div className="flex gap-2">
                        {['Yes', 'No'].map(v => {
                          const recalibV = r === 1 ? latexMdu1.recalib : latexMdu2.recalib
                          return (
                            <button key={v} onClick={() => setMduV(p => ({ ...p, recalib: v }))}
                              className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer border min-h-[48px]"
                              style={{
                                borderColor: recalibV === v ? (v === 'Yes' ? '#E24B4A' : '#27500A') : '#DDE2EE',
                                background:  recalibV === v ? (v === 'Yes' ? '#FCEBEB' : '#EAF3DE') : '#F4F5F7',
                                color:       recalibV === v ? (v === 'Yes' ? '#791F1F' : '#27500A') : '#9BA3BA',
                              }}>
                              {v}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {!readOnly && wOk && (r === 1 ? latexMdu1.recalib : latexMdu2.recalib) && !approved && !pending && (
                    <div className="bg-purple-50 border-2 border-purple-400 rounded-xl p-4 mb-2">
                      <div className="text-sm font-semibold text-purple-800 mb-2">รอ Pack Lead Approve — รอบที่ {r}</div>
                      <Btn label="แจ้ง Pack Lead" color="#7C3AED" full
                        onClick={() => handleLatexNotifyPL(r, mduV, latexStd, setPending)} />
                    </div>
                  )}
                  {pending && !approved && (
                    <div className="bg-[#EEEDFE] border border-[#534AB7] rounded-xl p-4 mb-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
                        <div className="text-[13px] font-semibold text-[#534AB7]">Waiting for Pack Lead approval — รอบที่ {r} ({r === 1 ? 'Manual' : 'Auto'} Drumming)...</div>
                      </div>
                      <div className="text-[11px] text-[#534AB7]">Pack Lead has been notified. This page will update automatically when approved.</div>
                    </div>
                  )}
                  {approved && (
                    <div className="bg-green-50 border-2 border-green-700 rounded-xl p-4 mb-2">
                      <div className="text-sm font-bold text-green-800">✓ Pack Lead Approved — รอบที่ {r} ({r === 1 ? 'Manual' : 'Auto'} Drumming)</div>
                      {r === 1 && !latexScale2Approved && (
                        <button onClick={() => setLatexScaleRound(2)}
                          className="mt-2 w-full py-2 rounded-lg text-sm font-bold cursor-pointer border-none text-white min-h-[44px]"
                          style={{ background: dc }}>
                          ดำเนินการ Scale รอบที่ 2
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {latexScale1Approved && latexScale2Approved && (
              <div className="mt-3 p-4 bg-emerald-50 border border-emerald-400 rounded-xl">
                <div className="text-xs font-bold text-emerald-800 mb-3">ข้อมูลการ Drumming — Latex</div>
                {[
                  { label: 'ตรวจสอบโดย (Round 1)',        value: latexRound1By || '—' },
                  { label: 'ตรวจสอบโดย (Round 2)',        value: latexRound2By || '—' },
                  { label: 'Set น้ำหนัก Auto Drumming โดย', value: latexRound2By || '—' },
                  { label: 'ผู้ทำการ Drumming',            value: [latexRound1By, latexRound2By].filter(Boolean).join(' / ') || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-2 gap-1 items-center bg-white rounded-lg px-3 py-2 border border-emerald-200 mb-1.5">
                    <div className="text-[11px] text-gray-600 font-medium">{label}</div>
                    <div className="text-xs font-bold text-emerald-800 text-right">{value || '-'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Non-Latex MDU ── */
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-2">Row 1 - เลือกเครื่อง MDU</div>
            <div className="flex flex-col gap-1.5">
              {(lot.dept === 'IBC'
                ? ['Manual unloading IBC to drum']
                : ['MDU 2450', 'MDU 2451', 'MDU 2452', 'Manual drumming']
              ).map(t => (
                <button key={t}
                  onClick={() => { setMduLocked(t); setMduVals({}); setRecalib('') }}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer text-left border-2 min-h-[52px]"
                  style={{ borderColor: mduLocked === t ? dc : '#DDE2EE', background: mduLocked === t ? dc + '12' : '#F4F5F7' }}>
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2"
                    style={{ borderColor: mduLocked === t ? dc : '#9BA3BA', background: mduLocked === t ? dc : '#fff' }}>
                    {mduLocked === t && <span className="text-white text-[11px] font-black">✓</span>}
                  </div>
                  <span className="text-sm" style={{ fontWeight: mduLocked === t ? 600 : 400, color: mduLocked === t ? dc : '#0E1117' }}>{t}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 2: drumSet selection for non-Latex */}
            {lot.dept !== 'Latex' && (
              <div className={`mb-4 ${!mduLocked ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="text-xs font-semibold text-gray-600 mb-2">Row 2 - Set Auto Drumming weight</div>
            <div className="flex gap-2 flex-wrap mb-2">
              {(lot.dept === 'IBC'
                ? ['Tote Set 1000.0 Kg', 'อื่นๆ']
                : ['Drum Set 210.0 Kg', 'Tote Set 1000.0 Kg', 'อื่นๆ']
              ).map(opt => (
                <button key={opt}
                  onClick={() => setMduVals(p => ({ ...p, drumSet: opt, drumSetCustom: '', customTolerance: '', w: '' }))}
                  className="px-3 py-2 rounded-lg text-xs cursor-pointer border-2 min-h-[40px]"
                  style={{
                    borderColor: mduVals.drumSet === opt ? dc : '#DDE2EE',
                    background:  mduVals.drumSet === opt ? dc + '12' : '#F4F5F7',
                    color:       mduVals.drumSet === opt ? dc : '#9BA3BA',
                    fontWeight:  mduVals.drumSet === opt ? 600 : 400,
                  }}>
                  {opt}
                </button>
              ))}
            </div>
            {mduVals.drumSet === 'อื่นๆ' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <div className="text-[10px] text-gray-500 mb-1">Standard weight (kg)</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={mduVals.drumSetCustom || ''}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setMduVals(p => ({ ...p, drumSetCustom: val, w: '' }))
                      }
                    }}
                    placeholder="e.g. 500"
                    className="w-full text-sm p-2.5 border rounded-lg outline-none min-h-[44px]" />
                </div>
                <div className="w-28">
                  <div className="text-[10px] text-gray-500 mb-1">Tolerance (±kg)</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={mduVals.customTolerance || ''}
                    onChange={e => {
                      const val = e.target.value
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setMduVals(p => ({ ...p, customTolerance: val }))
                      }
                    }}
                    placeholder="0.5"
                    className="w-full text-sm p-2.5 border rounded-lg outline-none min-h-[44px]" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Row 3: weight input for non-Latex */}
            {lot.dept !== 'Latex' && (
              <div className={`mb-4 ${(!mduLocked || !mduVals.drumSet || (mduVals.drumSet === 'อื่นๆ' && !mduVals.drumSetCustom)) ? 'opacity-60' : ''}`}>
            <div className="text-xs font-semibold text-gray-600 mb-2">Row 3 - Actual weight measured</div>
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 mb-3 text-xs text-amber-800">
              Standard: <strong>{stdWeight} kg ±{tolerance} kg</strong>{' '}
              (range: {stdWeight - tolerance} – {stdWeight + tolerance} kg)
            </div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                inputMode="decimal"
                value={mduVals.w || ''}
                onChange={e => {
                  const val = e.target.value
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setMduVals(p => ({ ...p, w: val }))
                  }
                }}
                placeholder={String(stdWeight)}
                className="flex-1 text-3xl font-black text-center p-3 rounded-xl outline-none border-2 min-h-[64px]"
                style={{
                  borderColor: mduVals.w ? (Math.abs(+mduVals.w - stdWeight) <= tolerance ? '#27500A' : '#E24B4A') : '#DDE2EE',
                  background:  mduVals.w ? (Math.abs(+mduVals.w - stdWeight) <= tolerance ? '#EAF3DE' : '#FCEBEB') : '#fff',
                }} />
              <span className="text-sm text-gray-400">Kg.</span>
            </div>
            {mduVals.w && (
              <div className={`p-3 rounded-xl mb-2 border-2 ${Math.abs(+mduVals.w - stdWeight) <= tolerance ? 'bg-green-50 border-green-700' : 'bg-red-50 border-red-400'}`}>
                <div className={`text-sm font-bold ${Math.abs(+mduVals.w - stdWeight) <= tolerance ? 'text-green-800' : 'text-red-800'}`}>
                  {Math.abs(+mduVals.w - stdWeight) <= tolerance ? '✓ Within control range' : '✗ Out of control range'}
                </div>
                {Math.abs(+mduVals.w - stdWeight) > tolerance && (
                  <div className="text-xs text-red-700 mt-1 font-medium">Please log Issue and notify Site Logistics</div>
                )}
              </div>
            )}
            {mduVals.w && Math.abs(+mduVals.w - stdWeight) > tolerance && (
              <Btn label="Log Issue + Notify SL" danger full onClick={() => doPause('paused_issue')} />
            )}
          </div>
        )}

        {/* Row 4: recalib for non-Latex */}
        {lot.dept !== 'Latex' && mduVals.w && Math.abs(+mduVals.w - stdWeight) <= tolerance && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 mb-3">Row 4 - สอบเทียบ</div>
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-2">ต้องการสอบเทียบใหม่?</div>
              <div className="flex gap-2">
                {['Yes', 'No'].map(v => (
                  <button key={v} onClick={() => setRecalib(v)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer border min-h-[48px]"
                    style={{
                      borderColor: recalib === v ? (v === 'Yes' ? '#E24B4A' : '#27500A') : '#DDE2EE',
                      background:  recalib === v ? (v === 'Yes' ? '#FCEBEB' : '#EAF3DE') : '#F4F5F7',
                      color:       recalib === v ? (v === 'Yes' ? '#791F1F' : '#27500A') : '#9BA3BA',
                    }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
              <div className="text-[11px] text-gray-600 font-medium">ตรวจสอบโดย</div>
              <div className="text-sm font-bold text-blue-900">{scaleApprovedBy || '—'}</div>
            </div>
            {!readOnly && recalib && !scaleApproved && !scalePendingPL && (
              <div className="bg-purple-50 border-2 border-purple-400 rounded-xl p-4 mb-2">
                <div className="text-sm font-semibold text-purple-800 mb-2">รอ Pack Lead Approve</div>
                <Btn label="แจ้ง Pack Lead" color="#7C3AED" full disabled={scalePendingPL || scaleApproved} onClick={handleNotifyPL} />
              </div>
            )}
            {scalePendingPL && !scaleApproved && (
              <div className="bg-[#EEEDFE] border border-[#534AB7] rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
                  <div className="text-[13px] font-semibold text-[#534AB7]">Waiting for Pack Lead approval...</div>
                </div>
                <div className="text-[11px] text-[#534AB7]">Pack Lead has been notified. This page will update automatically when approved.</div>
              </div>
            )}
            {scaleApproved && (
              <div className="bg-[#EAF3DE] border-2 border-[#27500A] rounded-xl p-4 mb-3">
                <div className="text-[13px] font-bold text-[#27500A]">✓ Pack Lead Approved — Scale verified</div>
                <div className="text-[11px] text-[#3B6D11] mt-1">You can now proceed to Pre-checklist.</div>
              </div>
            )}
          </div>
        )}

        </fieldset>

        {!isIssueMode && (
          <div className="grid grid-cols-3 gap-3 sticky bottom-0 bg-gray-100 pt-3 pb-3 border-t border-gray-200" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <Btn label="Back" color="#9BA3BA" outline onClick={onBack} />
            <Btn label="Next: Pre-check" color={dc} full
              disabled={lot.dept === 'Latex' ? !(latexScale1Approved && latexScale2Approved) : !scaleApproved}
              onClick={onNext} />
          </div>
        )}

        {/* Clear Scale button — outside fieldset so it stays clickable even when readOnly=true (post-approval lock state) */}
        {canClearScale && !hideClearScale && (
          <div className="flex justify-center mt-2 mb-1">
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="text-[11px] text-[#9BA3BA] underline cursor-pointer bg-transparent border-none"
            >
              ล้างข้อมูล Scale และส่งให้ PL ตรวจสอบใหม่
            </button>
          </div>
        )}
      </Card>
    </div>

    <ConfirmModal
      open={showClearConfirm}
      title="ล้างข้อมูล Scale?"
      message="ข้อมูลเครื่องชั่ง น้ำหนัก และสถานะ PL Approve ที่บันทึกไว้ทั้งหมดจะถูกลบ ต้องกรอกข้อมูล Scale และส่งให้ PL ตรวจสอบใหม่อีกครั้ง การกระทำนี้ไม่สามารถย้อนกลับได้"
      confirmLabel={clearing ? 'กำลังล้าง...' : 'ยืนยันล้างข้อมูล'}
      cancelLabel="Cancel"
      confirmColor="#E24B4A"
      confirmDisabled={clearing}
      icon={<RotateCcw size={44} />}
      onCancel={() => !clearing && setShowClearConfirm(false)}
      onConfirm={handleClearScale}
    />
    </>
  )
}
