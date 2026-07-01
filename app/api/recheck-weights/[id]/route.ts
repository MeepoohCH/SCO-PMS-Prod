import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'packer', 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const logId = Number(id)
    if (!logId || isNaN(logId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    await prisma.recheck_weight_logs.delete({ where: { id: logId } })

    return NextResponse.json({ deleted: logId }, { status: 200 })
  } catch (err) {
    console.error('[DELETE /api/recheck-weights/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
