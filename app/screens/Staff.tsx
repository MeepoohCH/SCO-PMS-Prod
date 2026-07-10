'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import PKFormViewer from '@/app/components/PKFormViewer'
import { SuccessTab } from '@/app/screens/Login'
import { fetchAndFlattenLots } from '@/lib/fetchLots'
import type { Lot } from '@/app/screens/Admin'

export default function StaffScreen() {
  const { data: session } = useSession()
  const [lots, setLots] = useState<Lot[]>([])
  const [progressLot, setProgressLot] = useState<Lot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAndFlattenLots()
      .then(data => setLots(data as Lot[]))
      .finally(() => setLoading(false))
  }, [])

  if (progressLot) {
    return (
      <PKFormViewer
        lot={progressLot as any}
        onBack={() => setProgressLot(null)}
        currentUser=""
        setLots={setLots as any}
        readOnly={true}
      />
    )
  }

  if (loading) {
    return <div className="text-center py-12 text-[#9BA3BA]">Loading...</div>
  }

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-medium text-[#0F2347]">Staff View</div>
        <div className="text-xs text-[#9BA3BA] mt-0.5">ดูข้อมูล lot (read-only)</div>
      </div>
      <SuccessTab
        lots={lots}
        isAdmin={false}
        onViewProgress={lot => setProgressLot(lot as Lot)}
      />
    </div>
  )
}