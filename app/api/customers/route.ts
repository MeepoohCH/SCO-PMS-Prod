import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const customers = await prisma.customers.findMany({
      orderBy: { country_label: 'asc' },
    })
    return NextResponse.json(customers)
  } catch (err) {
    console.error('[GET /api/customers]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      country_label: string
      is_active?:    boolean
    }

    const { country_label, is_active } = body
    if (!country_label) {
      return NextResponse.json({ error: 'country_label is required' }, { status: 400 })
    }

    const customer = await prisma.customers.create({
      data: {
        country_label,
        is_active:  is_active ?? true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (err) {
    console.error('[POST /api/customers]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
