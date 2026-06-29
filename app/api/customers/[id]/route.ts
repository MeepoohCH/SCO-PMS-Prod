import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    console.log('[PATCH /api/customers/' + id + '] body:', JSON.stringify(body))

    const updated = await prisma.customers.update({
      where: { id: Number(id) },
      data: { ...body, updated_at: new Date() },
    })
    console.log('[PATCH /api/customers/' + id + '] updated ok')
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/customers/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    console.log('[DELETE /api/customers/' + id + '] deleting...')
    await prisma.customers.delete({ where: { id: Number(id) } })
    console.log('[DELETE /api/customers/' + id + '] done')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/customers/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
