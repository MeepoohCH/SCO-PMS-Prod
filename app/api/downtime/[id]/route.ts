import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as { end_time?: string; reason?: string }

    const existing = await prisma.downtime_logs.findUnique({ where: { id: Number(id) } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const endDate    = body.end_time ? new Date(body.end_time) : new Date()
    const startDate  = existing.start_time ?? endDate
    const duration   = Math.round((endDate.getTime() - startDate.getTime()) / 60000)

    const updated = await prisma.downtime_logs.update({
      where: { id: Number(id) },
      data: {
        ...(body.end_time !== undefined && { end_time:     endDate }),
        ...(body.reason   !== undefined && { reason:       body.reason }),
        duration_min: duration >= 0 ? duration : null,
      },
    })

    console.log('[PATCH /api/downtime/' + id + '] closed ok')
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/downtime/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
