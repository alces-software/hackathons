USE alces;

CREATE TABLE IF NOT EXISTS market_price_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  market_id VARCHAR(64) NOT NULL,
  prices JSON NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX market_price_history_lookup (market_id, recorded_at),
  CONSTRAINT market_price_history_market_fk FOREIGN KEY (market_id) REFERENCES markets(id)
);

INSERT INTO market_price_history (market_id, prices)
SELECT s.market_id,
       JSON_OBJECTAGG(s.outcome, GREATEST(0.5, (s.amount / t.total_amount) * JSON_LENGTH(m.outcomes)))
FROM (
  SELECT market_id, outcome, SUM(total_staked) AS amount
  FROM positions
  GROUP BY market_id, outcome
) s
JOIN (
  SELECT market_id, SUM(amount) AS total_amount
  FROM (
    SELECT market_id, outcome, SUM(total_staked) AS amount
    FROM positions
    GROUP BY market_id, outcome
  ) grouped
  GROUP BY market_id
) t ON t.market_id = s.market_id
JOIN markets m ON m.id = s.market_id
GROUP BY s.market_id;
