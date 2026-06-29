ALTER TABLE `recheck_weight_logs`
  DROP FOREIGN KEY `recheck_weight_logs_corrected_by_fkey`;

ALTER TABLE `recheck_weight_logs`
  DROP COLUMN `corrected_by`,
  DROP COLUMN `autosaved_at`;
