import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json() as Record<string, unknown>
    console.log('[PATCH /api/blenders/' + id + '] body:', JSON.stringify(body))

    const data: Record<string, unknown> = { updated_at: new Date() }
    if (body.code        != null) data.code        = body.code
    if (body.capacity_mt != null) data.capacity_mt = Number(body.capacity_mt)
    if (body.dept        != null) data.dept        = body.dept
    if (body.status      != null) data.status      = body.status

    const updated = await p.blenders.update({ where: { id: Number(id) }, data })
    console.log('[PATCH /api/blenders/' + id + '] updated ok')
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/blenders/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    console.log('[DELETE /api/blenders/' + id + '] deleting...')
    await prisma.blenders.delete({ where: { id: Number(id) } })
    console.log('[DELETE /api/blenders/' + id + '] done')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/blenders/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
