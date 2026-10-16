-- Bookie integration: map Alces users to Alces Bookie accounts and
-- record the bookie transaction that funded each position.
ALTER TABLE users
  ADD COLUMN bookie_username VARCHAR(25) NULL,
  ADD COLUMN bookie_password_hash VARCHAR(255) NULL,
  ADD UNIQUE KEY uq_bookie_username (bookie_username);

ALTER TABLE positions
  ADD COLUMN bookie_transaction_id INT NULL;