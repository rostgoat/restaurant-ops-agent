-- sql-08: Since the Seasonal Specials came back on September 1, which drink category has lost the most sales compared with the four weeks before?

WITH drink_sales AS (
  SELECT c.name AS category, oi.total_cents, (o.created_at AT TIME ZONE 'America/Denver')::date AS local_day
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN items i ON i.id = oi.item_id
  JOIN categories c ON c.id = i.category_id
  WHERE o.state = 'completed'
    AND c.name IN ('Signature Drinks', 'House Favorites', 'Matcha', 'Bubble Tea', 'Flights')
)
SELECT category
FROM drink_sales
WHERE local_day BETWEEN '2026-08-04' AND '2026-09-28'
GROUP BY category
ORDER BY sum(total_cents) FILTER (WHERE local_day >= '2026-09-01')
       - sum(total_cents) FILTER (WHERE local_day < '2026-09-01')
LIMIT 1
