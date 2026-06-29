import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { SessionStatus } from '@prisma/client'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const record = await prisma.drumming_sessions.findUnique({
      where:   { id: Number(id) },
      include: {
        recheck_weight_logs: true,
      },
    })

    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(record)
  } catch (err) {
    console.error('[GET /api/drumming-sessions/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasRole(session.user.roles, 'packer')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.drumming_sessions.findUnique({ where: { id: Number(id) } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json() as {
      session_status?: string
      finished_at?:    string
    }

    const isCompleting = body.session_status === 'completed'

    const updated = await prisma.drumming_sessions.update({
      where: { id: Number(id) },
      data: {
        ...(body.session_status && { session_status: body.session_status as SessionStatus }),
        ...(isCompleting        && { finished_at:    new Date() }),
        updated_at: new Date(),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/drumming-sessions/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
