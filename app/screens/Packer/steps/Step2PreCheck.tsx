'use client'
import React from 'react'
import { Card, Btn, Toggle, AutosaveTag } from '@/app/components/shared'
import type { AutosaveStatus, ApiChecklistItem } from '../types'

export interface Step2PreCheckProps {
  dc: string
  isIssueMode: boolean
  lotId: number
  lotDept: string
  preItems: ApiChecklistItem[]
  preChk: Record<number, string>
  setPreChk: React.Dispatch<React.SetStateAction<Record<number, string>>>
  preAS: AutosaveStatus
  emptyDrumWt: string
  setEmptyDrumWt: (v: string) => void
  isTote: boolean
  preOk: boolean
  preFail: boolean
  doPause: (type: string) => void
  onBack: () => void
  onNext: () => void
  readOnly?: boolean
}

export function Step2PreCheck({
  dc, isIssueMode, lotId, lotDept,
  preItems, preChk, setPreChk, preAS,
  emptyDrumWt, setEmptyDrumWt, isTote,
  preOk, preFail,
  doPause, onBack, onNext,
  readOnly,
}: Step2PreCheckProps) {

  const preItemIds = new Set(preItems.map(i => i.id))
  const answeredLotLevelCount = Object.keys(preChk).filter(k => preItemIds.has(Number(k))).length

  async function handleNext() {
    try {
      await Promise.all(
        Object.entries(preChk).map(([itemId, value]) => {
          return fetch('/api/checklist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              production_detail_id: lotId,
              checklist_item_id:    Number(itemId),
              phase:                'pre',
              response_value:       value,
            }),
          })
        })
      )
      await fetch(`/api/lots/${lotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empty_drum_wt: Number(emptyDrumWt) || null, current_pk_step: 3 }),
      })
    } catch (err) {
      console.error('[Step2PreCheck] save failed:', err)
    }
    onNext()
  }

  return (
    <fieldset disabled={readOnly} className="border-0 p-0 m-0">
    <div>
      <div className="bg-pink-50 border border-pink-300 rounded-xl p-3 mb-3 flex justify-between items-center">
        <div className="text-xs text-pink-700">บันทึกข้อมูลการบรรจุ · ก่อนการ Drumming · {lotDept}</div>
        <AutosaveTag status={preAS} />
      </div>
      <Card className="mb-3 p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">ความคืบหน้า</span>
          <span className="text-lg font-bold" style={{ color: preOk ? '#27500A' : '#9D174D' }}>
            {answeredLotLevelCount}/{preItems.length}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full">
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${preItems.length ? (answeredLotLevelCount / preItems.length) * 100 : 0}%`,
              background: preOk ? '#27500A' : '#9D174D',
            }} />
        </div>
      </Card>
      {preItems.map((item, i) => (
        <Card key={item.id} className="mb-2 p-3" accentLeft={preChk[item.id] ? preChk[item.id] === 'No' ? '#E24B4A' : '#27500A' : '#DDE2EE'}>
          <div className="text-sm text-gray-900 leading-relaxed mb-2">
            {item.item_label}
          </div>
          <Toggle opts={item.select_options ?? ['Yes', 'No']} value={preChk[item.id]} onChange={v => setPreChk(p => ({ ...p, [item.id]: v }))} />
          {i === 2 && preChk[item.id] === 'Yes' && (
            <div className="mt-3 p-3 bg-gray-100 rounded-lg">
              <div className="text-xs font-medium text-gray-600 mb-2">น้ำหนักถังเปล่า (kg) <span className="text-red-500">*</span></div>
              <div className="flex gap-2 items-center">
                <input type="number" value={emptyDrumWt} onChange={e => setEmptyDrumWt(e.target.value)}
                  onWheel={e => e.currentTarget.blur()}
                  onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                  placeholder="กรอกน้ำหนัก..."
                  className="flex-1 text-sm p-2.5 border rounded-lg outline-none min-h-[44px]"
                  style={{ borderColor: !emptyDrumWt ? '#DDE2EE' : +emptyDrumWt > 0 && (isTote || +emptyDrumWt <= 20) ? '#27500A' : '#E24B4A' }} />
                <span className="text-[11px] text-gray-400">kg</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">Drum: ≤ 20 kg / Tote: เกิน 20 kg ได้</div>
            </div>
          )}
          {i === 2 && preChk[item.id] === 'No' && (
            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">บันทึกว่าไม่ได้วัด — ดำเนินการต่อได้</div>
          )}
        </Card>
      ))}
      {preFail && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 mb-3">
          <div className="text-sm font-semibold text-red-800 mb-2">Checklist ไม่ผ่าน - ต้อง Pause</div>
          <Btn label="Pause + Log Issue" danger full onClick={() => doPause('paused_issue')} />
        </div>
      )}
      {!isIssueMode && !readOnly && (
        <div className="grid gap-3 sticky bottom-0 bg-gray-100 pt-3 pb-3 border-t border-gray-200" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <Btn label="Back: Scale" color="#9BA3BA" outline onClick={onBack} />
          <Btn label="เริ่ม Drumming" color={dc} full disabled={!preOk || preFail} onClick={handleNext} />
        </div>
      )}
    </div>
    </fieldset>
  )
}
