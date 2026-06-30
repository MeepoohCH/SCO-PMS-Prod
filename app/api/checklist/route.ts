import { safeLog } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Phase } from '@prisma/client'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const production_detail_id = searchParams.get('production_detail_id')

  if (!production_detail_id)
    return NextResponse.json([], { status: 200 })

  const responses = await prisma.checklist_responses.findMany({
    where:   { production_detail_id: Number(production_detail_id) },
    include: { checklist_item: true },
    orderBy: { id: 'asc' },
  })

  return NextResponse.json(responses)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!hasRole(session.user.roles, 'packer')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as {
      production_detail_id: number
      checklist_item_id:    number
      phase:                string
      response_value:       string
      pallet_no?:           number | null
    }
    console.log("Received Checklist Payload:", safeLog(body))

    const { production_detail_id, checklist_item_id, phase, response_value, pallet_no } = body

    if (!production_detail_id || !checklist_item_id || !phase) {
      return NextResponse.json({ error: 'production_detail_id, checklist_item_id, and phase are required' }, { status: 400 })
    }

    const palletNoVal = pallet_no != null ? Number(pallet_no) : null

    const existing = await prisma.checklist_responses.findFirst({
      where: {
        production_detail_id: Number(production_detail_id),
        checklist_item_id:    Number(checklist_item_id),
        phase:                phase as Phase,
        pallet_no:            palletNoVal,
      },
    })

    let record
    if (existing) {
      record = await prisma.checklist_responses.update({
        where: { id: existing.id },
        data:  { response_value: response_value ?? null },
      })
    } else {
      record = await prisma.checklist_responses.create({
        data: {
          production_detail_id: Number(production_detail_id),
          checklist_item_id:    Number(checklist_item_id),
          phase:                phase as Phase,
          pallet_no:            palletNoVal,
          response_value:       response_value ?? null,
          responded_by:         Number(session.user.id),
          responded_at:         new Date(),
        },
      })
    }

    return NextResponse.json(record, { status: 201 })
  } catch (err) {
    console.error('[POST /api/checklist]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
