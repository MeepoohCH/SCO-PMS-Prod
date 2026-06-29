'use client'
import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { fetchAndFlattenLots } from '@/lib/fetchLots'
import PKFormViewer from '@/app/components/PKFormViewer'
import type { LotStatus } from './types'
import type { Lot } from './types'
import { PKDashboard } from './PKDashboard'
import { PKForm } from './PKForm'

const LOCKED_STATUSES: LotStatus[] = ['submitted', 'head_approved', 'sl_rejected', 'completed']

async function submitLot(lotId: number) {
  const res = await fetch(`/api/lots/${lotId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'submitted' }),
  })
  return res.json()
}

export default function App() {
  const { data: session } = useSession()
  const [lots, setLots] = useState<Lot[]>([])
  const [activeLot, setActiveLot] = useState<Lot | null>(null)
  const [viewingLot, setViewingLot] = useState<Lot | null>(null)
  const [pkView, setPkView] = useState<'list' | 'form' | 'viewer'>('list')
  const user = session?.user?.full_name ?? ''

  async function refresh() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchAndFlattenLots() as any[]
    setLots(data.map(l => ({
      ...l,
      planned_pallets: Number(l.planned_pallets ?? 0),
      done_pallets:    Number(l.actual_pallet_count ?? l.done_pallets ?? 0),
    })) as Lot[])
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (!activeLot) return
    const updated = lots.find(l => l.id === activeLot.id)
    if (updated && updated !== activeLot) {
      setActiveLot(prev => prev ? { ...updated, fixSection: prev.fixSection } : updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots])

  async function handleSubmit(data: Record<string, unknown>) {
    setLots(p => p.map(l => l.id === activeLot?.id ? { ...l, status: 'submitted' as LotStatus, ...data } : l))
    if (activeLot) await submitLot(activeLot.id)
    setActiveLot(null)
    setPkView('list')
    await refresh()
  }

  function openLot(lot: Lot) {
    if (LOCKED_STATUSES.includes(lot.status)) {
      setViewingLot(lot)
      setPkView('viewer')
    } else {
      setActiveLot({ ...lot, current_pk_step: lot.current_pk_step ?? 0, fixSection: null })
      setPkView('form')
    }
  }

  return (
    <div className="font-sans">
      <div className="pb-24">
        {pkView === 'list' && (
          <PKDashboard lots={lots} setLots={setLots} onOpen={openLot} />
        )}
        {pkView === 'form' && activeLot && (
          <PKForm
            lot={activeLot}
            onBack={() => { setPkView('list'); setActiveLot(null) }}
            onSubmit={handleSubmit}
            currentUser={user}
            setLots={setLots}
          />
        )}
        {pkView === 'viewer' && viewingLot && (
          <PKFormViewer
            lot={viewingLot as any}
            onBack={() => { setPkView('list'); setViewingLot(null) }}
            readOnly={true}
            setLots={setLots as any}
            currentUser={user}
          />
        )}
      </div>
    </div>
  )
}
