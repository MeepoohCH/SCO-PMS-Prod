import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const blender_id = searchParams.get('blender_id')
    const plan_date  = searchParams.get('plan_date')
    const form_type  = searchParams.get('form_type')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (blender_id) where.blender_id = Number(blender_id)
    if (plan_date)  where.plan_date  = new Date(plan_date)
    if (form_type)  where.form_type  = form_type

    const plans = await prisma.production_plans.findMany({
      where,
      orderBy: { plan_date: 'desc' },
      include: {
        blender: true,
        creator: { select: { id: true, full_name: true } },
        production_details: { select: { id: true } },
      },
    })
    return NextResponse.json(plans)
  } catch (err) {
    console.error('[GET /api/plans]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasRole(session.user.roles, 'sl', 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as {
      plan_date: string
      blender_id: number
      form_type: string
    }

    const { plan_date, blender_id, form_type } = body
    console.log('[POST /api/plans] user:', session.user.id)
    console.log('[POST /api/plans] body:', JSON.stringify(body))
    console.log('[POST /api/plans] required check:', { plan_date, blender_id, form_type })
    if (!plan_date || !blender_id || !form_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const plan = await prisma.production_plans.create({
      data: {
        plan_date:    new Date(plan_date),
        blender_id:   Number(blender_id),
        form_type:    form_type as never,
        plan_status:  'draft',
        created_by:   Number(session.user.id),
        updated_by:   Number(session.user.id),
        created_at:   new Date(),
        updated_at:   new Date(),
      },
    })

    console.log('[POST /api/plans] created plan id:', plan.id)
    return NextResponse.json(plan, { status: 201 })
  } catch (err) {
    console.error('[POST /api/plans] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
