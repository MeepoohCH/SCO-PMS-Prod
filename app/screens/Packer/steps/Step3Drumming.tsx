'use client'
import React, { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Card, Inp, Btn, Toggle, AutosaveTag, Combo, PalletRow, TimePicker, ConfirmModal } from '@/app/components/shared'
import { useUsers } from '../hooks/useUsers'
import { MDU_MACHINE_OPTS, LOCAL_EXPORT_IBC_OPTS, DRUM_MM_OPTS } from '@/app/components/constants'
import type { MduMachine, LocalExportIbc, DrumMmType, WtStandard } from '@/app/components/constants'
import type { Session, RecheckEntry, AutosaveStatus, ApiChecklistItem } from '../types'

export interface Step3DrummingProps {
  dc: string
  lotId: number
  lotDept: string
  totalP: number
  isTote: boolean
  // Sessions / pallet
  sessions: Session[]
  palletNo: number
  wtMachine: MduMachine | ''
  setWtMachine: (v: MduMachine | '') => void
  wtCategory: LocalExportIbc | ''
  setWtCategory: (v: LocalExportIbc | '') => void
  wtDrumType: DrumMmType | ''
  setWtDrumType: (v: DrumMmType | '') => void
  wtIbcSub: 'Local' | 'Export' | ''
  setWtIbcSub: (v: 'Local' | 'Export' | '') => void
  wtStandard: WtStandard | null
  sessionWt: string
  setSessionWt: (v: string) => void
  recheckList: RecheckEntry[]
  recheckDone: boolean
  wPass: boolean
  wFail: boolean
  // Drumming record
  drumStart: string
  setDrumStart: (v: string) => void
  drumAS: AutosaveStatus
  flushKg: string
  setFlushKg: (v: string) => void
  purgeKg: string
  setPurgeKg: (v: string) => void
  drainKg: string
  setDrainKg: (v: string) => void
  batchSizeKg: string
  setBatchSizeKg: (v: string) => void
  containerQty: string
  setContainerQty: (v: string) => void
  capLarge: string
  setCapLarge: (v: string) => void
  capSmall: string
  setCapSmall: (v: string) => void
  capXSmall: string
  setCapXSmall: (v: string) => void
  // Latex extra
  latexPrevProduct: string
  setLatexPrevProduct: (v: string) => void
  latexPrevProductName: string
  setLatexPrevProductName: (v: string) => void
  latexSample: string
  setLatexSample: (v: string) => void
  latexDrummer: string
  setLatexDrummer: (v: string) => void
  latexFlushKg: string
  setLatexFlushKg: (v: string) => void
  latexProductPurgeKg: string
  setLatexProductPurgeKg: (v: string) => void
  latexDrainKg: string
  setLatexDrainKg: (v: string) => void
  latexTotalKg: string
  setLatexTotalKg: (v: string) => void
  latexLot1Qty: string
  setLatexLot1Qty: (v: string) => void
  latexLot2Qty: string
  setLatexLot2Qty: (v: string) => void
  // Pre-check items 4-5
  preChk: Record<number, string>
  setPreChk: React.Dispatch<React.SetStateAction<Record<number, string>>>
  preItems45: ApiChecklistItem[]
  pre45Ok: boolean
  pre45Asked: boolean
  sampleType: string
  setSampleType: (v: string) => void
  missingFields: string[]
  isCompletingPallet?: boolean
  // Actions
  doPause: (type: string) => void
  doRecheck: () => void
  completePallet: () => Promise<void>
  readOnly?: boolean
  canClearDrumming?: boolean
  onClearDrumming?: () => Promise<void>
}

export function Step3Drumming({
  dc, lotId, lotDept, totalP, isTote,
  sessions, palletNo,
  wtMachine, setWtMachine, wtCategory, setWtCategory,
  wtDrumType, setWtDrumType, wtIbcSub, setWtIbcSub, wtStandard,
  sessionWt, setSessionWt,
  recheckList, recheckDone, wPass, wFail,
  drumStart, setDrumStart, drumAS,
  flushKg, setFlushKg, purgeKg, setPurgeKg, drainKg, setDrainKg,
  batchSizeKg, setBatchSizeKg,
  containerQty, setContainerQty, capLarge, setCapLarge, capSmall, setCapSmall, capXSmall, setCapXSmall,
  latexPrevProduct, setLatexPrevProduct,
  latexPrevProductName, setLatexPrevProductName,
  latexSample, setLatexSample,
  latexDrummer, setLatexDrummer,
  latexFlushKg, setLatexFlushKg,
  latexProductPurgeKg, setLatexProductPurgeKg,
  latexDrainKg, setLatexDrainKg,
  latexTotalKg, setLatexTotalKg,
  latexLot1Qty, setLatexLot1Qty, latexLot2Qty, setLatexLot2Qty,
  preChk, setPreChk, preItems45, pre45Ok, pre45Asked,
  sampleType, setSampleType,
  missingFields,
  isCompletingPallet,
  doPause, doRecheck, completePallet,
  readOnly,
  canClearDrumming,
  onClearDrumming,
}: Step3DrummingProps) {

  const { userOpts } = useUsers()
  const [showClearDrummingConfirm, setShowClearDrummingConfirm] = useState(false)
  const [clearingDrumming, setClearingDrumming] = useState(false)

  async function handleClearDrumming() {
    setClearingDrumming(true)
    try {
      if (onClearDrumming) await onClearDrumming()
      setShowClearDrummingConfirm(false)
    } finally {
      setClearingDrumming(false)
    }
  }

  const isLastPallet = palletNo === totalP
  const allPalletsDone = sessions.length >= totalP

  const item4 = preItems45[0]
  const item5 = preItems45[1]
  const chk4  = item4 ? preChk[item4.id] : undefined
  const chk5  = item5 ? preChk[item5.id] : undefined

  const drummingNotes = lotDept === 'IBC'
    ? [
        'Product ที่ drain จาก Strainer ให้กำจัดเป็น Polyol waste เท่านั้น',
        'Product ที่ drain จาก Blender ห้ามนำมาเติมเพื่อทำน้ำหนัก',
        'ห้าม drumming CP 1055 ต่อจาก RA 440',
        'จุดที่ใช้ในการทวนสอบเครื่องชั่งถูกระบุในตารางด้านบน',
        'ใช้ drum มาตรฐาน น้ำหนักที่ 210 kg หรือ Tote 1000 Kg เป็นมาตรฐาน',
        'หากผลการชั่งสอบทวนไม่ได้อยู่ในช่วงที่ควบคุม ต้องแจ้ง Site logistics โดยทันที',
      ]
    : [
        'จุดที่ใช้ในการทวนสอบเครื่องชั่งถูกระบุในตารางด้านบน',
        'ใช้ drum มาตรฐาน น้ำหนักที่ 210 kg หรือ Tote 1000 Kg เป็นมาตรฐาน',
        'หากผลการชั่งสอบทวนไม่ได้อยู่ในช่วงที่ควบคุม ต้องแจ้ง Site logistics โดยทันที',
      ]

  return (
    <fieldset disabled={readOnly} className="border-0 p-0 m-0">
    <div>
      {/* Progress card */}
      <Card className="mb-3 border" style={{ background: dc + '0a', borderColor: dc }}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="text-xs font-medium" style={{ color: dc }}>{allPalletsDone ? 'Session complete' : 'Session in progress'}</div>
            <div className="text-[11px] text-gray-400">{sessions.length} pallets done</div>
          </div>
          <div className="text-3xl font-bold" style={{ color: dc }}>
            #{Math.min(palletNo, totalP)}<span className="text-sm text-gray-400 font-normal">/{totalP}</span>
          </div>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${totalP ? (sessions.length / totalP) * 100 : 0}%`, background: dc }} />
        </div>
      </Card>

      {/* Drumming record */}
      <Card className="mb-3">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Drumming record - lot-level</div>
          <AutosaveTag status={drumAS} />
        </div>
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4">
          <div className="text-[11px] font-bold text-amber-800 mb-2">หมายเหตุ</div>
          {drummingNotes.map((t, i) => (
            <div key={i} className="flex gap-1.5 mb-1">
              <span className="text-[11px] text-amber-700 font-bold flex-shrink-0">
                {lotDept === 'IBC' ? i + 1 : i + 4}.
              </span>
              <span className="text-[11px] text-amber-700 leading-relaxed">{t}</span>
            </div>
          ))}
        </div>
          <TimePicker label="Drumming start time" value={drumStart} onChange={setDrumStart} req />

        {/* Latex extra fields */}
        {lotDept === 'Latex' && (
          <div className="bg-white border-2 border-emerald-600 rounded-xl p-4 mb-4">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide mb-4">Latex - ข้อมูลเพิ่มเติม</div>
            {[
              { label: 'Set น้ำหนักที่ Auto Drumming โดย', val: latexPrevProduct,     setVal: setLatexPrevProduct,     placeholder: 'ค้นหาชื่อผู้ Set...',             isPerson: true  },
              { label: 'Product ที่โหลดก่อนหน้านี้',         val: latexPrevProductName, setVal: setLatexPrevProductName, placeholder: 'ระบุชื่อ Product...',             isPerson: false },
              { label: 'เก็บ Sample ส่ง Lab',               val: latexSample,          setVal: setLatexSample,          placeholder: 'ระบุรายละเอียด Sample...',         isPerson: false },
              { label: 'ผู้ที่ทำการ drumming',               val: latexDrummer,         setVal: setLatexDrummer,         placeholder: 'ค้นหาชื่อผู้ทำการ Drumming...',   isPerson: true  },
            ].map(({ label, val, setVal, placeholder, isPerson }) => (
              <div key={label} className="mb-3">
                <div className="text-xs text-gray-600 font-medium mb-1.5">
                  <span className="text-[#E24B4A]">* </span>{label}
                </div>
                {isPerson
                  ? <Combo value={val} onChange={setVal} opts={userOpts} placeholder={placeholder} />
                  : <input value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder}
                      className="w-full text-sm p-3 border border-gray-200 rounded-lg outline-none min-h-[44px]" />
                }
              </div>
            ))}
            <div className="mb-3">
              <div className="text-xs text-gray-600 font-medium mb-1.5">
                <span className="text-[#E24B4A]">* </span>จำนวน Product ที่ flush ก่อนการ drumming (kg)
              </div>
              <input type="number" value={latexFlushKg} onChange={e => setLatexFlushKg(e.target.value)} placeholder="0.00"
                onWheel={e => e.currentTarget.blur()}
                onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault() }}
                className="w-full text-sm p-3 border border-gray-200 rounded-lg outline-none min-h-[44px]" />
            </div>
          </div>
        )}

        <div className="text-xs font-medium text-gray-600 mb-2">เศษ Packaging (kg)</div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {lotDept === 'Latex' ? (
            <>
              <Inp label="Product Purge" type="text" value={latexProductPurgeKg} onChange={setLatexProductPurgeKg} placeholder="-" req />
              <Inp label="Drain"         type="text" value={latexDrainKg}        onChange={setLatexDrainKg}        placeholder="-" req />
              <Inp label="Total"         type="text" value={latexTotalKg}         onChange={setLatexTotalKg}         placeholder="-" req />
            </>
          ) : (
            <>
              <Inp label="Flush" type="text" value={flushKg} onChange={setFlushKg} placeholder="-" req />
              <Inp label="Purge" type="text" value={purgeKg} onChange={setPurgeKg} placeholder="-" req />
              <Inp label="Drain" type="text" value={drainKg} onChange={setDrainKg} placeholder="-" req />
            </>
          )}
        </div>
        <Inp label="น้ำหนักรวมที่บรรจุได้ Kg. (Batch size)" type="text" value={batchSizeKg} onChange={setBatchSizeKg} placeholder="กรอกตัวเลข หรือ -" req />
        <div className="text-xs font-medium text-gray-600 mb-2">
          จำนวนภาชนะที่ใช้ไปทั้งหมด
        </div>
        {lotDept === 'Latex' ? (
          <div className="flex flex-col gap-2">
            {[{ label: 'Lot 1', val: latexLot1Qty, set: setLatexLot1Qty }, { label: 'Lot 2', val: latexLot2Qty, set: setLatexLot2Qty }].map(({ label, val, set }) => (
              <div key={label} className="bg-gray-100 rounded-xl p-3">
                <div className="text-[11px] font-bold text-gray-600 mb-2">{label}</div>
                <Inp label="Drum / Tote (ใบ)" type="text" value={val} onChange={set} placeholder="-" req />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
                <Inp label={isTote ? 'Tote (ใบ)' : 'Drum (ใบ)'} type="text" value={containerQty} onChange={setContainerQty} placeholder="-" req />
                <Inp label={isTote ? 'Drum (ใบ)' : 'Tote (ใบ)'} type="text" value={capLarge} onChange={setCapLarge} placeholder="-" req />
            <Inp label="ฝา Cap ใหญ่ (ใบ)" type="text" value={capSmall} onChange={setCapSmall} placeholder="-" req />
            <Inp label="ฝา Cap เล็ก (ใบ)" type="text" value={capXSmall} onChange={setCapXSmall} placeholder="-" req />
          </div>
        )}
      </Card>

      {/* Completed pallets */}
      {sessions.length > 0 && (
        <Card className="mb-3">
          <div className="text-xs font-medium text-green-800 mb-3">Completed pallets ({sessions.length}/{totalP})</div>
          {sessions.map((s, i) => (
            <PalletRow
              key={i}
              session={s}
              preItems45={preItems45}
              dept={lotDept}
              dc={dc}
              totalP={totalP}
            />
          ))}
        </Card>
      )}

      {/* Recheck weight */}
      {allPalletsDone ? (
        <Card className="mb-3 text-center py-8">
          <div className="text-lg font-bold text-green-800 mb-1">
            ✓ ครบ {totalP} pallets แล้ว
          </div>
          <div className="text-xs text-gray-500">
            กดปุ่มด้านล่างเพื่อไปขั้นตอน Post-Drumming Checklist
          </div>
        </Card>
      ) : (
      <Card className="mb-3">
        <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Recheck weight - Pallet #{palletNo}</div>
        <div className="text-xs font-medium text-gray-600 mb-2">MDU Machine</div>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {MDU_MACHINE_OPTS.map(m => (
            <button key={m} onClick={() => setWtMachine(m)}
              className="p-2.5 rounded-lg text-center cursor-pointer border min-h-[44px] text-sm font-semibold"
              style={{ borderColor: wtMachine === m ? dc : '#DDE2EE', background: wtMachine === m ? dc + '10' : '#fff', color: wtMachine === m ? dc : '#5A617A' }}>
              {m}
            </button>
          ))}
        </div>

        <div className="text-xs font-medium text-gray-600 mb-2">Local / Export / IBC Tote</div>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {LOCAL_EXPORT_IBC_OPTS.map(c => (
            <button key={c} onClick={() => { setWtCategory(c); setWtDrumType(''); setWtIbcSub(''); }}
              className="p-2.5 rounded-lg text-center cursor-pointer border min-h-[44px] text-sm font-semibold"
              style={{ borderColor: wtCategory === c ? dc : '#DDE2EE', background: wtCategory === c ? dc + '10' : '#fff', color: wtCategory === c ? dc : '#5A617A' }}>
              {c}
            </button>
          ))}
        </div>

        {wtCategory === 'IBC Tote' && wtMachine === 'MDU2451/52' && (
          <div className="mb-3">
            <div className="text-[11px] text-gray-500 mb-1.5">IBC Tote — ระบุ Local/Export (ค่าต่างกัน)</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['Local', 'Export'] as const).map(s => (
                <button key={s} onClick={() => setWtIbcSub(s)}
                  className="p-2 rounded-lg text-center cursor-pointer border min-h-[40px] text-xs font-semibold"
                  style={{ borderColor: wtIbcSub === s ? dc : '#DDE2EE', background: wtIbcSub === s ? dc + '10' : '#fff', color: wtIbcSub === s ? dc : '#5A617A' }}>
                  {s} ({s === 'Local' ? '1060' : '760'} kg)
                </button>
              ))}
            </div>
          </div>
        )}

        {(wtCategory === 'Local' || wtCategory === 'Export') && (
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-600 mb-2">Drum type</div>
            <div className="grid grid-cols-3 gap-1.5">
              {DRUM_MM_OPTS.map(dt => (
                <button key={dt} onClick={() => setWtDrumType(dt)}
                  className="p-2.5 rounded-lg text-center cursor-pointer border min-h-[44px] text-xs font-semibold"
                  style={{ borderColor: wtDrumType === dt ? dc : '#DDE2EE', background: wtDrumType === dt ? dc + '10' : '#fff', color: wtDrumType === dt ? dc : '#5A617A' }}>
                  {dt}
                </button>
              ))}
            </div>
          </div>
        )}

        {wtStandard ? (
          <div className="mb-4 p-3 rounded-xl border-2" style={{ borderColor: dc, background: dc + '0a' }}>
            <div className="text-[11px] text-gray-500 mb-0.5">Standard weight (matched)</div>
            <div className="text-lg font-bold" style={{ color: dc }}>{wtStandard.ref} ± {wtStandard.tol} kg</div>
          </div>
        ) : (
          <div className="mb-4 text-[11px] text-gray-400">เลือกตัวเลือกด้านบนให้ครบเพื่อดูค่ามาตรฐาน</div>
        )}

        {isLastPallet && (
          <div className="flex items-center gap-2 p-3 rounded-xl border mb-4"
            style={{ borderColor: '#EF9F27', background: '#FEF3C7' }}>
            <span className="text-base">⚠</span>
            <div>
              <div className="text-xs font-semibold text-amber-800">
                Pallet สุดท้าย — ไม่เช็คน้ำหนักตามมาตรฐาน
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                Pallet นี้อาจมี drum/tote ไม่ครบจำนวนมาตรฐาน ระบบจะบันทึกน้ำหนักโดยไม่ตัดสิน PASS/FAIL
              </div>
            </div>
          </div>
        )}
        {recheckList.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] font-medium text-gray-400 mb-2">Recheck history</div>
            <div className="flex gap-1.5 flex-wrap">
              {recheckList.map((r, i) => (
                <div key={i} className="px-2.5 py-1.5 rounded-lg text-center border"
                  style={{ background: r.pass ? '#EAF3DE' : '#FCEBEB', borderColor: r.pass ? '#27500A' : '#E24B4A' }}>
                  <div className="text-[9px] font-medium" style={{ color: r.pass ? '#27500A' : '#791F1F' }}>Att. {r.no}</div>
                  <div className="text-sm font-bold" style={{ color: r.pass ? '#27500A' : '#791F1F' }}>{r.wt}kg</div>
                  <div className="text-[10px]" style={{ color: r.pass ? '#27500A' : '#791F1F' }}>{r.pass ? '✓' : '✗'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!recheckDone ? (
          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">
              Pallet #{palletNo} weight - attempt {recheckList.length + 1}{' '}
              {wtStandard && (
                <span className="text-[11px] text-gray-400 font-normal">
                  (range: {wtStandard.ref - wtStandard.tol}–{wtStandard.ref + wtStandard.tol} kg)
                </span>
              )}
            </div>
              <input
                type="text"
                inputMode="decimal"
                value={sessionWt}
                disabled={!wtStandard}
                onChange={e => {
                  const val = e.target.value;
                  if (/^-?\d*\.?\d*$/.test(val) || val === '') {
                    setSessionWt(val);
                  }
                }}
                placeholder={wtStandard ? `${wtStandard.ref}` : 'เลือกตัวเลือกด้านบนก่อน'}
                className="w-full text-3xl font-bold text-center p-4 rounded-xl outline-none border-2 min-h-[72px]"
                style={{
                  borderColor: wFail ? '#E24B4A' : wPass ? '#27500A' : '#DDE2EE',
                  background: wFail ? '#FCEBEB' : wPass ? '#EAF3DE' : '#fff'
                }}
              />
            {sessionWt && (
              <div className={`mt-3 p-3 rounded-xl border text-center ${
                isLastPallet ? 'bg-amber-50 border-amber-400' : wPass ? 'bg-green-50 border-green-700' : 'bg-red-50 border-red-400'
              }`}>
                <div className={`text-base font-bold ${
                  isLastPallet ? 'text-amber-800' : wPass ? 'text-green-800' : 'text-red-800'
                }`}>
                  {isLastPallet ? '⚠ บันทึกแล้ว (pallet สุดท้าย — ไม่เช็ค tolerance)' : wPass ? '✓ PASS' : '✗ FAIL'}
                </div>
                {!isLastPallet && wFail && wtStandard && (
                  <div className="text-xs text-red-700 mt-1">
                    {+sessionWt < wtStandard.ref ? 'Underweight → top up drum' : 'Overweight → remove product'}
                  </div>
                )}
              </div>
            )}
            {sessionWt && (
              <div className="mt-3">
                <Btn
                  label={isLastPallet ? 'Record (pallet สุดท้าย)' : wPass ? '✓ Record PASS' : 'Record FAIL → fix and retry'}
                  color={isLastPallet ? '#854F0B' : wPass ? '#27500A' : '#854F0B'}
                  full
                  onClick={doRecheck}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-green-50 border-2 border-green-700 rounded-xl p-4 text-center">
            <div className="text-lg font-bold text-green-800 mb-1">✓ Recheck PASS</div>
            <div className="text-xs text-green-700">Pallet #{palletNo} · {recheckList.length} attempt{recheckList.length > 1 ? 's' : ''}</div>
          </div>
        )}
      </Card>
      )}

      {/* Pre-checklist items 4-5 */}
      {recheckDone && pre45Asked && preItems45.length > 0 && (
        <Card className="mb-3 border-2"
          style={{
            borderColor: pre45Ok ? '#27500A' : chk4 === 'No' || chk5 === 'No' ? '#E24B4A' : '#9D174D',
            background:  pre45Ok ? '#EAF3DE' : chk4 === 'No' || chk5 === 'No' ? '#FCEBEB' : '#FDF2F8',
          }}>
          <div className="text-xs font-semibold mb-3"
            style={{ color: pre45Ok ? '#27500A' : chk4 === 'No' || chk5 === 'No' ? '#791F1F' : '#9D174D' }}>
            Checklist ข้อ 4-5 {pre45Ok ? '- ตอบแล้ว' : '- ตอบก่อนดำเนินการต่อ'}
          </div>
          <div className="mb-3 p-3 rounded-xl bg-white border"
            style={{ borderColor: chk4 ? chk4 === 'No' ? '#E24B4A' : '#27500A' : '#DDE2EE' }}>
            <div className="text-sm text-gray-900 leading-relaxed mb-2">
              {item4?.item_label}
            </div>
            <Toggle opts={item4?.select_options ?? ['Yes', 'No', 'NA']} value={chk4 ?? ''}
              onChange={v => item4 && setPreChk(p => ({ ...p, [item4.id]: v }))} />
            {chk4 === 'No' && (
              <div className="mt-3 bg-red-50 border border-red-300 rounded-lg p-3">
                <div className="text-xs font-semibold text-red-800 mb-2">พบปัญหา - ต้อง log issue และแจ้ง SL</div>
                <Btn label="บันทึก Issue Log + แจ้ง SL" danger full onClick={() => doPause('paused_issue')} />
              </div>
            )}
          </div>
          {(chk4 === 'Yes' || chk4 === 'NA') && item5 && (
            <div className="p-3 rounded-xl bg-white border"
              style={{ borderColor: chk5 ? chk5 === 'No' ? '#E24B4A' : sampleType ? '#27500A' : '#EF9F27' : '#DDE2EE' }}>
              <div className="text-sm text-gray-900 leading-relaxed mb-2">
                {item5?.item_label}
              </div>
              <Toggle opts={item5?.select_options ?? ['Yes', 'No', 'NA']} value={chk5 ?? ''}
                onChange={v => { if (item5) setPreChk(p => ({ ...p, [item5.id]: v })); if (v !== 'Yes') setSampleType('') }} />
              {chk5 === 'Yes' && (
                <div className="mt-3 p-3 bg-gray-100 rounded-lg">
                  <div className="text-xs font-medium text-gray-600 mb-2">เลือกชนิด Sample <span className="text-red-500">*</span></div>
                  <div className="flex flex-col gap-2">
                    {[
                      { k: 'polyol',   l: 'Polyol Product',                      v: '= 250 ml' },
                      { k: 'rigid',    l: 'Rigid FM Product',                     v: '= 500 ml.' },
                      { k: 'specflex', l: 'Flexible FM Product (Specflex NF)',    v: '= 1000 ml' },
                    ].map(s => (
                      <button key={s.k} onClick={() => setSampleType(`${s.l} ${s.v}`)}
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer text-left border-2 min-h-[52px]"
                        style={{
                          borderColor: sampleType === `${s.l} ${s.v}` ? '#1D9E75' : '#DDE2EE',
                          background:  sampleType === `${s.l} ${s.v}` ? '#E1F5EE' : '#fff',
                        }}>
                        <div className="w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center"
                          style={{
                            borderColor: sampleType === `${s.l} ${s.v}` ? '#1D9E75' : '#9BA3BA',
                            background:  sampleType === `${s.l} ${s.v}` ? '#1D9E75' : '#fff',
                          }}>
                          {sampleType === `${s.l} ${s.v}` && <span className="text-white text-[11px] font-bold">✓</span>}
                        </div>
                        <div>
                          <div className="text-sm" style={{ fontWeight: sampleType === `${s.l} ${s.v}` ? 600 : 400, color: sampleType === `${s.l} ${s.v}` ? '#04342C' : '#0E1117' }}>{s.l}</div>
                          <div className="text-[11px] text-emerald-600 mt-0.5">{s.v}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {recheckDone && !readOnly && sessions.length < totalP && (
        <Card className="mb-3">
          <Btn
            label={sessions.length + 1 < totalP
              ? `Pallet #${palletNo} done - next pallet #${palletNo + 1}`
              : 'All pallets done - Post-Drumming Checklist'}
            color={sessions.length + 1 >= totalP ? '#9D174D' : dc} full
            disabled={(pre45Asked && !pre45Ok) || missingFields.length > 0 || isCompletingPallet}
            onClick={completePallet} />
          {missingFields.length > 0 && (
            <div className="text-[11px] text-amber-700 text-center mt-2">
              กรุณากรอกข้อมูลให้ครบ: {missingFields.join(', ')}
            </div>
          )}
        </Card>
      )}
      {canClearDrumming && !readOnly && (
        <div className="flex justify-center mt-2 mb-1">
          <button type="button" onClick={() => setShowClearDrummingConfirm(true)}
            className="text-[11px] text-[#9BA3BA] underline cursor-pointer bg-transparent border-none">
            ล้างข้อมูล Drumming และเริ่ม Pallet ใหม่
          </button>
        </div>
      )}
    </div>

    <ConfirmModal
      open={showClearDrummingConfirm}
      title="ล้างข้อมูล Drumming?"
      message="ข้อมูล Pallet และน้ำหนักที่บันทึกไว้ทั้งหมดจะถูกลบ ต้องเริ่มทำ Pallet ใหม่ทั้งหมด การกระทำนี้ไม่สามารถย้อนกลับได้"
      confirmLabel={clearingDrumming ? 'กำลังล้าง...' : 'ยืนยันล้างข้อมูล'}
      cancelLabel="Cancel"
      confirmColor="#E24B4A"
      confirmDisabled={clearingDrumming}
      icon={<RotateCcw size={44} />}
      onCancel={() => !clearingDrumming && setShowClearDrummingConfirm(false)}
      onConfirm={handleClearDrumming}
    />
    </fieldset>
  )
}
