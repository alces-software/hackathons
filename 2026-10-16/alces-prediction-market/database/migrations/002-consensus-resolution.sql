USE alces;

ALTER TABLE markets ADD COLUMN resolution_outcome VARCHAR(255) NULL AFTER status;

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
