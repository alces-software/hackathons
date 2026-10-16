-- Accounts: per-user login credentials and recoverable bookie credentials.
ALTER TABLE users
  ADD COLUMN password_hash VARCHAR(255) NULL AFTER display_name,
  MODIFY COLUMN bookie_password_hash VARCHAR(512) NULL;