import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { DeptEnum } from '@prisma/client'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const blenders = await prisma.blenders.findMany({
      orderBy: { code: 'asc' },
    })
    return NextResponse.json(blenders)
  } catch (err) {
    console.error('[GET /api/blenders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasRole(session.user.roles, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json() as {
      code:        string
      dept:        string
      capacity_mt: number
    }

    const { code, dept, capacity_mt } = body

    if (!code || !dept) {
      return NextResponse.json({ error: 'code and dept are required' }, { status: 400 })
    }

    const blender = await prisma.blenders.create({
      data: {
        code,
        dept:        dept as DeptEnum,
        capacity_mt: capacity_mt ?? null,
        status:      'active',
        created_at:  new Date(),
        updated_at:  new Date(),
      },
    })

    return NextResponse.json(blender, { status: 201 })
  } catch (err) {
    console.error('[POST /api/blenders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
