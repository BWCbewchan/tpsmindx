-- Update default value for show_birthday column from true to false
-- This migration changes the default behavior for new privacy settings

-- Step 1: Update the column default value
ALTER TABLE teacher_privacy_settings 
ALTER COLUMN show_birthday SET DEFAULT false;

-- Step 2 (Optional): Update existing records that have show_birthday = true to false
-- Uncomment the following lines if you want to change existing users' settings
-- WARNING: This will affect all existing users who currently have show_birthday enabled
-- 
-- UPDATE teacher_privacy_settings 
-- SET show_birthday = false, updated_at = CURRENT_TIMESTAMP
-- WHERE show_birthday = true;

-- Verify the change
SELECT column_name, column_default, data_type
FROM information_schema.columns
WHERE table_name = 'teacher_privacy_settings' 
  AND column_name = 'show_birthday';
