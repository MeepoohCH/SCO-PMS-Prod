import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    const lotsToDelete = await prisma.production_details.findMany({
      where: {
        detail_status: 'completed',
        updated_at: { gte: firstDayLastMonth, lte: lastDayLastMonth },
      },
      select: { id: true },
    })

    const ids = lotsToDelete.map(l => l.id)

    if (ids.length === 0) {
      return NextResponse.json({ message: 'No lots to delete', deleted: 0 })
    }

    const deleted = await prisma.production_details.deleteMany({
      where: { id: { in: ids } },
    })

    return NextResponse.json({
      message: 'Cleanup completed',
      deleted: deleted.count,
      period: {
        from: firstDayLastMonth.toISOString(),
        to: lastDayLastMonth.toISOString(),
      },
    })
  } catch (err) {
    console.error('[cron/cleanup] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
