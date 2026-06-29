-- production_details.dept exists in schema.prisma but was never created in
-- the database (schema drift). Add it now as a nullable VARCHAR to match
-- the Prisma field `dept String? @db.VarChar(20)`.

ALTER TABLE `production_details`
  ADD COLUMN `dept` VARCHAR(20) NULL;
