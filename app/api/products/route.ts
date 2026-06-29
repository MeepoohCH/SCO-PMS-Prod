import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { DeptEnum } from '@prisma/client'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const isActiveParam = searchParams.get('is_active')

    const products = await prisma.products.findMany({
      where: isActiveParam !== null ? { is_active: isActiveParam === 'true' } : undefined,
      orderBy: { product_name: 'asc' },
    })
    return NextResponse.json(products)
  } catch (err) {
    console.error('[GET /api/products]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      product_name: string
      gmid:         string
      dept:         string
    }

    const { product_name, gmid, dept } = body

    if (!product_name || !gmid || !dept) {
      return NextResponse.json({ error: 'product_name, gmid, and dept are required' }, { status: 400 })
    }

    const product = await prisma.products.create({
      data: {
        product_name,
        gmid,
        dept:      dept as DeptEnum,
        is_active: true,
        created_at:         new Date(),
        updated_at:         new Date(),
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    console.error('[POST /api/products]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
