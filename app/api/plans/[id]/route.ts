import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  try {
    const session = await auth()
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'sl', 'admin'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    console.log('[PATCH /api/plans/' + id + '] body:', JSON.stringify(body))

    const updated = await prisma.production_plans.update({
      where: { id: Number(id) },
      data: {
        ...(body.plan_date    && { plan_date:    new Date(body.plan_date) }),
        ...(body.form_type    && { form_type:    body.form_type }),
        ...(body.blender_id   && { blender_id:   Number(body.blender_id) }),
        ...(body.plan_status  && { plan_status:  body.plan_status }),
        updated_by: Number(session.user.id),
        updated_at: new Date(),
      },
    })

    console.log('[PATCH /api/plans/' + id + '] updated ok')
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/plans/' + id + '] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
