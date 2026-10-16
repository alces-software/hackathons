-- Position payouts: record what a settled position actually paid out.
-- NULL while the market is still open; 0 for losing shares once resolved;
-- the pro-rata pool payout for winning shares (matches settleMarket rounding).
ALTER TABLE positions
  ADD COLUMN payout_mb DECIMAL(18,2) UNSIGNED NULL AFTER total_staked;

-- Backfill resolved markets. The pool at settlement is approximated as the
-- market's total stakes minus its accumulated platform fees (sells would have
-- drained it further, but historical data for those is not recoverable).
UPDATE positions p
JOIN markets m ON m.id = p.market_id
LEFT JOIN (
  SELECT market_id, SUM(total_staked) AS total_staked
  FROM positions
  GROUP BY market_id
) t ON t.market_id = p.market_id
LEFT JOIN (
  SELECT market_id, outcome, SUM(shares) AS winning_shares
  FROM positions
  GROUP BY market_id, outcome
) w ON w.market_id = p.market_id AND w.outcome = m.resolution_outcome
SET p.payout_mb = CASE
  WHEN m.status <> 'resolved' OR m.resolution_outcome IS NULL THEN NULL
  WHEN LOWER(p.outcome) <> LOWER(m.resolution_outcome) THEN 0
  ELSE ROUND(
    ROUND(
      GREATEST(0, COALESCE(t.total_staked, 0) - COALESCE(m.platform_fees_mb, 0))
      / NULLIF(COALESCE(w.winning_shares, 0), 0),
      2
    ) * p.shares,
    2
  )
END;