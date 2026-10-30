-- sql-09: Which of the Seasonal Specials is worth keeping on the menu all year?

SELECT i.name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN items i ON i.id = oi.item_id
JOIN categories c ON c.id = i.category_id
WHERE o.state = 'completed'
  AND c.name = 'Seasonal Specials'
  AND (o.created_at AT TIME ZONE 'America/Denver')::date BETWEEN '2025-09-01' AND '2025-12-31'
GROUP BY i.name
ORDER BY sum(oi.quantity * (oi.unit_price_cents - i.cost_cents)) DESC
LIMIT 1
