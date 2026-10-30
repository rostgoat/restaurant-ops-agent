-- sql-04: Which side dish earns us the least per unit on Uber Eats delivery, after Uber's commission and food cost?

SELECT i.name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN items i ON i.id = oi.item_id
JOIN categories c ON c.id = i.category_id
WHERE o.state = 'completed'
  AND o.channel = 'uber_eats'
  AND o.fulfillment_type = 'delivery'
  AND c.name = 'Sides'
GROUP BY i.name, i.cost_cents
ORDER BY avg(oi.unit_price_cents) * 0.70 - i.cost_cents
LIMIT 1
