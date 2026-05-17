-- Add B2C tracking columns to withdrawal_requests
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS b2c_conversation_id TEXT;
ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS b2c_originator_id TEXT;
