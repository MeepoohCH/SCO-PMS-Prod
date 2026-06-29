/**
 * fix-merged-plans.ts
 *
 * One-time migration: splits production_plans rows that were wrongly shared
 * across multiple depts due to the missing form_type filter in the original
 * existing-plan lookup (blender_id + plan_date only, not + form_type).
 *
 * Usage:
 *   npx tsx prisma/fix-merged-plans.ts           ← dry-run (default, no writes)
 *   npx tsx prisma/fix-merged-plans.ts --apply   ← actually perform the writes
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = !process.argv.includes('--apply')

async function main() {
  if (DRY_RUN) {
    console.log('=== DRY-RUN mode (no writes). Pass --apply to commit changes. ===\n')
  } else {
    console.log('=== APPLY mode — writes will be committed. ===\n')
  }

  const plans = await prisma.production_plans.findMany({
    include: {
      production_details: {
        include: { product: true },
      },
    },
  })

  let plansCreated = 0
  let lotsRepointed = 0

  for (const plan of plans) {
    const mismatched = plan.production_details.filter(
      d => d.product?.dept && d.product.dept !== plan.form_type,
    )
    if (mismatched.length === 0) continue

    console.log(
      `Plan ${plan.id} (form_type=${plan.form_type}) has ${mismatched.length} mismatched lot(s):`,
      mismatched.map(d => `lot ${d.id} (lot_no=${d.lot_no}, product dept=${d.product?.dept})`),
    )

    for (const detail of mismatched) {
      const correctDept = detail.product?.dept
      if (!correctDept) {
        console.warn(
          `  ⚠ lot ${detail.id} has no product/dept — skipping (manual review needed)`,
        )
        continue
      }

      // Find an existing correct plan for this dept + blender + date
      const existingCorrect = await prisma.production_plans.findFirst({
        where: {
          blender_id: plan.blender_id,
          plan_date:  plan.plan_date,
          form_type:  correctDept as never,
        },
      })

      if (existingCorrect) {
        console.log(
          `  → lot ${detail.id}: target plan ${existingCorrect.id} already exists (dept=${correctDept})`,
        )
        if (!DRY_RUN) {
          await prisma.production_details.update({
            where: { id: detail.id },
            data:  { plan_id: existingCorrect.id },
          })
          console.log(
            `    ✓ Re-pointed lot ${detail.id} (${detail.lot_no}) from plan ${plan.id} → plan ${existingCorrect.id}`,
          )
        } else {
          console.log(
            `    [DRY-RUN] Would re-point lot ${detail.id} (${detail.lot_no}) from plan ${plan.id} → plan ${existingCorrect.id}`,
          )
        }
        lotsRepointed++
      } else {
        console.log(
          `  → lot ${detail.id}: no existing plan for dept=${correctDept} — will create one`,
        )
        let newPlanId: number
        if (!DRY_RUN) {
          const newPlan = await prisma.production_plans.create({
            data: {
              plan_date:    plan.plan_date,
              blender_id:   plan.blender_id,
              form_type:    correctDept as never,
              plan_status:  plan.plan_status,
              created_by:   plan.created_by,
              updated_by:   plan.updated_by ?? undefined,
              created_at:   new Date(),
              updated_at:   new Date(),
            },
          })
          newPlanId = newPlan.id
          console.log(`    ✓ Created new plan ${newPlanId} for dept=${correctDept}`)
          await prisma.production_details.update({
            where: { id: detail.id },
            data:  { plan_id: newPlanId },
          })
          console.log(
            `    ✓ Re-pointed lot ${detail.id} (${detail.lot_no}) from plan ${plan.id} → plan ${newPlanId}`,
          )
        } else {
          console.log(
            `    [DRY-RUN] Would create new plan (dept=${correctDept}, blender_id=${plan.blender_id}, plan_date=${plan.plan_date.toISOString().slice(0, 10)})`,
          )
          console.log(
            `    [DRY-RUN] Would re-point lot ${detail.id} (${detail.lot_no}) from plan ${plan.id} → new plan`,
          )
        }
        plansCreated++
        lotsRepointed++
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Plans created:   ${plansCreated}${DRY_RUN ? ' (dry-run, no actual writes)' : ''}`)
  console.log(`Lots re-pointed: ${lotsRepointed}${DRY_RUN ? ' (dry-run, no actual writes)' : ''}`)

  if (!DRY_RUN) {
    // Final verification: each production_plans row's form_type vs its detail depts
    console.log('\n=== Verification (post-migration) ===')
    const verification = await prisma.$queryRaw<
      { plan_id: number; form_type: string; detail_depts: string | null }[]
    >`
      SELECT pp.id AS plan_id, pp.form_type, GROUP_CONCAT(DISTINCT p.dept) AS detail_depts
      FROM production_plans pp
      LEFT JOIN production_details pd ON pd.plan_id = pp.id
      LEFT JOIN products p ON p.id = pd.product_id
      GROUP BY pp.id, pp.form_type
    `
    for (const row of verification) {
      const depts = row.detail_depts ?? '(no lots)'
      const ok = !row.detail_depts || row.detail_depts === row.form_type
      console.log(
        `  plan ${row.plan_id} form_type=${row.form_type} | detail depts=[${depts}] ${ok ? '✓' : '✗ MISMATCH'}`,
      )
    }
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
