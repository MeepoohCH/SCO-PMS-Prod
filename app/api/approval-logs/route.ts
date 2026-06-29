import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const production_detail_id = searchParams.get('production_detail_id')

  if (!production_detail_id)
    return NextResponse.json([])

  const logs = await prisma.approval_logs.findMany({
    where: { production_detail_id: Number(production_detail_id) },
    include: {
      actor: { select: { full_name: true, username: true } },
    },
    orderBy: { created_at: 'asc' },
  })

  return NextResponse.json(logs)
}
