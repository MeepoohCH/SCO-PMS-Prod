import { NextRequest, NextResponse } from 'next/server'
import { auth, hasRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

function mapLot<T extends Record<string, unknown>>(lot: T) {
  const ibc  = lot.production_detail_ibc as Record<string, unknown> | null | undefined
  const plan = (lot as any).plan as Record<string, unknown> | null | undefined
  return {
    ...lot,
    status:              lot.detail_status,
    target_mt:           lot.target_amount_mt,
    done_pallets:        lot.actual_pallet_count,
    packing_date:        lot.operation_date,
    drumming_start:      lot.lot_drumming_start,
    drumming_end:        lot.lot_drumming_end,
    ibc_operator_name:   ibc?.operator_name    ?? null,
    ibc_quality_status:  ibc?.quality_status_lab ?? null,
    ibc_residue_kg:      ibc?.residue_kg        ?? null,
    ibc_empty_before_kg: ibc?.empty_before_kg   ?? null,
    ibc_with_product_kg: ibc?.with_product_kg   ?? null,
    ibc_product_net_kg:  ibc?.product_net_kg    ?? null,
    plan_id:             (plan as any)?.id                    ?? null,
    plan_created_by:     (plan as any)?.creator?.full_name    ?? null,
    plan_updated_by:     (plan as any)?.updater?.full_name    ?? null,
    plan_created_by_id:  (plan as any)?.creator?.id           ?? null,
    plan_updated_by_id:  (plan as any)?.updater?.id           ?? null,
    plan_special_comm:   null,
    special_comm:        lot.special_comm                     ?? null,
  }
}

async function validFk(
  table: 'customers' | 'packaging_types' | 'products',
  val: unknown,
): Promise<number | null> {
  if (val == null) return null
  const n = Number(val)
  if (!Number.isFinite(n)) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exists = await (prisma[table] as any).findUnique({ where: { id: n }, select: { id: true } })
  return exists ? n : null
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const status  = searchParams.get('status')
    const dept    = searchParams.get('dept')
    const plan_id = searchParams.get('plan_id')

    const currentUser = await prisma.users.findUnique({
      where:  { id: Number(session.user.id) },
      select: { allowed_depts: true },
    })
    const allowedDepts = String(currentUser?.allowed_depts || 'all')
      .split(',').map(d => d.trim()).filter(Boolean)

    console.log('[GET /api/lots] session user id:', session.user.id, 'role:', session.user.role)
    console.log('[GET /api/lots] allowedDepts:', allowedDepts)

    const where: Prisma.production_detailsWhereInput = {}
    if (status)  where.detail_status = status as never
    if (plan_id) where.plan_id = Number(plan_id)
    if (!allowedDepts.includes('all')) {
      where.product = { dept: { in: allowedDepts } as never }
    } else if (dept) {
      where.product = { dept: dept as never }
    }

    console.log('[GET /api/lots] where clause:', JSON.stringify(where))

    const lots = await prisma.production_details.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        product:               true,
        customer:              true,
        packaging_type:        true,
        plan:                  { include: { blender: true, creator: { select: { id: true, full_name: true } }, updater: { select: { id: true, full_name: true } } } },
        production_detail_ibc: true,
        scale_verifications:   { select: { id: true, pl_approved_at: true } },
      },
    })

    const allLotsForRanking = await prisma.production_details.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    const rankMap = new Map<number, number>()
    allLotsForRanking.forEach((l, i) => rankMap.set(l.id, i + 1))

    return NextResponse.json(lots.map(l => ({
      ...mapLot(l),
      display_no: rankMap.get(l.id) ?? null,
    })))
  } catch (err) {
    console.error('[GET /api/lots]', err)
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
      plan_id:            number
      dept?:              string
      lot_no:             string
      product_id?:        number
      product_name?:      string   // free-text fallback เมื่อไม่มี product_id
      customer_id?:       number
      packaging_type_id?: number
      target_amount_mt?:  number
      planned_pallets?:   number
      country_label?:     string
      draft_note?:        string
      special_comm?:      string
      cut_off_date?:      string
      operation_date?:    string
      packing_date?:      string
      label_no_start?:    string
      label_no_end?:      string
      label_count?:       number
      label_pkg_type?:    string
      flush_blender?:     string
      export_on_pallet?:  boolean
      empty_tank?:        boolean
      ibc_data?: {
        operator_name?:       string
        quality_status?:      string
        ibc_residue_kg?:      string
        ibc_empty_before_kg?: string
        ibc_with_product_kg?: string
        ibc_product_net_kg?:  string
      }
    }

    const {
      plan_id, dept, lot_no, product_id, product_name, customer_id, packaging_type_id,
      target_amount_mt, planned_pallets,
      country_label, draft_note, special_comm, cut_off_date,
      operation_date, packing_date,
      label_no_start, label_no_end, label_count, label_pkg_type, flush_blender,
      export_on_pallet, empty_tank,
    } = body

    console.log('[POST /api/lots] user id:', session.user.id)

    if (!plan_id) {
      return NextResponse.json({ error: 'Missing plan_id' }, { status: 400 })
    }

    const resolvedLotNo = lot_no?.trim() ? lot_no : `DRAFT-${Date.now()}`
    const resolvedOperationDate = operation_date ?? packing_date

    // ── Auto-find or create product from product_name (free text) ──────────
    let resolvedProductId: number | null = product_id ?? null
    if (!resolvedProductId && product_name?.trim()) {
      const existingProduct = await prisma.products.findFirst({
        where: { product_name: product_name.trim(), ...(dept && { dept: dept as any }) },
      })
      if (existingProduct) {
        resolvedProductId = existingProduct.id
      } else {
        const newProduct = await prisma.products.create({
          data: {
            product_name: product_name.trim(),
            dept: dept as any,
            is_active: true,
          },
        })
        resolvedProductId = newProduct.id
      }
    }

    // Validate FK references — a stale id here would fail the entire create() call atomically
    const safeProductId       = resolvedProductId ? await validFk('products', resolvedProductId) : null
    const safeCustomerId      = customer_id      ? await validFk('customers',       customer_id)      : null
    const safePackagingTypeId = packaging_type_id ? await validFk('packaging_types', packaging_type_id) : null

    let lot: Awaited<ReturnType<typeof prisma.production_details.create>>
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lot = await prisma.production_details.create({
        data: {
          plan:           { connect: { id: Number(plan_id) } },
          ...(dept                           && { dept }),
          lot_no:         resolvedLotNo,
          ...(safeProductId        && { product:        { connect: { id: safeProductId } } }),
          ...(safeCustomerId       && { customer:       { connect: { id: safeCustomerId } } }),
          ...(safePackagingTypeId  && { packaging_type: { connect: { id: safePackagingTypeId } } }),
          ...(target_amount_mt != null && { target_amount_mt }),
          ...(planned_pallets  != null && { planned_pallets: Number(planned_pallets) }),
          ...(country_label             && { country_label }),
          ...(draft_note                && { draft_note }),
          ...(special_comm != null      && { special_comm }),
          ...(cut_off_date              && { cut_off_date:    new Date(cut_off_date) }),
          ...(resolvedOperationDate     && { operation_date:  new Date(resolvedOperationDate) }),
          ...(label_no_start            && { label_no_start }),
          ...(label_no_end              && { label_no_end }),
          ...(label_count    != null    && { label_count: Number(label_count) }),
          ...(label_pkg_type            && { label_pkg_type }),
          ...(flush_blender             && { flush_blender }),
          ...(export_on_pallet != null  && { export_on_pallet: Boolean(export_on_pallet) }),
          ...(empty_tank       != null  && { empty_tank:        Boolean(empty_tank) }),
          detail_status: 'draft',
          ...(session.user.id && { recorder: { connect: { id: Number(session.user.id) } } }),
          created_at:    new Date(),
          updated_at:    new Date(),
        } as any,
      })
    } catch (createErr: any) {
      if (createErr.code === 'P2003') {
        return NextResponse.json(
          { error: 'Invalid plan_id — plan not found' },
          { status: 400 }
        )
      }
      throw createErr
    }

    if (body.ibc_data) {
      const d = body.ibc_data
      const ibcPayload = {
        operator_name:      d.operator_name      ?? null,
        quality_status_lab: d.quality_status     ?? null,
        residue_kg:         d.ibc_residue_kg      ? String(d.ibc_residue_kg)      : null,
        empty_before_kg:    d.ibc_empty_before_kg ? Number(d.ibc_empty_before_kg) : null,
        with_product_kg:    d.ibc_with_product_kg ? Number(d.ibc_with_product_kg) : null,
        product_net_kg:     d.ibc_product_net_kg  ? Number(d.ibc_product_net_kg)  : null,
        updated_at:         new Date(),
      }
      await prisma.production_detail_ibc.upsert({
        where:  { production_detail_id: lot.id },
        create: { production_detail_id: lot.id, created_at: new Date(), ...ibcPayload },
        update: ibcPayload,
      })
    }

    console.log('[POST /api/lots] created lot id:', lot.id)
    return NextResponse.json(mapLot(lot as unknown as Record<string, unknown>), { status: 201 })
  } catch (err) {
    console.error('[POST /api/lots] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}