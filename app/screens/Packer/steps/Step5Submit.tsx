'use client'
import React from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Card, Inp, Btn, TimePicker } from '@/app/components/shared'
import type { Session, DowntimeLog, AutosaveStatus, Lot } from '../types'

export interface Step5SubmitProps {
  lot: Lot
  dc: string
  isIssueMode: boolean
  pkStep: number
  drumEnd: string
  setDrumEnd: (v: string) => void
  drumEndAS: AutosaveStatus
  drumStart: string
  sessions: Session[]
  downtimeLogs: DowntimeLog[]
  currentUser: string
  setPkStep: (s: number) => void
  onSubmit: (data: Record<string, unknown>) => void
  setLots: React.Dispatch<React.SetStateAction<Lot[]>>
  onBackToList: () => void
  readOnly?: boolean
  onResubmitOperator?: () => Promise<void>
}

export function Step5Submit({
  lot, dc, isIssueMode, pkStep,
  drumEnd, setDrumEnd, drumEndAS,
  drumStart, sessions, downtimeLogs,
  currentUser, setPkStep, onSubmit, setLots, onBackToList,
  readOnly,
  onResubmitOperator,
}: Step5SubmitProps) {
  return (
    <>
      {/* Normal mode */}
      {!isIssueMode && (
        <Card>
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-4">Step 5 - Confirm end time</div>
          <div className="bg-emerald-50 border border-emerald-600 rounded-xl p-4 mb-4">
            <div className="text-xs font-medium text-emerald-700 mb-1">Auto-captured after post-checklist complete</div>
            <div className="text-2xl font-bold text-emerald-700">{drumEnd}</div>
            <div className="text-[11px] text-emerald-600 opacity-80 mt-1">Review and edit if needed</div>
          </div>
          <TimePicker label="lot_drumming_end — confirm or edit" value={drumEnd} onChange={setDrumEnd} readOnly={readOnly} />
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-900">
            {sessions.length} pallets · Start: {drumStart} · End: {drumEnd} · Operator: {currentUser}
          </div>
          {!readOnly && (
          <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <Btn label="Back" color="#9BA3BA" outline onClick={() => setPkStep(4)} />
            <Btn label="Submit to Pack Lead" color="#534AB7" full disabled={!drumEnd}
              onClick={async () => {
                try {
                  await fetch(`/api/lots/${lot.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lot_drumming_end: drumEnd, current_pk_step: 6 }),
                  })
                  await fetch(`/api/lots/${lot.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'submitted', submitted_at: new Date().toISOString() }),
                  })
                } catch (err) {
                  console.error('[Step5Submit] submit failed:', err)
                }
                onSubmit({ drumEnd, sessions, downtimeLogs })
              }} />
          </div>
          )}
        </Card>
      )}

      {/* Issue / Rejected mode */}
      {isIssueMode && (
        <Card>
          {lot.status === 'rejected' ? (
            <>
              <div className="bg-[#FCEBEB] border border-[#E24B4A] rounded-xl p-3 mb-3">
                <div className="text-[12px] text-[#791F1F]">Review all steps above, then resubmit to Pack Lead.</div>
              </div>
              {!readOnly && (
              <Btn
                label={<span className="flex items-center justify-center gap-1.5"><CheckCircle2 size={14} />Resubmit to Pack Lead</span>}
                color="#534AB7" full
                onClick={async () => {
                  await fetch(`/api/lots/${lot.id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'submitted' }),
                  })
                  if (onResubmitOperator) await onResubmitOperator()
                  setLots(p => p.map(l =>
                    l.id === lot.id ? { ...l, status: 'submitted' as typeof l.status } : l
                  ))
                  onBackToList()
                }} />
              )}
            </>
          ) : (
            <div className="bg-[#FEF3C7] border border-[#EF9F27] rounded-xl p-3 text-center">
              <div className="text-[13px] font-semibold text-[#633806] mb-1">Session paused</div>
              <div className="text-[12px] text-[#854F0B]">Close the downtime log before resuming this session.</div>
            </div>
          )}
        </Card>
      )}

    </>
  )
}