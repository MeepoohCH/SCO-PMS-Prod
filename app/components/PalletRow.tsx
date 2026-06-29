'use client'
import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Session, ApiChecklistItem, DeptKey } from '@/app/screens/Packer/types'

interface PalletRowProps {
  session: Session
  preItems45: ApiChecklistItem[]
  dept: DeptKey | string
  readOnly?: boolean
  dc?: string
  totalP?: number
}

export function PalletRow({ session, preItems45, dept, dc = '#0F6E56', totalP }: PalletRowProps) {
  const isLastPallet = totalP != null && session.no === totalP
  const hasFailedAttempts = (session.recheck ?? []).some(r => !r.pass)
  const hasData = (!!session.preChk45 && Object.keys(session.preChk45).length > 0) || hasFailedAttempts
  const isPalletOne = session.no === 1

  // Pallet #1 always expanded; others toggle normally
  const [expanded, setExpanded] = useState(isPalletOne)

  const showSampleType = (dept === 'PUF' || dept === 'PU' || dept === 'IBC') && !!session.sampleType

  function chipStyle(val?: string): React.CSSProperties {
    if (val === 'Yes') return { background: '#EAF3DE', color: '#27500A' }
    if (val === 'No') return { background: '#FCEBEB', color: '#791F1F' }
    if (val === 'NA') return { background: '#F4F5F7', color: '#9BA3BA' }
    return { background: '#F4F5F7', color: '#9BA3BA' }
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className={`py-2.5 flex justify-between items-center ${hasData && !isPalletOne ? 'cursor-pointer select-none' : ''}`}
        onClick={hasData && !isPalletOne ? () => setExpanded(e => !e) : undefined}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green-50 border-2 border-green-700 flex items-center justify-center text-xs font-bold text-green-800">
            {session.no}
          </div>
          <div className="text-sm font-medium">Pallet #{session.no}</div>
          {hasData && !isPalletOne && (
            <ChevronDown
              size={14}
              className="text-gray-400 transition-transform duration-200"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-green-800">
            {session.wt || session.recheck?.at(-1)?.wt || '—'} kg
          </div>
          <div className="text-[11px] text-green-700">{isLastPallet ? 'Last pallet' : 'Pass'}</div>
        </div>
      </div>

      {expanded && hasData && (
        <div className="pb-3 pl-9 pr-1">
          {preItems45.map((item) => {
            const val = session.preChk45?.[item.id]
            return (
              <div key={item.id} className="flex items-start gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-gray-700 leading-snug mb-1">{item.item_label}</div>
                  {val ? (
                    <span
                      className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={chipStyle(val)}
                    >
                      {val}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">—</span>
                  )}
                </div>
              </div>
            )
          })}

          {showSampleType && (
            <div className="mt-1 flex items-start gap-2">
              <span className="text-[11px] text-gray-400 flex-shrink-0 mt-0.5">Sample</span>
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-lg"
                style={{ background: dc + '15', color: dc }}
              >
                {session.sampleType}
              </span>
            </div>
          )}
          {hasFailedAttempts && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="text-[10px] font-semibold text-amber-700 mb-1">
                แก้ไขแล้ว {(session.recheck ?? []).filter(r => !r.pass).length} ครั้ง:
              </div>
              {(session.recheck ?? []).filter(r => !r.pass).map((r, i) => (
                <div key={i} className="text-[10px] text-red-600">
                  Attempt {r.no}: {r.wt} kg —{' '}
                  {r.failReason === 'underweight' ? 'น้ำหนักน้อยเกินไป'
                   : r.failReason === 'overweight' ? 'น้ำหนักเกิน'
                   : 'ไม่ผ่าน'}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}