ALTER TABLE `production_details`
  ADD COLUMN `label_check`   VARCHAR(10)  NULL AFTER `label_pkg_type`,
  ADD COLUMN `sl_follow`     VARCHAR(20)  NULL AFTER `label_check`,
  ADD COLUMN `mdu_machine`   VARCHAR(50)  NULL AFTER `current_pk_step`,
  ADD COLUMN `drum_set`      VARCHAR(50)  NULL AFTER `mdu_machine`,
  ADD COLUMN `recalibration` VARCHAR(5)   NULL AFTER `drum_set`,
  ADD COLUMN `sample_type`   VARCHAR(100) NULL AFTER `recalibration`;
