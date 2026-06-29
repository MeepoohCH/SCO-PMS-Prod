import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const production_detail_id = searchParams.get('production_detail_id')

    const sessions = await prisma.drumming_sessions.findMany({
      where: {
        ...(production_detail_id && { production_detail_id: Number(production_detail_id) }),
      },
      orderBy: { started_at: 'asc' },
    })

    return NextResponse.json(sessions)
  } catch (err) {
    console.error('[GET /api/drumming-sessions]', err)
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
      session_no: number
    }

    const { production_detail_id, session_no } = body

    if (!production_detail_id || !session_no) {
      return NextResponse.json({ error: 'production_detail_id and session_no are required' }, { status: 400 })
    }

    const record = await prisma.drumming_sessions.create({
      data: {
        production_detail_id: Number(production_detail_id),
        session_no:           Number(session_no),
        operator_id:          Number(session.user.id),
        started_at:           new Date(),
        session_status:       'in_progress',
        created_at:           new Date(),
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    console.error('[POST /api/drumming-sessions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
