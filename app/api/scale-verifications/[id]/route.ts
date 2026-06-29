import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const record = await prisma.scale_verifications.findUnique({ where: { id: Number(id) } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(record)
  } catch (err) {
    console.error('[GET /api/scale-verifications/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json() as {
      pl_approved_by?: number | string
      pl_approved_at?: string
      is_locked?: boolean
    }
    const { pl_approved_by, pl_approved_at, is_locked } = body

    const record = await prisma.scale_verifications.findUnique({ where: { id: Number(id) } })
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.scale_verifications.update({
      where: { id: Number(id) },
      data: {
        ...(pl_approved_by !== undefined && { pl_approved_by: Number(pl_approved_by) }),
        ...(pl_approved_at !== undefined && { pl_approved_at: new Date(pl_approved_at) }),
        ...(is_locked !== undefined && { is_locked, locked_at: new Date() }),
      },
    })

    console.log('[PATCH /api/scale-verifications/' + id + '] approved by user:', pl_approved_by)
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/scale-verifications/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
