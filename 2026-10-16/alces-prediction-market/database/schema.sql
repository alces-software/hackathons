
CREATE DATABASE IF NOT EXISTS alces;
USE alces;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  display_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NULL,
  moose_bucks DECIMAL(18,2) UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bookie_username VARCHAR(25) NULL,
  bookie_password_hash VARCHAR(512) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bookie_username (bookie_username)
);

CREATE TABLE IF NOT EXISTS markets (
  id VARCHAR(64) NOT NULL,
  category ENUM('consensus', 'tech', 'entertainment', 'markets', 'sports') NOT NULL,
  title VARCHAR(255) NOT NULL,
  outcomes JSON NOT NULL,
  yes_probability TINYINT UNSIGNED NOT NULL,
  total_volume DECIMAL(18,2) UNSIGNED NOT NULL DEFAULT 0,
  pool_mb DECIMAL(18,2) UNSIGNED NOT NULL DEFAULT 0,
  platform_fees_mb DECIMAL(18,2) UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('open', 'closed', 'resolved', 'void') NOT NULL DEFAULT 'open',
  resolution_outcome VARCHAR(255) NULL,
  closes_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX markets_status_closes_at (status, closes_at)
);

CREATE TABLE IF NOT EXISTS positions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  market_id VARCHAR(64) NOT NULL,
  outcome VARCHAR(255) NOT NULL,
  shares INT UNSIGNED NOT NULL DEFAULT 0,
  total_staked DECIMAL(18,2) UNSIGNED NOT NULL DEFAULT 0,
  payout_mb DECIMAL(18,2) UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  bookie_transaction_id INT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY one_position_per_outcome (user_id, market_id, outcome),
  CONSTRAINT positions_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT positions_market_fk FOREIGN KEY (market_id) REFERENCES markets(id)
);

CREATE TABLE IF NOT EXISTS resolution_votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  market_id VARCHAR(64) NOT NULL,
  outcome VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY one_resolution_vote (user_id, market_id),
  CONSTRAINT resolution_votes_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT resolution_votes_market_fk FOREIGN KEY (market_id) REFERENCES markets(id)
);

CREATE TABLE IF NOT EXISTS market_price_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  market_id VARCHAR(64) NOT NULL,
  prices JSON NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX market_price_history_lookup (market_id, recorded_at),
  CONSTRAINT market_price_history_market_fk FOREIGN KEY (market_id) REFERENCES markets(id)
);
