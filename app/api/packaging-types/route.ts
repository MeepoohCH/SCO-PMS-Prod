import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client' 
import type { PackagingCategory } from '@prisma/client'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const types = await prisma.packaging_types.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(types)
  } catch (err) {
    console.error('[GET /api/packaging-types]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      name:               string
      packaging_category: string
      standard_weight_kg: number
      drums_per_pallet:   number
    }

    const { name, packaging_category, standard_weight_kg, drums_per_pallet } = body

    if (!name || !packaging_category) {
      return NextResponse.json({ error: 'name and packaging_category are required' }, { status: 400 })
    }

    const record = await prisma.packaging_types.create({
      data: {
        name,
        packaging_category: packaging_category as PackagingCategory,
        standard_weight_kg: new Prisma.Decimal(parseFloat(String(standard_weight_kg)) || 0),
        drums_per_pallet:   parseInt(String(drums_per_pallet)) || 1,
        is_active:  true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    console.error('[POST /api/packaging-types]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
