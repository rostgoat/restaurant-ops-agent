-- sql-05: In September 2026, how much more did we keep per order in store than on a DoorDash delivery order?

WITH september AS (
  SELECT o.channel, o.fulfillment_type, o.gross_sales_cents,
         o.gross_sales_cents - o.discount_cents AS after_discount,
         coalesce(p.processing_fee_cents, 0) AS fee
  FROM orders o
  LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'completed'
  WHERE o.state = 'completed'
    AND date_trunc('month', o.created_at AT TIME ZONE 'America/Chicago') = '2026-09-01'
)
SELECT round(
    avg(after_discount - fee) FILTER (WHERE channel = 'in_store')
  - avg(after_discount - gross_sales_cents * 0.25) FILTER (WHERE channel = 'doordash' AND fulfillment_type = 'delivery')
)
FROM september
