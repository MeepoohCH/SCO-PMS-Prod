'use client'
import React from 'react'
import { Card, Inp, Btn, Combo } from '@/app/components/shared'
import { useUsers } from '../hooks/useUsers'
import type { Lot, AutosaveStatus } from '../types'

export interface Step0DateProps {
  lot: Lot
  dc: string
  opDate: string
  setOpDate: (v: string) => void
  opAS: AutosaveStatus
  latexNoBact: string
  setLatexNoBact: (v: string) => void
  latexNoBactBy: string
  setLatexNoBactBy: (v: string) => void
  latexTemp: string
  setLatexTemp: (v: string) => void
  latexTempBy: string
  setLatexTempBy: (v: string) => void
  labelCheck: string
  setLabelCheck: (v: string) => void
  onNext: () => void
  onNextSkipSave?: () => void
  readOnly?: boolean
}

export function Step0Date({
  lot, dc,
  opDate, setOpDate, opAS,
  latexNoBact, setLatexNoBact, latexNoBactBy, setLatexNoBactBy,
  latexTemp, setLatexTemp, latexTempBy, setLatexTempBy,
  labelCheck, setLabelCheck,
  onNext,
  onNextSkipSave,
  readOnly,
}: Step0DateProps) {
  const { userOpts } = useUsers()

  const labelOk = labelCheck === 'yes'
  const labelNo = labelCheck === 'no'

  const latexPreScaleOk = lot.dept !== 'Latex' || (
    !!latexNoBact && !!latexNoBactBy &&
    !!latexTemp   && !!latexTempBy
  )

  const nextDisabled =
    !opDate ||
    !labelCheck ||
    labelNo ||        // No = ล็อคไว้จนกว่าจะเปลี่ยนเป็น Yes
    !latexPreScaleOk

  async function handleNext() {
    await fetch(`/api/lots/${lot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation_date: opDate,
        label_check: labelCheck,
        sl_follow: null,
        current_pk_step: 1,
      }),
    }).catch(err => console.error('[Step0Date] save failed:', err))
    onNext()
  }

  return (
    <fieldset disabled={readOnly} className="border-0 p-0 m-0">
    <Card>
      <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Step 0 - Record operation date</div>
      {!readOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-900">วันที่กรอกอัตโนมัติจากวันนี้ — แก้ได้ถ้าไม่ถูกต้อง</div>
      )}
      {readOnly ? (
        <div className="bg-[#F8FAFC] border border-[#DDE2EE] rounded-xl px-4 py-3 mb-4">
          <div className="text-[10px] text-[#9BA3BA] font-medium mb-0.5">Operation date</div>
          <div className="text-[13px] font-medium text-[#0E1117]">
            {opDate ? opDate.split('-').reverse().join('-') : '—'}
          </div>
        </div>
      ) : (
        <Inp label="Operation date" type="date" value={opDate} onChange={setOpDate} req autoSaveStatus={opAS} />
      )}

      {/* Latex pre-scale check */}
      {lot.dept === 'Latex' && (
        <Card className="mb-3" style={{ borderTop: '3px solid #1D9E75' }}>
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Latex - ตรวจสอบก่อน Scale</div>
          {[
            { q: 'Product ไม่มีแบคทีเรีย', val: latexNoBact, setVal: setLatexNoBact, byVal: latexNoBactBy, setByVal: setLatexNoBactBy },
            { q: 'อุณหภูมิต้องต่ำกว่า 40°C',    val: latexTemp,   setVal: setLatexTemp,   byVal: latexTempBy,   setByVal: setLatexTempBy   },
          ].map(({ q, val, setVal, byVal, setByVal }) => (
            <div key={q} className="mb-4">
              <div className="text-sm text-gray-900 mb-2">{q}</div>
              <div className="flex gap-2 mb-2">
                {['ใช่', 'ไม่ใช่'].map(v => (
                  <button key={v} onClick={() => setVal(v)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer border min-h-[48px]"
                    style={{
                      borderColor: val === v ? (v === 'ใช่' ? '#27500A' : '#E24B4A') : '#DDE2EE',
                      background:  val === v ? (v === 'ใช่' ? '#EAF3DE' : '#FCEBEB') : '#F4F5F7',
                      color:       val === v ? (v === 'ใช่' ? '#27500A' : '#791F1F') : '#9BA3BA',
                    }}>
                    {v}
                  </button>
                ))}
              </div>
              <div className="text-[11px] text-gray-400 mb-1">ให้ข้อมูลโดย</div>
              <Combo value={byVal} onChange={setByVal} opts={userOpts} placeholder="ค้นหาชื่อผู้ให้ข้อมูล..." />
            </div>
          ))}
        </Card>
      )}

      {/* Label verification */}
      {opDate && (
        <div className="mb-3">
          <div className={`bg-white border-2 rounded-xl p-4 ${labelCheck ? labelOk ? 'border-green-700' : labelNo ? 'border-red-400' : 'border-gray-200' : 'border-gray-200'}`}>
            <div className="text-sm font-semibold text-gray-900 mb-1">Label ที่รับมาตรงกับ Plan ในระบบหรือไม่?</div>
            <div className="text-[11px] text-gray-400 mb-3">
              {lot.label_no_start && lot.label_no_end
                ? `Label No. ${lot.label_no_start} - ${lot.label_no_end} · จำนวน ${lot.label_count || '-'} ใบ`
                : 'ตรวจสอบ Label No. ใน Plan'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[['yes', 'Yes - ตรงกัน', '#27500A', '#EAF3DE'], ['no', 'No - ไม่ตรง', '#E24B4A', '#FCEBEB']].map(([k, lb, color, bg]) => (
                <button key={k} onClick={() => setLabelCheck(k)}
                  className="p-3 rounded-xl text-sm font-semibold cursor-pointer border-2 min-h-[48px]"
                  style={{ borderColor: labelCheck === k ? color : '#DDE2EE', background: labelCheck === k ? bg : '#F4F5F7', color: labelCheck === k ? color : '#9BA3BA' }}>
                  {lb}
                </button>
              ))}
            </div>
          </div>

          {/* No = ล็อค แสดงข้อความให้ไปเปลี่ยน Label */}
          {labelNo && (
            <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 mt-3">
              <div className="text-sm font-bold text-red-800 mb-1">⚠ Label ไม่ตรงกับระบบ</div>
              <div className="text-xs text-red-700 leading-relaxed">
                กรุณานำ Label เดิมคืน แล้วรับ Label ใหม่ให้ตรงกับข้อมูลในระบบ
                จากนั้นกลับมากด <strong>Yes</strong> เพื่อดำเนินการต่อ
              </div>
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <Btn label="Next: Pre-check" color={dc} full disabled={nextDisabled} onClick={handleNext} />
      )}
    </Card>
    </fieldset>
  )
}