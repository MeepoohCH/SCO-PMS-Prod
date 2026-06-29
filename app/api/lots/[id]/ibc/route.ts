import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    operator_name?:     string | null
    quality_status_lab?: string | null
    residue_kg?:        string | number | null
    empty_before_kg?:   string | number | null
    with_product_kg?:   string | number | null
    product_net_kg?:    string | number | null
  }
  console.log('[PATCH /api/lots/' + id + '/ibc] body:', JSON.stringify(body))

  try {
    const result = await prisma.production_detail_ibc.upsert({
      where:  { production_detail_id: Number(id) },
      update: {
        ...(body.operator_name      !== undefined && { operator_name:      body.operator_name }),
        ...(body.quality_status_lab !== undefined && { quality_status_lab: body.quality_status_lab }),
        ...(body.residue_kg         !== undefined && { residue_kg:         body.residue_kg        ? String(body.residue_kg)        : null }),
        ...(body.empty_before_kg    !== undefined && { empty_before_kg:    body.empty_before_kg   ? Number(body.empty_before_kg)   : null }),
        ...(body.with_product_kg    !== undefined && { with_product_kg:    body.with_product_kg   ? Number(body.with_product_kg)   : null }),
        ...(body.product_net_kg     !== undefined && { product_net_kg:     body.product_net_kg    ? Number(body.product_net_kg)    : null }),
        updated_at: new Date(),
      },
      create: {
        production_detail_id: Number(id),
        operator_name:        body.operator_name      ?? null,
        quality_status_lab:   body.quality_status_lab ?? null,
        residue_kg:           body.residue_kg         ? String(body.residue_kg)        : null,
        empty_before_kg:      body.empty_before_kg    ? Number(body.empty_before_kg)   : null,
        with_product_kg:      body.with_product_kg    ? Number(body.with_product_kg)   : null,
        product_net_kg:       body.product_net_kg     ? Number(body.product_net_kg)    : null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    console.log('[PATCH /api/lots/' + id + '/ibc] upserted ok')
    return NextResponse.json(result)
  } catch (err) {
    console.error('[PATCH /api/lots/' + id + '/ibc]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
