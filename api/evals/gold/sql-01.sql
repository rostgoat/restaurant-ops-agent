-- sql-01: Compared with the same four weeks last year, how much more did lunch bring in during the Lunch 20 promo?

WITH lunch AS (
  SELECT gross_sales_cents, created_at AT TIME ZONE 'America/Chicago' AS local_time
  FROM orders
  WHERE state = 'completed'
    AND channel IN ('in_store', 'square_online')
)
SELECT sum(gross_sales_cents) FILTER (WHERE local_time::date BETWEEN '2026-08-03' AND '2026-08-30')
     - sum(gross_sales_cents) FILTER (WHERE local_time::date BETWEEN '2025-08-03' AND '2025-08-30')
FROM lunch
WHERE extract(hour FROM local_time) BETWEEN 11 AND 13
