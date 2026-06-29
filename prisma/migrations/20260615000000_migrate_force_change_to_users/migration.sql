-- Migration: move force_change_password from user_auth_state to users.must_change_password

-- Step 1: add the new column to users
ALTER TABLE `users` ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false;

-- Step 2: copy existing data
UPDATE `users` u
  JOIN `user_auth_state` a ON a.user_id = u.id
  SET u.must_change_password = a.force_change_password;

-- Step 3: drop the old table
DROP TABLE `user_auth_state`;
