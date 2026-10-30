-- sql-06: What was our average tip in September 2026?

SELECT avg(tip_cents)
FROM orders
WHERE state = 'completed'
  AND date_trunc('month', created_at AT TIME ZONE 'America/Chicago') = '2026-09-01'
