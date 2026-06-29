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
    console.log('[PATCH /api/products/' + id + '] body:', JSON.stringify(body))

    const data: Record<string, unknown> = { updated_at: new Date() }
    const product_name = body.name ?? body.product_name
    if (product_name != null)            data.product_name       = product_name
    if (body.gmid != null)               data.gmid               = body.gmid
    if (body.dept != null)               data.dept               = body.dept
    if (body.is_active != null)          data.is_active          = body.is_active === 'true' || body.is_active === true

    const updated = await p.products.update({ where: { id: Number(id) }, data })
    console.log('[PATCH /api/products/' + id + '] updated ok')
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/products/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id } = await params
    console.log('[DELETE /api/products/' + id + '] deleting...')
    await prisma.products.delete({ where: { id: Number(id) } })
    console.log('[DELETE /api/products/' + id + '] done')
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/products/[id]] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
