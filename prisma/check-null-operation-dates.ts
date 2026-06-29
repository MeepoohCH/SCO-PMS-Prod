import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const affected = await prisma.production_details.findMany({
    where: { operation_date: null },
    select: { id: true, lot_no: true, detail_status: true, created_at: true },
    orderBy: { id: 'asc' },
  })
  console.log(`\nFound ${affected.length} lot(s) with NULL operation_date:`)
  if (affected.length === 0) {
    console.log('  (none — all lots have a Plan date)')
  } else {
    affected.forEach(l =>
      console.log(`  id=${l.id}  lot_no=${l.lot_no}  status=${l.detail_status}  created_at=${l.created_at?.toISOString() ?? 'null'}`)
    )
    console.log('\nThese lots need their Plan date manually re-entered via Edit in the SL screen.')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
