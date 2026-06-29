import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

// UI stores 'ใช่'/'ไม่ใช่'; DB stores Boolean
function toBool(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null
  if (v === true  || v === 'ใช่')   return true
  if (v === false || v === 'ไม่ใช่') return false
  return null
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  console.log('[PATCH /api/lots/' + id + '/latex] body:', JSON.stringify(body))

  // Field mapping: body key → DB column name
  // no_bacteria      → no_bacteria        (Boolean)
  // no_bacteria_by   → no_bacteria_by
  // temperature_ok   → temp_below_40c     (Boolean)
  // temperature_by   → temp_by
  // prev_product     → prev_product_loaded
  // weight_set_by    → weight_set_by
  // drummer_name     → drummer_name
  // flush_kg         → flush_before_drumming_kg
  // product_purge_kg → product_purge_kg
  // drain_kg         → drain_kg
  // total_kg         → total_kg
  // sample_collected → lab_sample_detail
  // storage_area     → storage_area_by
  // tag_status       → tag_status
  // tag_checked_by   → tag_checked_by
  // lot1_qty         → lot1_qty
  // lot2_qty         → lot2_qty

  try {
    const result = await prisma.latex_drumming_data.upsert({
      where:  { production_detail_id: Number(id) },
      update: {
        ...(body.no_bacteria        !== undefined && { no_bacteria:              toBool(body.no_bacteria) }),
        ...(body.no_bacteria_by     !== undefined && { no_bacteria_by:           body.no_bacteria_by     as string | null }),
        ...(body.temperature_ok     !== undefined && { temp_below_40c:           toBool(body.temperature_ok) }),
        ...(body.temperature_by     !== undefined && { temp_by:                  body.temperature_by     as string | null }),
        ...(body.prev_product       !== undefined && { prev_product_loaded:      body.prev_product       as string | null }),
        ...(body.weight_set_by      !== undefined && { weight_set_by:            body.weight_set_by      as string | null }),
        ...(body.drummer_name       !== undefined && { drummer_name:             body.drummer_name       as string | null }),
        ...(body.flush_kg           !== undefined && { flush_before_drumming_kg: body.flush_kg           ? Number(body.flush_kg) : null }),
        ...(body.product_purge_kg   !== undefined && { product_purge_kg:         body.product_purge_kg   ? Number(body.product_purge_kg) : null }),
        ...(body.drain_kg           !== undefined && { drain_kg:                 body.drain_kg           ? Number(body.drain_kg) : null }),
        ...(body.total_kg           !== undefined && { total_kg:                 body.total_kg           ? Number(body.total_kg) : null }),
        ...(body.sample_collected   !== undefined && { lab_sample_detail:        body.sample_collected   as string | null }),
        ...(body.storage_area       !== undefined && { storage_area_by:          body.storage_area       as string | null }),
        ...(body.tag_status         !== undefined && { tag_status:               body.tag_status         as string | null }),
        ...(body.tag_checked_by     !== undefined && { tag_checked_by:           body.tag_checked_by     as string | null }),
        ...(body.lot1_qty           !== undefined && { lot1_qty:                 body.lot1_qty           ? Number(body.lot1_qty) : null }),
        ...(body.lot2_qty           !== undefined && { lot2_qty:                 body.lot2_qty           ? Number(body.lot2_qty) : null }),
        updated_at: new Date(),
      },
      create: {
        production_detail_id:     Number(id),
        no_bacteria:              toBool(body.no_bacteria),
        no_bacteria_by:           (body.no_bacteria_by     as string | null) ?? null,
        temp_below_40c:           toBool(body.temperature_ok),
        temp_by:                  (body.temperature_by     as string | null) ?? null,
        prev_product_loaded:      (body.prev_product       as string | null) ?? null,
        weight_set_by:            (body.weight_set_by      as string | null) ?? null,
        drummer_name:             (body.drummer_name       as string | null) ?? null,
        flush_before_drumming_kg: body.flush_kg            ? Number(body.flush_kg)           : null,
        product_purge_kg:         body.product_purge_kg    ? Number(body.product_purge_kg)   : null,
        drain_kg:                 body.drain_kg            ? Number(body.drain_kg)            : null,
        total_kg:                 body.total_kg            ? Number(body.total_kg)            : null,
        lab_sample_detail:        (body.sample_collected   as string | null) ?? null,
        storage_area_by:          (body.storage_area       as string | null) ?? null,
        tag_status:               (body.tag_status         as string | null) ?? null,
        tag_checked_by:           (body.tag_checked_by     as string | null) ?? null,
        lot1_qty:                 body.lot1_qty             ? Number(body.lot1_qty)  : null,
        lot2_qty:                 body.lot2_qty             ? Number(body.lot2_qty)  : null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })

    console.log('[PATCH /api/lots/' + id + '/latex] upserted ok')
    return NextResponse.json(result)
  } catch (err) {
    console.error('[PATCH /api/lots/' + id + '/latex]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
