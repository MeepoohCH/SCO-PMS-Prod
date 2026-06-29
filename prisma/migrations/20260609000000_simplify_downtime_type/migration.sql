-- Step 1: Expand enum to include both old and new values so updates can use 'issue'
ALTER TABLE `downtime_logs` MODIFY COLUMN `downtime_type` ENUM('chemical_leak', 'pipe_block', 'equipment', 'emergency', 'other', 'issue') NOT NULL;

-- Step 2: Migrate existing rows — map old sub-types to 'issue' with prefix in reason
UPDATE `downtime_logs` SET `downtime_type` = 'issue', `reason` = CONCAT('[Equipment] ',     COALESCE(`reason`, '')) WHERE `downtime_type` = 'equipment';
UPDATE `downtime_logs` SET `downtime_type` = 'issue', `reason` = CONCAT('[Chemical Leak] ', COALESCE(`reason`, '')) WHERE `downtime_type` = 'chemical_leak';
UPDATE `downtime_logs` SET `downtime_type` = 'issue', `reason` = CONCAT('[Pipe Block] ',    COALESCE(`reason`, '')) WHERE `downtime_type` = 'pipe_block';
UPDATE `downtime_logs` SET `downtime_type` = 'issue', `reason` = CONCAT('[Other] ',         COALESCE(`reason`, '')) WHERE `downtime_type` = 'other';

-- Step 3: Shrink enum to final two values only
ALTER TABLE `downtime_logs` MODIFY COLUMN `downtime_type` ENUM('emergency', 'issue') NOT NULL;
