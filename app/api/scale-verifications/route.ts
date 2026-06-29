import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const production_detail_id = searchParams.get('production_detail_id')

    console.log('[GET /api/scale-verifications] production_detail_id:', production_detail_id)

    const records = await prisma.scale_verifications.findMany({
      where: {
        ...(production_detail_id && { production_detail_id: Number(production_detail_id) }),
      },
      include: {
        checker:     { select: { id: true, full_name: true } },
        pl_approver: { select: { id: true, full_name: true } },
      },
      orderBy: { checked_at: 'desc' },
    })

    console.log('[GET /api/scale-verifications] found:', records.length)
    return NextResponse.json(records)
  } catch (err) {
    console.error('[GET /api/scale-verifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      production_detail_id: number
      machine_code: string
      standard_weight_kg: number
      measured_weight_kg: number
      recalibration_required: boolean
      round_no?: number
    }

    const { production_detail_id, machine_code, standard_weight_kg, measured_weight_kg, recalibration_required, round_no } = body

    if (!production_detail_id) {
      return NextResponse.json({ error: 'production_detail_id is required' }, { status: 400 })
    }

    const existing = await prisma.scale_verifications.findFirst({
      where: {
        production_detail_id: Number(production_detail_id),
        round_no:             round_no ?? 1,
        pl_approved_at:       null,
      },
      orderBy: { checked_at: 'desc' },
    })
    if (existing) {
      console.log('[POST scale-verifications] returning existing:', existing.id)
      return NextResponse.json(existing, { status: 200 })
    }

    const record = await prisma.scale_verifications.create({
      data: {
        production_detail_id: Number(production_detail_id),
        machine_code:           machine_code ?? null,
        standard_weight_kg:     standard_weight_kg ?? null,
        measured_weight_kg:     measured_weight_kg ?? null,
        recalibration_required: recalibration_required ?? null,
        round_no:               round_no ?? null,
        checked_by:             Number(session.user.id),
        checked_at:             new Date(),
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    console.error('[POST /api/scale-verifications]', err)
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

    const lot = await prisma.production_details.findUnique({
      where: { id: Number(production_detail_id) },
      select: { detail_status: true },
    })
    const blockedStatuses = ['submitted', 'head_approved', 'sl_rejected', 'completed']
    if (lot && blockedStatuses.includes(lot.detail_status)) {
      return NextResponse.json(
        { error: `Cannot clear scale data — lot status is ${lot.detail_status}` },
        { status: 400 }
      )
    }

    // Clear pallet weight checks first — they are invalid once the scale standard changes.
    const sessions = await prisma.drumming_sessions.findMany({
      where: { production_detail_id: Number(production_detail_id) },
      select: { id: true },
    })
    const sessionIds = sessions.map(s => s.id)
    if (sessionIds.length > 0) {
      await prisma.recheck_weight_logs.deleteMany({
        where: { drumming_session_id: { in: sessionIds } },
      })
    }

    const result = await prisma.scale_verifications.deleteMany({
      where: { production_detail_id: Number(production_detail_id) },
    })

    return NextResponse.json({ deleted: result.count, recheck_weights_cleared: sessionIds.length > 0 }, { status: 200 })
  } catch (err) {
    console.error('[DELETE /api/scale-verifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
