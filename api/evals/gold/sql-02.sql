-- sql-02: How many new customers did Lunch 20 bring in?

SELECT count(*)
FROM (
  SELECT DISTINCT ON (customer_id) discount_name
  FROM orders
  WHERE state = 'completed'
    AND customer_id IS NOT NULL
  ORDER BY customer_id, created_at
) first_order
WHERE discount_name = 'Lunch 20'
