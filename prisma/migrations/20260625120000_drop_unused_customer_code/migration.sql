-- customer_code was removed from the Prisma schema at some point during
-- development but was never dropped from the actual database (schema drift).
-- It's NOT NULL with no default and unreferenced anywhere in app code, which
-- breaks `prisma.customers.create()` in prisma/seed.ts. Safe to drop.

ALTER TABLE `customers`
  DROP INDEX `customers_customer_code_key`,
  DROP COLUMN `customer_code`,
  DROP COLUMN `customer_name`;
