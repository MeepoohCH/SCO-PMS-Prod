/**
 * prisma/test-seed.ts — Test lot data for all statuses & depts
 *
 * Run:  npx tsx prisma/test-seed.ts
 *
 * Notes:
 * - Requires seed.ts to have run first (users, blenders, products, customers, packaging_types)
 * - "paused_*" UI statuses live in drumming_sessions.action, not in detail_status
 *   Valid DetailStatus enum: draft | waiting | in_progress | pl_review |
 *                            submitted | head_approved | completed | rejected
 * - dept is derived from product.dept — not stored in production_details
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import type { DetailStatus } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to run — NODE_ENV=production. This script creates mock data and must not run in production.')
    process.exit(1)
  }

  console.log('🧪 Inserting test lots...\n')

  // ── Look up master-data IDs by name (safe after seed.ts) ──────────────

  const [bl_puf, bl_pu, bl_ibc] = await Promise.all([
    prisma.blenders.findFirst({ where: { code: 'V-2300'    } }),
    prisma.blenders.findFirst({ where: { code: 'V-2310'    } }),
    prisma.blenders.findFirst({ where: { code: 'IBC Mixer' } }),
  ])

  const [pr_puf, pr_pu, pr_ibc, pr_latex] = await Promise.all([
    prisma.products.findFirst({ where: { gmid: 'DSD542.01'    } }),
    prisma.products.findFirst({ where: { gmid: 'DSD757.01'    } }),
    prisma.products.findFirst({ where: { gmid: 'CN105'        } }),
    prisma.products.findFirst({ where: { gmid: 'XQ83286.01PA' } }),
  ])

  const [cu_sharp, cu_export, cu_vn, cu_th] = await Promise.all([
    prisma.customers.findFirst({ where: { country_label: 'Sharp Thailand'   } }),
    prisma.customers.findFirst({ where: { country_label: 'Export On Pallet' } }),
    prisma.customers.findFirst({ where: { country_label: 'Vietnam Label'    } }),
    prisma.customers.findFirst({ where: { country_label: 'Thailand Label'   } }),
  ])

  const [pkg_drum10, pkg_drum12, pkg_tote, pkg_ibc] = await Promise.all([
    prisma.packaging_types.findFirst({ where: { name: 'Drum 1.0mm'  } }),
    prisma.packaging_types.findFirst({ where: { name: 'Drum 1.2mm'  } }),
    prisma.packaging_types.findFirst({ where: { name: 'Tote 1000kg' } }),
    prisma.packaging_types.findFirst({ where: { name: 'IBC'         } }),
  ])

  const sl_user = await prisma.users.findFirst({ where: { username: 'sl_dow' } })

  if (!bl_puf || !bl_pu || !bl_ibc) throw new Error('Blenders not found — run seed.ts first')
  if (!pr_puf || !pr_pu || !pr_ibc || !pr_latex) throw new Error('Products not found — run seed.ts first')
  if (!cu_sharp || !cu_export || !cu_vn || !cu_th) throw new Error('Customers not found — run seed.ts first')
  if (!pkg_drum10 || !pkg_drum12 || !pkg_tote || !pkg_ibc) throw new Error('Packaging types not found — run seed.ts first')
  if (!sl_user) throw new Error('User sl_dow not found — run seed.ts first')

  console.log(`  IDs: blenders=[${bl_puf.id},${bl_pu.id},${bl_ibc.id}] products=[${pr_puf.id},${pr_pu.id},${pr_ibc.id},${pr_latex.id}]`)

  // ── Create one production_plan per dept ───────────────────────────────

  const now = new Date()
  const date0603 = new Date('2026-06-03')
  const date0604 = new Date('2026-06-04')

  const [plan_puf, plan_pu, plan_ibc, plan_latex] = await Promise.all([
    prisma.production_plans.create({ data: { plan_date: date0603, blender_id: bl_puf.id, form_type: 'PUF',   plan_status: 'active', created_by: sl_user.id, created_at: now, updated_at: now } }),
    prisma.production_plans.create({ data: { plan_date: date0603, blender_id: bl_pu.id,  form_type: 'PU',    plan_status: 'active', created_by: sl_user.id, created_at: now, updated_at: now } }),
    prisma.production_plans.create({ data: { plan_date: date0603, blender_id: bl_ibc.id, form_type: 'IBC',   plan_status: 'active', created_by: sl_user.id, created_at: now, updated_at: now } }),
    prisma.production_plans.create({ data: { plan_date: date0603, blender_id: bl_puf.id, form_type: 'Latex', plan_status: 'active', created_by: sl_user.id, created_at: now, updated_at: now } }),
  ])

  console.log(`  Plans: PUF=${plan_puf.id} PU=${plan_pu.id} IBC=${plan_ibc.id} Latex=${plan_latex.id}`)

  // ── Test lots — all 8 DetailStatus values + each dept ─────────────────
  //
  // paused_shift_end, paused_emergency, paused_issue are stored in detail_status.
  // Each paused lot also gets a drumming_session (session_status=paused), seeded below.

  const lots: {
    plan_id: number
    lot_no: string
    product_id: number
    customer_id: number
    packaging_type_id: number
    target_amount_mt: number
    operation_date: Date
    detail_status: DetailStatus
    planned_pallets: number
    draft_note?: string
    reject_remark?: string
  }[] = [
    // ── PUF lots ──────────────────────────────────────────────────────────
    { plan_id: plan_puf.id, lot_no: 'TEST-PUF-DRAFT',    product_id: pr_puf.id,   customer_id: cu_sharp.id,  packaging_type_id: pkg_drum10.id, target_amount_mt: 23.5, operation_date: date0603, detail_status: 'draft',        planned_pallets: 28, draft_note: 'Test draft — PUF' },
    { plan_id: plan_puf.id, lot_no: 'TEST-PUF-WAIT',     product_id: pr_puf.id,   customer_id: cu_sharp.id,  packaging_type_id: pkg_drum10.id, target_amount_mt: 23.5, operation_date: date0603, detail_status: 'waiting',      planned_pallets: 28 },
    { plan_id: plan_puf.id, lot_no: 'TEST-PUF-INPROG',   product_id: pr_puf.id,   customer_id: cu_export.id, packaging_type_id: pkg_drum10.id, target_amount_mt: 23.5, operation_date: date0604, detail_status: 'in_progress',  planned_pallets: 28 },
    { plan_id: plan_puf.id, lot_no: 'TEST-PUF-REJECT',   product_id: pr_puf.id,   customer_id: cu_th.id,     packaging_type_id: pkg_tote.id,   target_amount_mt: 10.0, operation_date: date0603, detail_status: 'rejected',     planned_pallets: 12, reject_remark: 'Label mismatch — test reject' },

    // ── PU lots ───────────────────────────────────────────────────────────
    { plan_id: plan_pu.id,  lot_no: 'TEST-PU-WAIT',      product_id: pr_pu.id,    customer_id: cu_export.id, packaging_type_id: pkg_drum12.id, target_amount_mt: 23.5, operation_date: date0603, detail_status: 'waiting',      planned_pallets: 28 },
    { plan_id: plan_pu.id,  lot_no: 'TEST-PU-INPROG',    product_id: pr_pu.id,    customer_id: cu_vn.id,     packaging_type_id: pkg_drum12.id, target_amount_mt: 20.0, operation_date: date0603, detail_status: 'in_progress',  planned_pallets: 24 },
    { plan_id: plan_pu.id,  lot_no: 'TEST-PU-PLREV',     product_id: pr_pu.id,    customer_id: cu_vn.id,     packaging_type_id: pkg_drum12.id, target_amount_mt: 20.0, operation_date: date0604, detail_status: 'pl_review',    planned_pallets: 24 },

    // ── IBC lots ──────────────────────────────────────────────────────────
    { plan_id: plan_ibc.id, lot_no: 'TEST-IBC-DRAFT',    product_id: pr_ibc.id,   customer_id: cu_vn.id,     packaging_type_id: pkg_ibc.id,    target_amount_mt: 15.0, operation_date: date0604, detail_status: 'draft',        planned_pallets: 18 },
    { plan_id: plan_ibc.id, lot_no: 'TEST-IBC-SUBMIT',   product_id: pr_ibc.id,   customer_id: cu_vn.id,     packaging_type_id: pkg_ibc.id,    target_amount_mt: 15.0, operation_date: date0603, detail_status: 'submitted',    planned_pallets: 18 },
    { plan_id: plan_ibc.id, lot_no: 'TEST-IBC-HEADAPPR', product_id: pr_ibc.id,   customer_id: cu_th.id,     packaging_type_id: pkg_ibc.id,    target_amount_mt: 15.0, operation_date: date0603, detail_status: 'head_approved',planned_pallets: 18 },

    // ── Latex lots ────────────────────────────────────────────────────────
    { plan_id: plan_latex.id, lot_no: 'TEST-LATEX-WAIT',     product_id: pr_latex.id, customer_id: cu_th.id,    packaging_type_id: pkg_tote.id, target_amount_mt: 10.0, operation_date: date0604, detail_status: 'waiting',  planned_pallets: 12 },
    { plan_id: plan_latex.id, lot_no: 'TEST-LATEX-COMPLETE', product_id: pr_latex.id, customer_id: cu_sharp.id, packaging_type_id: pkg_tote.id, target_amount_mt: 10.0, operation_date: date0603, detail_status: 'completed',planned_pallets: 12 },

    // ── Paused lots (PUF/PU/PUF) ──────────────────────────────────────────
    { plan_id: plan_puf.id, lot_no: 'TEST-PUF-PAUSE-SHIFT', product_id: pr_puf.id, customer_id: cu_th.id,     packaging_type_id: pkg_drum10.id, target_amount_mt: 18.5, operation_date: date0604, detail_status: 'paused_shift_end', planned_pallets: 22 },
    { plan_id: plan_pu.id,  lot_no: 'TEST-PU-PAUSE-EMERG',  product_id: pr_pu.id,  customer_id: cu_sharp.id,  packaging_type_id: pkg_drum12.id, target_amount_mt: 12.0, operation_date: date0604, detail_status: 'paused_emergency', planned_pallets: 15 },
    { plan_id: plan_puf.id, lot_no: 'TEST-PUF-PAUSE-ISSUE', product_id: pr_puf.id, customer_id: cu_vn.id,     packaging_type_id: pkg_drum10.id, target_amount_mt: 20.0, operation_date: date0604, detail_status: 'paused_issue',     planned_pallets: 24, draft_note: 'Drum weight out of tolerance' },
  ]

  let inserted = 0, skipped = 0
  for (const lot of lots) {
    try {
      await prisma.production_details.create({
        data: {
          ...lot,
          recorded_by: sl_user.id,
          created_at:  now,
          updated_at:  now,
        },
      })
      inserted++
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        console.log(`  ⚠  Skipped (duplicate lot_no): ${lot.lot_no}`)
        skipped++
      } else {
        throw e
      }
    }
  }

  console.log(`\n  ✓ Inserted ${inserted} test lots, skipped ${skipped} duplicates`)

  // ── Drumming sessions for paused lots ─────────────────────────────────

  const pausedLotDefs = [
    { lot_no: 'TEST-PUF-PAUSE-SHIFT', reason: 'Shift ended — resume next shift' },
    { lot_no: 'TEST-PU-PAUSE-EMERG',  reason: 'Chemical leak detected near V-2310' },
    { lot_no: 'TEST-PUF-PAUSE-ISSUE', reason: 'Drum weight out of tolerance — awaiting SL' },
  ]

  for (const def of pausedLotDefs) {
    const detail = await prisma.production_details.findUnique({ where: { lot_no: def.lot_no } })
    if (!detail) { console.log(`  ⚠  Skipped session for ${def.lot_no} (lot not found)`); continue }

    const existing = await prisma.drumming_sessions.findFirst({ where: { production_detail_id: detail.id } })
    if (existing) { console.log(`  ⚠  Skipped session for ${def.lot_no} (session already exists)`); continue }

    const session = await prisma.drumming_sessions.create({
      data: {
        production_detail_id: detail.id,
        session_no:           1,
        operator_id:          sl_user.id,
        started_at:           new Date(now.getTime() - 2 * 60 * 60 * 1000),
        session_status:       'paused',
        created_at:           now,
        updated_at:           now,
      },
    })

    console.log(`  ✓ Drumming session → ${def.lot_no}`)
  }

  // ── Verify ────────────────────────────────────────────────────────────

  const results = await prisma.production_details.findMany({
    where:   { lot_no: { startsWith: 'TEST-' } },
    include: { product: { select: { dept: true } }, plan: { select: { form_type: true } } },
    orderBy: { created_at: 'desc' },
  })

  console.log('\n  lot_no                  | status          | dept')
  console.log('  ' + '-'.repeat(60))
  for (const r of results) {
    const dept = r.product?.dept || r.plan?.form_type || '?'
    console.log(`  ${r.lot_no.padEnd(23)} | ${r.detail_status.padEnd(15)} | ${dept}`)
  }
  console.log()
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
