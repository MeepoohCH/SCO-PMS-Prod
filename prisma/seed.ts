/**
 * prisma/seed.ts — PMS Dow Chemical (Thailand) Ltd.
 *
 * PURE MASTER DATA seed — safe to run in production.
 * Seeds: roles, blenders, products, customers,
 * packaging types, and checklist items.
 *
 * Does NOT create any user accounts or demo/test lots —
 * see prisma/production-users.ts for real user provisioning
 * and prisma/demo-seed.ts / prisma/test-seed.ts for
 * dev/staging mock data.
 *
 * Run:  npx prisma db seed
 * (or)  npx tsx prisma/seed.ts
 *
 * ⚠️  checklist_items are delete-and-recreated on every run.
 *     If checklist_responses rows already exist the step is
 *     skipped to avoid FK constraint errors.
 *
 * Provisioning order:
 *   1. npx prisma migrate deploy   (or db push)
 *   2. npx prisma db seed          ← this file (auto via migrate)
 *   3. npx tsx prisma/production-users.ts   (real users, once per env)
 *   4. npx tsx prisma/demo-seed.ts          (dev/staging demo lots only)
 *   5. npx tsx prisma/test-seed.ts          (dev/staging test lots only)
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error'],
})

// ── Checklist content  ────────────────────────────────────────────────────────
// Mirrors app/components/constants.ts  CHECKLISTS

const PRE_BASE = [
  {
    order: 1,
    label: 'ตรวจสอบภาชนะบรรจุก่อน Drumming ว่าถูกชนิดตามใบงานหรือไม่ รวมถึงความสะอาด ไม่มีรอยรั่ว',
    opts:  ['Yes', 'No'],
  },
  {
    order: 2,
    label: 'ตรวจสอบลาเบลก่อน Drumming ว่าถูกต้องตามใบงานหรือไม่ (Grade/Lot/Weight/Version)',
    opts:  ['Yes', 'No'],
  },
  {
    order: 3,
    label: 'บันทึกน้ำหนักถังเปล่าก่อนนำมา Flush line (น้ำหนักถังต้องไม่เกิน 20 kg)',
    opts:  ['Yes', 'No'],
  },
] as const;

// PUF / PU / IBC only (items 4-5)
const PRE_EXTRA = [
  {
    order: 4,
    label: 'Product ที่ pack ออกมา Tote/Drum แรก ต้องไม่มีสีอื่นเจือปน',
    opts:  ['Yes', 'No', 'NA'],
  },
  {
    order: 5,
    label: 'เก็บ Sample ส่ง Lab (Polyol=250ml / Rigid FM=500ml / Specflex NF=1000ml)',
    opts:  ['Yes', 'No', 'NA'],
  },
] as const;

// 1 post item — all depts
const POST_ITEMS = [
  {
    order: 1,
    label: 'ตรวจสอบว่าระบบได้มีการ purge ในโตรเจนไล่ Product ค้างท่อ หลัง Drumming แล้ว',
    opts:  ['Yes', 'No', 'NA'],
  },
] as const;

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();

  console.log('🌱 Seeding master data…\n');

  // ── 1. Roles ────────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.roles.upsert({
      where:  { role_name: 'admin' },
      update: {},
      create: { role_name: 'admin',  description: 'System Administrator', created_at: now },
    }),
    prisma.roles.upsert({
      where:  { role_name: 'sl' },
      update: {},
      create: { role_name: 'sl',     description: 'Site Logistics',       created_at: now },
    }),
    prisma.roles.upsert({
      where:  { role_name: 'pl' },
      update: {},
      create: { role_name: 'pl',     description: 'Pack Lead',            created_at: now },
    }),
    prisma.roles.upsert({
      where:  { role_name: 'packer' },
      update: {},
      create: { role_name: 'packer', description: 'Packer / Operator',   created_at: now },
    }),
  ]);
  console.log('  ✓ roles (4)');

  // ── 2. Blenders ─────────────────────────────────────────────────────────────
  const blendersSpec = [
    { code: 'V-2300',    dept: 'PUF' as const, capacity_mt: 23.5 },
    { code: 'V-2310',    dept: 'PU'  as const, capacity_mt: 23.5 },
    { code: 'V-2320',    dept: 'PUF' as const, capacity_mt: 10.5 },
    { code: 'V-2800',    dept: 'PU'  as const, capacity_mt: 11.5 },
    { code: 'V-2330',    dept: 'PU'  as const, capacity_mt:  2.0 },
    { code: 'IBC Mixer', dept: 'IBC' as const, capacity_mt:  0.6 },
  ];

  await Promise.all(
    blendersSpec.map(b =>
      prisma.blenders.upsert({
        where:  { code: b.code },
        update: { capacity_mt: b.capacity_mt, updated_at: now },
        create: { ...b, status: 'active', created_at: now, updated_at: now },
      })
    )
  );
  console.log('  ✓ blenders (6)');

  // ── 3. Products ─────────────────────────────────────────────────────────────
  const productsSpec = [
    { product_name: 'DSD 542.01',           gmid: 'DSD542.01',    dept: 'PUF'   as const },
    { product_name: 'DSD 757.01',           gmid: 'DSD757.01',    dept: 'PU'    as const },
    { product_name: 'CN 105',               gmid: 'CN105',        dept: 'IBC'   as const },
    { product_name: 'Latex XQ 83286.01 PA', gmid: 'XQ83286.01PA', dept: 'Latex' as const },
  ];

  await Promise.all(
    productsSpec.map(p =>
      prisma.products.upsert({
        where:  { gmid: p.gmid },
        update: {},
        create: { ...p, is_active: true, created_at: now, updated_at: now },
      })
    )
  );
  console.log('  ✓ products (4)');

  // ── 4. Customers ────────────────────────────────────────────────────────────
  const customerLabels = ['Sharp Thailand', 'Export On Pallet', 'Vietnam Label', 'Thailand Label'];
  for (const label of customerLabels) {
    const existing = await prisma.customers.findFirst({ where: { country_label: label } });
    if (!existing) {
      await prisma.customers.create({ data: { country_label: label, is_active: true, created_at: now, updated_at: now } });
    }
  }
  console.log('  ✓ customers (4)');

  // ── 5. Packaging types ──────────────────────────────────────────────────────
  const packagingSpec = [
    { name: 'Drum 1.0mm',  packaging_category: 'drum' as const, standard_weight_kg: 210,  drums_per_pallet: 4 },
    { name: 'Drum 1.2mm',  packaging_category: 'drum' as const, standard_weight_kg: 210,  drums_per_pallet: 4 },
    { name: 'Tote', packaging_category: 'tote' as const, standard_weight_kg: 1000, drums_per_pallet: 1 },
    { name: 'IBC',         packaging_category: 'ibc'  as const, standard_weight_kg: 1060, drums_per_pallet: 1 },
    { name: 'PE Drum',     packaging_category: 'drum' as const, standard_weight_kg: 210,  drums_per_pallet: 4 },
  ];

  await Promise.all(
    packagingSpec.map(p =>
      prisma.packaging_types.upsert({
        where:  { name: p.name },
        update: {},
        create: { ...p, is_active: true, created_at: now, updated_at: now },
      })
    )
  );
  console.log('  ✓ packaging_types (5)');

  // ── 6. Checklist items ──────────────────────────────────────────────────────
  // checklist_items has no business unique key — delete + recreate.
  // Skip if checklist_responses rows already exist (FK constraint).
  type DeptKey  = 'PUF' | 'PU' | 'IBC' | 'Latex';
  type PhaseKey = 'pre' | 'post';

  interface ChecklistRow {
    form_type:      DeptKey;
    phase:          PhaseKey;
    item_label:     string;
    response_type:  'yes_no' | 'select' | 'text';
    select_options: string[];
    is_required:    boolean;
    is_active:      boolean;
    created_at:     Date;
  }

  const rows: ChecklistRow[] = [];

  function push(
    dept:  DeptKey,
    phase: PhaseKey,
    items: readonly { order: number; label: string; opts: readonly string[] }[],
  ) {
    for (const item of items) {
      const response_type: ChecklistRow['response_type'] =
        item.opts.length === 2 ? 'yes_no' : 'select';

      rows.push({
        form_type:      dept,
        phase,
        item_label:     item.label,
        response_type,
        select_options: [...item.opts],
        is_required:    true,
        is_active:      true,
        created_at:     now,
      });
    }
  }

  for (const dept of ['PUF', 'PU', 'IBC'] as DeptKey[]) {
    push(dept, 'pre',  [...PRE_BASE, ...PRE_EXTRA]);
    push(dept, 'post', POST_ITEMS);
  }
  push('Latex', 'pre',  PRE_BASE);
  push('Latex', 'post', POST_ITEMS);

  const existingResponses = await prisma.checklist_responses.count();

  if (existingResponses > 0) {
    console.log(
      `  ⚠️  checklist_items skipped — ${existingResponses} existing response(s) found.`
    );
  } else {
    await prisma.checklist_items.deleteMany({});
    await prisma.checklist_items.createMany({ data: rows });
    const preCount  = rows.filter(r => r.phase === 'pre').length;
    const postCount = rows.filter(r => r.phase === 'post').length;
    console.log(`  ✓ checklist_items (${rows.length}: ${preCount} pre + ${postCount} post)`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n✅ Master-data seed complete!\n');
  console.log('  Next steps:');
  console.log('  3. npx tsx prisma/production-users.ts   (real users, once per env)');
  console.log('  4. npx tsx prisma/demo-seed.ts           (dev/staging demo lots only)');
  console.log('  5. npx tsx prisma/test-seed.ts           (dev/staging test lots only)\n');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
