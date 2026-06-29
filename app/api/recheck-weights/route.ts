import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { FailReason } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const drumming_session_id = searchParams.get('drumming_session_id')

    const weights = await prisma.recheck_weight_logs.findMany({
      where: {
        ...(drumming_session_id && { drumming_session_id: Number(drumming_session_id) }),
      },
      orderBy: [
        { pallet_no:  'asc' },
        { attempt_no: 'asc' },
      ],
    })

    return NextResponse.json(weights)
  } catch (err) {
    console.error('[GET /api/recheck-weights]', err)
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
      drumming_session_id: number
      pallet_no:           number
      attempt_no:          number
      weight_kg:           number
      fail_reason?:        string
      action_taken?:       string
    }

    const { drumming_session_id, pallet_no, attempt_no, weight_kg, fail_reason, action_taken } = body

    if (!drumming_session_id) {
      return NextResponse.json({ error: 'drumming_session_id is required' }, { status: 400 })
    }

    const record = await prisma.recheck_weight_logs.create({
      data: {
        drumming_session_id: Number(drumming_session_id),
        pallet_no:           pallet_no   ?? null,
        attempt_no:          attempt_no  ?? null,
        weight_kg:           weight_kg   ?? null,
        fail_reason:         (fail_reason as FailReason) ?? null,
        action_taken:        action_taken ?? null,
        logged_by:           Number(session.user.id),
        logged_at:           new Date(),
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    console.error('[POST /api/recheck-weights]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'packer', 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const production_detail_id = searchParams.get('production_detail_id')
    if (!production_detail_id) {
      return NextResponse.json({ error: 'production_detail_id is required' }, { status: 400 })
    }

    const sessions = await prisma.drumming_sessions.findMany({
      where: { production_detail_id: Number(production_detail_id) },
      select: { id: true },
    })
    const sessionIds = sessions.map(s => s.id)
    if (sessionIds.length > 0) {
      await prisma.recheck_weight_logs.deleteMany({
        where: { drumming_session_id: { in: sessionIds } },
      })
      await prisma.drumming_sessions.deleteMany({
        where: { id: { in: sessionIds } },
      })
    }

    return NextResponse.json({ cleared: sessionIds.length }, { status: 200 })
  } catch (err) {
    console.error('[DELETE /api/recheck-weights]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
