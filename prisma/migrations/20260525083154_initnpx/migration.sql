-- CreateTable
CREATE TABLE `roles` (
    `id` TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(200) NULL,
    `created_at` DATETIME(0) NULL,

    UNIQUE INDEX `roles_role_name_key`(`role_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `user_type` ENUM('employee', 'contractor') NOT NULL,
    `email` VARCHAR(150) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `pack_lead_id` INTEGER UNSIGNED NULL,
    `last_active_role_id` TINYINT UNSIGNED NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` INTEGER UNSIGNED NOT NULL,
    `role_id` TINYINT UNSIGNED NOT NULL,
    `granted_by` INTEGER UNSIGNED NULL,
    `granted_at` DATETIME(0) NULL,

    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_auth_state` (
    `user_id` INTEGER UNSIGNED NOT NULL,
    `force_change_password` BOOLEAN NOT NULL DEFAULT false,
    `temp_password_expires` DATETIME(0) NULL,
    `last_password_changed` DATETIME(0) NULL,
    `password_reset_token` VARCHAR(255) NULL,
    `password_reset_expires` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blenders` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `capacity_mt` DECIMAL(8, 2) NULL,
    `dept` ENUM('PUF', 'PU', 'IBC', 'Latex') NOT NULL,
    `location` VARCHAR(100) NULL,
    `status` ENUM('active', 'maintenance', 'retired') NOT NULL,
    `deleted_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `blenders_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `product_name` VARCHAR(100) NOT NULL,
    `gmid` VARCHAR(30) NOT NULL,
    `dept` ENUM('PUF', 'PU', 'IBC', 'Latex') NOT NULL,
    `color` VARCHAR(30) NULL,
    `reactivity` ENUM('R0', 'R1', 'R2', 'R3') NOT NULL,
    `allowed_form_types` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `products_gmid_key`(`gmid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `customer_code` VARCHAR(30) NOT NULL,
    `customer_name` VARCHAR(150) NOT NULL,
    `country_label` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `customers_customer_code_key`(`customer_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `packaging_types` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `packaging_category` ENUM('drum', 'tote', 'ibc', 'isotank', 'flexibag') NOT NULL,
    `standard_weight_kg` DECIMAL(8, 2) NULL,
    `drums_per_pallet` SMALLINT NULL,
    `allowed_form_types` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `packaging_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plans` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_date` DATE NOT NULL,
    `blender_id` INTEGER UNSIGNED NOT NULL,
    `form_type` ENUM('PUF', 'PU', 'IBC', 'Latex') NOT NULL,
    `source_type` ENUM('upload', 'manual') NOT NULL,
    `special_comm` TEXT NULL,
    `plan_status` ENUM('draft', 'active', 'completed', 'cancelled') NOT NULL,
    `created_by` INTEGER UNSIGNED NOT NULL,
    `updated_by` INTEGER UNSIGNED NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_details` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER UNSIGNED NOT NULL,
    `sequence_no` SMALLINT NULL,
    `product_id` INTEGER UNSIGNED NOT NULL,
    `customer_id` INTEGER UNSIGNED NOT NULL,
    `packaging_type_id` INTEGER UNSIGNED NOT NULL,
    `lot_no` VARCHAR(30) NOT NULL,
    `production_order` VARCHAR(20) NULL,
    `type_order` ENUM('MTO', 'MTS', 'Rework') NULL,
    `customer_order_no` VARCHAR(30) NULL,
    `country_label` VARCHAR(100) NULL,
    `draft_note` TEXT NULL,
    `blender_no` VARCHAR(30) NULL,
    `shift` VARCHAR(20) NULL,
    `label_no_start` VARCHAR(50) NULL,
    `label_no_end` VARCHAR(50) NULL,
    `label_count` SMALLINT NULL,
    `label_pkg_type` VARCHAR(50) NULL,
    `label_remark` TEXT NULL,
    `label_follow` ENUM('label', 'system', 'system_confirmed') NULL,
    `fill_weight_kg` DECIMAL(8, 2) NULL,
    `target_amount_mt` DECIMAL(10, 3) NULL,
    `empty_drum_wt` DECIMAL(6, 2) NULL,
    `flush_kg` DECIMAL(8, 2) NULL,
    `flush_blender` VARCHAR(50) NULL,
    `purge_kg` DECIMAL(8, 2) NULL,
    `drain_kg` DECIMAL(8, 2) NULL,
    `planned_pallets` SMALLINT NULL,
    `actual_pallet_count` SMALLINT NULL,
    `drums_per_pallet` SMALLINT NULL,
    `container_drum` SMALLINT NULL,
    `container_tote` SMALLINT NULL,
    `cap_large` SMALLINT NULL,
    `cap_small` SMALLINT NULL,
    `batch_size_kg` DECIMAL(10, 2) NULL,
    `cut_off_date` DATE NULL,
    `operation_date` DATE NULL,
    `reblend_source` TEXT NULL,
    `buffer_tank` VARCHAR(20) NULL,
    `lot_drumming_start` DATETIME(0) NULL,
    `lot_drumming_end` DATETIME(0) NULL,
    `detail_status` ENUM('draft', 'waiting', 'in_progress', 'pl_review', 'submitted', 'head_approved', 'completed', 'rejected') NOT NULL DEFAULT 'draft',
    `current_pk_step` TINYINT NULL,
    `reject_remark` TEXT NULL,
    `submitted_at` DATETIME(0) NULL,
    `recorded_by` INTEGER UNSIGNED NULL,
    `verified_by` INTEGER UNSIGNED NULL,
    `last_autosaved_at` DATETIME(0) NULL,
    `autosave_version` INTEGER UNSIGNED NULL,
    `plan_change_notified_at` DATETIME(0) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `production_details_lot_no_key`(`lot_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drumming_sessions` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `production_detail_id` INTEGER UNSIGNED NOT NULL,
    `session_no` SMALLINT NOT NULL,
    `packing_date` DATE NULL,
    `shift` ENUM('morning', 'afternoon', 'night') NULL,
    `shift_date` DATE NULL,
    `operator_id` INTEGER UNSIGNED NULL,
    `started_at` DATETIME(0) NULL,
    `finished_at` DATETIME(0) NULL,
    `session_status` ENUM('in_progress', 'paused', 'completed') NOT NULL,
    `pause_type` ENUM('shift_end', 'emergency', 'maintenance', 'other') NULL,
    `pause_reason` VARCHAR(500) NULL,
    `drumming_mode` ENUM('manual', 'auto') NULL,
    `note` VARCHAR(500) NULL,
    `last_autosaved_at` DATETIME(0) NULL,
    `autosave_version` INTEGER UNSIGNED NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recheck_weight_logs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `drumming_session_id` INTEGER UNSIGNED NOT NULL,
    `pallet_no` SMALLINT NULL,
    `attempt_no` SMALLINT NULL,
    `weight_kg` DECIMAL(8, 2) NULL,
    `fail_reason` ENUM('underweight', 'overweight', 'drum_defect', 'other') NULL,
    `action_taken` VARCHAR(300) NULL,
    `corrected_by` INTEGER UNSIGNED NULL,
    `logged_by` INTEGER UNSIGNED NOT NULL,
    `logged_at` DATETIME(0) NULL,
    `autosaved_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scale_verifications` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `production_detail_id` INTEGER UNSIGNED NOT NULL,
    `machine_code` VARCHAR(20) NULL,
    `standard_weight_kg` DECIMAL(8, 2) NULL,
    `measured_weight_kg` DECIMAL(8, 2) NULL,
    `recalibration_required` BOOLEAN NULL,
    `is_locked` BOOLEAN NULL,
    `locked_at` DATETIME(0) NULL,
    `fail_pause_logged` BOOLEAN NULL,
    `round_no` TINYINT NULL,
    `checked_by` INTEGER UNSIGNED NULL,
    `checked_at` DATETIME(0) NULL,
    `pl_approved_by` INTEGER UNSIGNED NULL,
    `pl_approved_at` DATETIME(0) NULL,
    `last_autosaved_at` DATETIME(0) NULL,
    `autosave_version` INTEGER UNSIGNED NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_operators` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `drumming_session_id` INTEGER UNSIGNED NOT NULL,
    `operator_id` INTEGER UNSIGNED NOT NULL,
    `action` ENUM('started', 'resumed', 'paused_shift_end', 'paused_emergency', 'completed') NOT NULL,
    `new_operator_name` VARCHAR(100) NULL,
    `shift_label` VARCHAR(50) NULL,
    `shift_date` DATE NULL,
    `actioned_at` DATETIME(0) NULL,
    `note` VARCHAR(300) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drum_records` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `drumming_session_id` INTEGER UNSIGNED NOT NULL,
    `pallet_no` SMALLINT NULL,
    `drum_position` TINYINT NULL,
    `drum_serial` VARCHAR(50) NULL,
    `weight_kg` DECIMAL(8, 2) NULL,
    `is_pass` BOOLEAN NULL,
    `recorded_by` INTEGER UNSIGNED NOT NULL,
    `recorded_at` DATETIME(0) NULL,
    `last_autosaved_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_items` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `form_type` ENUM('PUF', 'PU', 'IBC', 'Latex') NOT NULL,
    `phase` ENUM('pre', 'post') NOT NULL,
    `item_order` SMALLINT NULL,
    `item_label` VARCHAR(300) NOT NULL,
    `response_type` ENUM('yes_no', 'select', 'text') NOT NULL,
    `select_options` JSON NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_responses` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `production_detail_id` INTEGER UNSIGNED NOT NULL,
    `checklist_item_id` INTEGER UNSIGNED NOT NULL,
    `phase` ENUM('pre', 'post') NOT NULL,
    `response_value` VARCHAR(500) NULL,
    `responded_by` INTEGER UNSIGNED NOT NULL,
    `responded_at` DATETIME(0) NULL,
    `autosaved_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `downtime_logs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `drumming_session_id` INTEGER UNSIGNED NULL,
    `production_detail_id` INTEGER UNSIGNED NOT NULL,
    `downtime_type` ENUM('chemical_leak', 'pipe_block', 'equipment', 'emergency', 'other') NOT NULL,
    `start_time` DATETIME(0) NULL,
    `end_time` DATETIME(0) NULL,
    `duration_min` SMALLINT NULL,
    `reason` VARCHAR(500) NULL,
    `logged_by` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `approval_logs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `production_detail_id` INTEGER UNSIGNED NOT NULL,
    `action` ENUM('submitted', 'pack_lead_approved', 'completed', 'rejected_by_pl', 'rejected_by_sl') NOT NULL,
    `from_status` VARCHAR(50) NULL,
    `to_status` VARCHAR(50) NULL,
    `actor_id` INTEGER UNSIGNED NOT NULL,
    `remark` VARCHAR(500) NULL,
    `created_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_change_logs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER UNSIGNED NOT NULL,
    `changed_by` INTEGER UNSIGNED NOT NULL,
    `change_type` ENUM('upload_xlsx', 'manual_edit') NOT NULL,
    `old_snapshot` JSON NULL,
    `new_snapshot` JSON NULL,
    `lots_updated` SMALLINT NULL,
    `lots_blocked` SMALLINT NULL,
    `blocked_detail_ids` JSON NULL,
    `created_at` DATETIME(0) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `latex_drumming_data` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `production_detail_id` INTEGER UNSIGNED NOT NULL,
    `no_bacteria` BOOLEAN NULL,
    `no_bacteria_by` VARCHAR(100) NULL,
    `temp_below_40c` BOOLEAN NULL,
    `temp_by` VARCHAR(100) NULL,
    `prev_product_loaded` VARCHAR(150) NULL,
    `flush_before_drumming_kg` DECIMAL(8, 2) NULL,
    `lab_sample_detail` VARCHAR(255) NULL,
    `lot1_qty` SMALLINT NULL,
    `lot2_qty` SMALLINT NULL,
    `storage_area_by` VARCHAR(100) NULL,
    `tag_status` VARCHAR(100) NULL,
    `tag_checked_by` VARCHAR(100) NULL,
    `latex_empty_tank_kg` DECIMAL(8, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `latex_drumming_data_production_detail_id_key`(`production_detail_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_detail_ibc` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `production_detail_id` INTEGER UNSIGNED NOT NULL,
    `operator_name` VARCHAR(100) NULL,
    `quality_status_lab` VARCHAR(50) NULL,
    `residue_kg` DECIMAL(8, 2) NULL,
    `empty_before_kg` DECIMAL(8, 2) NULL,
    `with_product_kg` DECIMAL(8, 2) NULL,
    `product_net_kg` DECIMAL(8, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `production_detail_ibc_production_detail_id_key`(`production_detail_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `drumming_session_ibc` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `drumming_session_id` INTEGER UNSIGNED NOT NULL,
    `ibc_empty_kg` DECIMAL(8, 2) NULL,
    `ibc_with_product_kg` DECIMAL(8, 2) NULL,
    `ibc_product_kg` DECIMAL(8, 2) NULL,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `drumming_session_ibc_drumming_session_id_key`(`drumming_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plan_upload` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER UNSIGNED NOT NULL,
    `source_file` VARCHAR(255) NULL,
    `sheet_name` VARCHAR(100) NULL,
    `blender_count` TINYINT NULL,
    `import_summary` JSON NULL,
    `uploaded_by` INTEGER UNSIGNED NOT NULL,
    `uploaded_at` DATETIME(0) NULL,

    UNIQUE INDEX `production_plan_upload_plan_id_key`(`plan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_pack_lead_id_fkey` FOREIGN KEY (`pack_lead_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_last_active_role_id_fkey` FOREIGN KEY (`last_active_role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_granted_by_fkey` FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_auth_state` ADD CONSTRAINT `user_auth_state_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plans` ADD CONSTRAINT `production_plans_blender_id_fkey` FOREIGN KEY (`blender_id`) REFERENCES `blenders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plans` ADD CONSTRAINT `production_plans_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plans` ADD CONSTRAINT `production_plans_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_details` ADD CONSTRAINT `production_details_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_details` ADD CONSTRAINT `production_details_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_details` ADD CONSTRAINT `production_details_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_details` ADD CONSTRAINT `production_details_packaging_type_id_fkey` FOREIGN KEY (`packaging_type_id`) REFERENCES `packaging_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_details` ADD CONSTRAINT `production_details_recorded_by_fkey` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_details` ADD CONSTRAINT `production_details_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drumming_sessions` ADD CONSTRAINT `drumming_sessions_production_detail_id_fkey` FOREIGN KEY (`production_detail_id`) REFERENCES `production_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drumming_sessions` ADD CONSTRAINT `drumming_sessions_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recheck_weight_logs` ADD CONSTRAINT `recheck_weight_logs_drumming_session_id_fkey` FOREIGN KEY (`drumming_session_id`) REFERENCES `drumming_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recheck_weight_logs` ADD CONSTRAINT `recheck_weight_logs_corrected_by_fkey` FOREIGN KEY (`corrected_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recheck_weight_logs` ADD CONSTRAINT `recheck_weight_logs_logged_by_fkey` FOREIGN KEY (`logged_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scale_verifications` ADD CONSTRAINT `scale_verifications_production_detail_id_fkey` FOREIGN KEY (`production_detail_id`) REFERENCES `production_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scale_verifications` ADD CONSTRAINT `scale_verifications_checked_by_fkey` FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scale_verifications` ADD CONSTRAINT `scale_verifications_pl_approved_by_fkey` FOREIGN KEY (`pl_approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_operators` ADD CONSTRAINT `session_operators_drumming_session_id_fkey` FOREIGN KEY (`drumming_session_id`) REFERENCES `drumming_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_operators` ADD CONSTRAINT `session_operators_operator_id_fkey` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drum_records` ADD CONSTRAINT `drum_records_drumming_session_id_fkey` FOREIGN KEY (`drumming_session_id`) REFERENCES `drumming_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drum_records` ADD CONSTRAINT `drum_records_recorded_by_fkey` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_responses` ADD CONSTRAINT `checklist_responses_production_detail_id_fkey` FOREIGN KEY (`production_detail_id`) REFERENCES `production_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_responses` ADD CONSTRAINT `checklist_responses_checklist_item_id_fkey` FOREIGN KEY (`checklist_item_id`) REFERENCES `checklist_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_responses` ADD CONSTRAINT `checklist_responses_responded_by_fkey` FOREIGN KEY (`responded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `downtime_logs` ADD CONSTRAINT `downtime_logs_drumming_session_id_fkey` FOREIGN KEY (`drumming_session_id`) REFERENCES `drumming_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `downtime_logs` ADD CONSTRAINT `downtime_logs_production_detail_id_fkey` FOREIGN KEY (`production_detail_id`) REFERENCES `production_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `downtime_logs` ADD CONSTRAINT `downtime_logs_logged_by_fkey` FOREIGN KEY (`logged_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_logs` ADD CONSTRAINT `approval_logs_production_detail_id_fkey` FOREIGN KEY (`production_detail_id`) REFERENCES `production_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `approval_logs` ADD CONSTRAINT `approval_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_change_logs` ADD CONSTRAINT `plan_change_logs_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_change_logs` ADD CONSTRAINT `plan_change_logs_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `latex_drumming_data` ADD CONSTRAINT `latex_drumming_data_production_detail_id_fkey` FOREIGN KEY (`production_detail_id`) REFERENCES `production_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_detail_ibc` ADD CONSTRAINT `production_detail_ibc_production_detail_id_fkey` FOREIGN KEY (`production_detail_id`) REFERENCES `production_details`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `drumming_session_ibc` ADD CONSTRAINT `drumming_session_ibc_drumming_session_id_fkey` FOREIGN KEY (`drumming_session_id`) REFERENCES `drumming_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plan_upload` ADD CONSTRAINT `production_plan_upload_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plan_upload` ADD CONSTRAINT `production_plan_upload_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
