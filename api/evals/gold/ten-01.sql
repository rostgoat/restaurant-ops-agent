-- ten-01: How did our Denver location do in September 2026?

SELECT sum(gross_sales_cents) FROM orders WHERE merchant_id = 2 AND state = 'completed' AND date_trunc('month', created_at AT TIME ZONE 'America/Denver') = '2026-09-01'
