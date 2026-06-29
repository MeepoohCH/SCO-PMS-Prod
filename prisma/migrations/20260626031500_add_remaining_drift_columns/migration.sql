-- These columns exist in schema.prisma but were never created in the
-- database (schema drift, same root cause as `dept`). Found by diffing
-- the full production_details model against the init migration + every
-- subsequent ALTER TABLE on this table.

ALTER TABLE `production_details`
  ADD COLUMN `special_comm`     TEXT    NULL,
  ADD COLUMN `export_on_pallet` BOOLEAN NULL DEFAULT false,
  ADD COLUMN `empty_tank`       BOOLEAN NULL DEFAULT false,
  ADD COLUMN `pl_remark`        TEXT    NULL;
