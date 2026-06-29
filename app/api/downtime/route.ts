import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { DowntimeType } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const production_detail_id = searchParams.get('production_detail_id')
    const open = searchParams.get('open') === 'true'

    // ?open=true → return single open log (no end_time) or null
    if (open) {
      const log = await prisma.downtime_logs.findFirst({
        where: {
          ...(production_detail_id && {
            production_detail_id: Number(production_detail_id),
          }),
          end_time: null,
        },
        orderBy: { start_time: 'desc' },
      })
      return NextResponse.json(log ?? null)
    }

    const logs = await prisma.downtime_logs.findMany({
      where: {
        ...(production_detail_id && {
          production_detail_id: Number(production_detail_id),
        }),
      },
      include: {
        logger: { select: { full_name: true } },
      },
      orderBy: { created_at: 'asc' },
    })

    return NextResponse.json(logs)
  } catch (err) {
    console.error('[GET /api/downtime]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasRole(session.user.roles, 'packer')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as {
      production_detail_id: number
      downtime_type:        'emergency' | 'issue'
      start_time:           string
      reason?:              string
    }

    const { production_detail_id, downtime_type, start_time, reason } = body

    if (!production_detail_id || !downtime_type || !start_time) {
      return NextResponse.json({ error: 'production_detail_id, downtime_type, and start_time are required' }, { status: 400 })
    }

    const record = await prisma.downtime_logs.create({
      data: {
        production_detail_id: Number(production_detail_id),
        downtime_type:        downtime_type as DowntimeType,
        start_time:           new Date(start_time),
        reason:               reason ?? null,
        logged_by:            Number(session.user.id),
        created_at:           new Date(),
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    console.error('[POST /api/downtime]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasRole(session.user.roles, 'packer')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as { id: number; end_time: string }
    const { id, end_time } = body

    if (!id || !end_time) {
      return NextResponse.json({ error: 'id and end_time are required' }, { status: 400 })
    }

    const existing = await prisma.downtime_logs.findUnique({ where: { id: Number(id) } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const endDate   = new Date(end_time)
    const startDate = existing.start_time ?? endDate
    const duration  = Math.round((endDate.getTime() - startDate.getTime()) / 60000)

    const updated = await prisma.downtime_logs.update({
      where: { id: Number(id) },
      data: {
        end_time:     endDate,
        duration_min: duration >= 0 ? duration : null,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/downtime]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
