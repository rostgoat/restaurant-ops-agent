-- sql-03: How many regulars did we lose over the summer?

WITH visits AS (
  SELECT customer_id, (created_at AT TIME ZONE 'America/Chicago')::date AS local_day
  FROM orders
  WHERE state = 'completed'
    AND customer_id IS NOT NULL
)
SELECT count(*)
FROM (
  SELECT customer_id
  FROM visits
  GROUP BY customer_id
  HAVING count(*) FILTER (WHERE local_day BETWEEN '2026-03-01' AND '2026-05-31') >= 3
     AND count(*) FILTER (WHERE local_day > '2026-08-31') = 0
) lost_regulars
