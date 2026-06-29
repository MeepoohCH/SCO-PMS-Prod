-- CreateTable
CREATE TABLE `flush_blender_types` (
    `id`         INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(60) NOT NULL,
    `is_active`  BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NULL,
    `updated_at` DATETIME(0) NULL,

    UNIQUE INDEX `flush_blender_types_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
