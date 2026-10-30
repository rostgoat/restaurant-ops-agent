-- sql-07: What did we net from DoorDash delivery orders in September 2026 after their commission?

SELECT round(sum(gross_sales_cents * 0.75 - discount_cents))
FROM orders
WHERE state = 'completed'
  AND channel = 'doordash'
  AND fulfillment_type = 'delivery'
  AND date_trunc('month', created_at AT TIME ZONE 'America/Chicago') = '2026-09-01'
