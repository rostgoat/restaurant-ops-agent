-- sql-11: How many catering orders did we do in September?

SELECT count(DISTINCT o.id)
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN items i ON i.id = oi.item_id
JOIN categories c ON c.id = i.category_id
WHERE o.state = 'completed'
  AND c.name = 'Catering'
  AND o.created_at >= timestamp '2026-09-01' AT TIME ZONE 'America/Chicago'
  AND o.created_at <  timestamp '2026-10-01' AT TIME ZONE 'America/Chicago'
