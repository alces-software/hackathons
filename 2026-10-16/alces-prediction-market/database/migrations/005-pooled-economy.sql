-- Pooled economy: the platform takes a small fee on every buy and the rest
-- pools between bettors. Settlement pays winners out of the pool only, so no
-- moose bucks are ever minted from thin air.
ALTER TABLE markets
  ADD COLUMN pool_mb DECIMAL(18,2) UNSIGNED NOT NULL DEFAULT 0 AFTER total_volume,
  ADD COLUMN platform_fees_mb DECIMAL(18,2) UNSIGNED NOT NULL DEFAULT 0 AFTER pool_mb;

-- Backfill: open and closed markets hold their staked funds in the pool.
-- Resolved markets have already paid out, so they stay at zero.
UPDATE markets m
LEFT JOIN (
  SELECT market_id, SUM(total_staked) AS staked
  FROM positions
  GROUP BY market_id
) p ON p.market_id = m.id
SET m.pool_mb = COALESCE(p.staked, 0)
WHERE m.status IN ('open', 'closed');