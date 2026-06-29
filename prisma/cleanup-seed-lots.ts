/**
 * prisma/cleanup-seed-lots.ts
 *
 * One-time script: removes all SEED-* and TEST* lots from the DB,
 * plus their dependent child records and any orphaned production_plans.
 *
 * Run: npx tsx prisma/cleanup-seed-lots.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['error'] })

async function main() {
  console.log('🧹 Scanning for SEED-* and TEST* lots...\n')

  const testLots = await prisma.production_details.findMany({
    where: {
      OR: [
        { lot_no: { startsWith: 'SEED-' } },
        { lot_no: { startsWith: 'TEST'  } },
      ],
    },
    select: { id: true, lot_no: true, plan_id: true },
  })

  if (testLots.length === 0) {
    console.log('✅ No SEED-* / TEST* lots found — database is already clean.')
    return
  }

  console.log(`Found ${testLots.length} lot(s) to remove:`)
  testLots.forEach(l => console.log(`  • ${l.lot_no}  (id=${l.id}, plan_id=${l.plan_id})`))
  console.log()

  const lotIds  = testLots.map(l => l.id)
  const planIds = [...new Set(testLots.map(l => l.plan_id))]

  const counts = {
    checklist_responses:   0,
    downtime_logs:         0,
    approval_logs:         0,
    scale_verifications:   0,
    latex_drumming_data:   0,
    production_detail_ibc: 0,
    recheck_weight_logs:   0,
    drumming_sessions:     0,
    production_details:    0,
    production_plans:      0,
  }

  // 1. checklist_responses
  counts.checklist_responses = (await prisma.checklist_responses.deleteMany({
    where: { production_detail_id: { in: lotIds } },
  })).count

  // 2. downtime_logs
  counts.downtime_logs = (await prisma.downtime_logs.deleteMany({
    where: { production_detail_id: { in: lotIds } },
  })).count

  // 3. approval_logs
  counts.approval_logs = (await prisma.approval_logs.deleteMany({
    where: { production_detail_id: { in: lotIds } },
  })).count

  // 4. scale_verifications
  counts.scale_verifications = (await prisma.scale_verifications.deleteMany({
    where: { production_detail_id: { in: lotIds } },
  })).count

  // 5. latex_drumming_data
  counts.latex_drumming_data = (await prisma.latex_drumming_data.deleteMany({
    where: { production_detail_id: { in: lotIds } },
  })).count

  // 6. production_detail_ibc
  counts.production_detail_ibc = (await prisma.production_detail_ibc.deleteMany({
    where: { production_detail_id: { in: lotIds } },
  })).count

  // 7. recheck_weight_logs → drumming_sessions (children first)
  const sessions = await prisma.drumming_sessions.findMany({
    where:  { production_detail_id: { in: lotIds } },
    select: { id: true },
  })
  const sessionIds = sessions.map(s => s.id)

  if (sessionIds.length > 0) {
    counts.recheck_weight_logs = (await prisma.recheck_weight_logs.deleteMany({
      where: { drumming_session_id: { in: sessionIds } },
    })).count

    counts.drumming_sessions = (await prisma.drumming_sessions.deleteMany({
      where: { id: { in: sessionIds } },
    })).count
  }

  // 8. production_details
  counts.production_details = (await prisma.production_details.deleteMany({
    where: { id: { in: lotIds } },
  })).count

  // 9. orphaned production_plans (only those with no remaining production_details)
  for (const planId of planIds) {
    const remaining = await prisma.production_details.count({ where: { plan_id: planId } })
    if (remaining === 0) {
      await prisma.production_plans.delete({ where: { id: planId } })
      counts.production_plans++
    }
  }

  console.log('✅ Cleanup complete!\n')
  console.log('Deleted:')
  console.log(`  production_details:     ${counts.production_details}`)
  console.log(`  checklist_responses:    ${counts.checklist_responses}`)
  console.log(`  downtime_logs:          ${counts.downtime_logs}`)
  console.log(`  approval_logs:          ${counts.approval_logs}`)
  console.log(`  scale_verifications:    ${counts.scale_verifications}`)
  console.log(`  latex_drumming_data:    ${counts.latex_drumming_data}`)
  console.log(`  production_detail_ibc:  ${counts.production_detail_ibc}`)
  console.log(`  recheck_weight_logs:    ${counts.recheck_weight_logs}`)
  console.log(`  drumming_sessions:      ${counts.drumming_sessions}`)
  console.log(`  production_plans:       ${counts.production_plans}`)
}

main()
  .catch(e => { console.error('❌ Cleanup failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
