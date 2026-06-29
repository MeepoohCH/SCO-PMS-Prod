'use client'
import React from 'react'
import { Card, Btn, Toggle, AutosaveTag, Combo } from '@/app/components/shared'
import { useUsers } from '../hooks/useUsers'
import type { AutosaveStatus, ApiChecklistItem } from '../types'

export interface Step4PostCheckProps {
  dc: string
  isIssueMode: boolean
  lotId: number
  lotDept: string
  postItems: ApiChecklistItem[]
  postChk: Record<number, string>
  setPostChk: React.Dispatch<React.SetStateAction<Record<number, string>>>
  postAS: AutosaveStatus
  latexStorageArea: string
  setLatexStorageArea: (v: string) => void
  latexTagStatus: string
  setLatexTagStatus: (v: string) => void
  latexTagBy: string
  setLatexTagBy: (v: string) => void
  postOk: boolean
  onComplete: () => Promise<void>
  readOnly?: boolean
}

export function Step4PostCheck({
  dc, isIssueMode, lotId, lotDept,
  postItems, postChk, setPostChk, postAS,
  latexStorageArea, setLatexStorageArea,
  latexTagStatus, setLatexTagStatus,
  latexTagBy, setLatexTagBy,
  postOk, onComplete,
  readOnly,
}: Step4PostCheckProps) {

  const { userOpts } = useUsers()

  return (
    <fieldset disabled={readOnly} className="border-0 p-0 m-0">
    <div>
      <div className="bg-pink-50 border border-pink-300 rounded-xl p-3 mb-3 flex justify-between items-center">
        <div className="text-xs text-pink-700">Post-Drumming Checklist · once per lot</div>
        <AutosaveTag status={postAS} />
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-xs text-blue-900">
        After you answer all items, <strong>lot_drumming_end will be auto-captured</strong>.
      </div>
      {lotDept === 'Latex' && (
        <Card className="mb-3" style={{ borderTop: '3px solid #1D9E75' }}>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Latex - ขั้นตอนการจัดเก็บ</div>
          {[
            { label: 'Product ถูกจัดเก็บในพื้นที่',         val: latexStorageArea, set: setLatexStorageArea, placeholder: 'ระบุพื้นที่จัดเก็บ...',    isPerson: false },
            { label: 'Tag ที่ใช้ในการบอกสถานะของ product', val: latexTagStatus,   set: setLatexTagStatus,   placeholder: 'ระบุ Tag...',               isPerson: false },
            { label: 'ตรวจสอบการติด Tag โดย',             val: latexTagBy,       set: setLatexTagBy,       placeholder: 'ค้นหาชื่อผู้ตรวจสอบ...',   isPerson: true  },
          ].map(({ label, val, set, placeholder, isPerson }) => (
            <div key={label} className="mb-3">
              <div className="text-xs text-gray-600 font-medium mb-1.5">
                <span className="text-[#E24B4A]">* </span>{label}
              </div>
              {isPerson
                ? <Combo value={val} onChange={set} opts={userOpts} placeholder={placeholder} />
                : <input value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                    className="w-full text-sm p-3 border border-gray-200 rounded-lg outline-none min-h-[44px]" />
              }
            </div>
          ))}
        </Card>
      )}
      {postItems.map((item, i) => (
        <Card key={item.id} className="mb-2 p-3" accentLeft={postChk[item.id] ? postChk[item.id] === 'No' ? '#E24B4A' : '#27500A' : '#DDE2EE'}>
          <div className="text-sm text-gray-900 leading-relaxed mb-2">
            {item.item_label}
          </div>
          <Toggle opts={item.select_options ?? ['Yes', 'No', 'NA']} value={postChk[item.id]} onChange={v => setPostChk(p => ({ ...p, [item.id]: v }))} />
        </Card>
      ))}
      {!isIssueMode && !readOnly && (
        <div className="sticky bottom-0 bg-gray-100 pt-3 pb-3 border-t border-gray-200">
          <Btn label="✓ บันทึก end time" color={dc} full disabled={!postOk} onClick={onComplete} />
          {!postOk && <div className="text-[11px] text-gray-400 text-center mt-2">Answer all items to continue</div>}
        </div>
      )}
    </div>
    </fieldset>
  )
}
