import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasRole(session.user.roles, 'pl')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.scale_verifications.findUnique({ where: { id: Number(id) } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.scale_verifications.update({
      where: { id: Number(id) },
      data: {
        pl_approved_by: Number(session.user.id),
        pl_approved_at: new Date(),
        is_locked:      true,
        locked_at:      new Date(),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[POST /api/scale-verifications/[id]/approve]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
