-- Tables for the fake restaurant data, plus the tables this app writes itself.
--
-- Two databases are built from this file:
--   ops_demo   What the live site reads. A new day of orders is added every
--              night so the data never looks abandoned.
--   ops_eval   What the tests read. It only changes when the seed changes, so
--              a score from today can be compared with one from last month.
--
-- All money is whole cents. All times are timestamptz.

BEGIN;

-- ===========================================================================
-- Point-of-sale data (what the agent queries)
-- ===========================================================================

CREATE TABLE merchants (
    id          integer PRIMARY KEY,
    name        text    NOT NULL,
    cuisine     text    NOT NULL,
    timezone    text    NOT NULL,
    opened_at   date    NOT NULL
);

CREATE TABLE categories (
    id          integer PRIMARY KEY,
    merchant_id integer NOT NULL REFERENCES merchants(id),
    name        text    NOT NULL,
    UNIQUE (merchant_id, name)
);

CREATE TABLE items (
    id          integer PRIMARY KEY,
    merchant_id integer NOT NULL REFERENCES merchants(id),
    category_id integer NOT NULL REFERENCES categories(id),
    name        text    NOT NULL,
    price_cents integer NOT NULL CHECK (price_cents >= 0),
    is_active   boolean NOT NULL DEFAULT true
);

CREATE TABLE customers (
    id                   integer PRIMARY KEY,
    merchant_id          integer     NOT NULL REFERENCES merchants(id),
    first_seen_at        timestamptz NOT NULL,
    has_email            boolean     NOT NULL DEFAULT false,
    has_phone            boolean     NOT NULL DEFAULT false,
    email_opt_in         boolean     NOT NULL DEFAULT false,
    -- Two different permissions. Either one makes a guest reachable, but only
    -- a verified opt-in survives being challenged.
    sms_opt_in           boolean     NOT NULL DEFAULT false,
    sms_implied_consent  boolean     NOT NULL DEFAULT false,
    unsubscribed_at      timestamptz
);

CREATE TYPE channel AS ENUM (
    'in_store', 'square_online', 'doordash', 'uber_eats', 'grubhub'
);

CREATE TYPE fulfillment AS ENUM ('pickup', 'delivery', 'in_store');
CREATE TYPE order_state AS ENUM ('completed', 'canceled', 'draft');

CREATE TABLE orders (
    id                integer     PRIMARY KEY,
    merchant_id       integer     NOT NULL REFERENCES merchants(id),
    customer_id       integer     REFERENCES customers(id),  -- null = unidentified guest
    created_at        timestamptz NOT NULL,
    channel           channel     NOT NULL,
    -- The label as it arrives, which is free text and inconsistent. Kept
    -- alongside the enum because grouping on one gives a different answer
    -- than grouping on the other.
    source_raw        text,
    fulfillment_type  fulfillment,
    state             order_state NOT NULL DEFAULT 'completed',
    item_count        integer     NOT NULL CHECK (item_count >= 0),
    gross_sales_cents integer     NOT NULL CHECK (gross_sales_cents >= 0),
    discount_cents    integer     NOT NULL DEFAULT 0,
    tax_cents         integer     NOT NULL DEFAULT 0,
    -- Null, not zero: delivery marketplaces do not pass tips through at all.
    -- Averaging without accounting for that is wrong.
    tip_cents         integer,
    total_cents       integer     NOT NULL CHECK (total_cents >= 0)
);

CREATE TABLE order_items (
    id               integer PRIMARY KEY,
    merchant_id      integer NOT NULL REFERENCES merchants(id),
    order_id         integer NOT NULL REFERENCES orders(id),
    item_id          integer NOT NULL REFERENCES items(id),
    quantity         integer NOT NULL CHECK (quantity > 0),
    unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
    total_cents      integer NOT NULL CHECK (total_cents >= 0)
);

CREATE TYPE payment_status AS ENUM ('completed', 'failed', 'canceled');

CREATE TABLE payments (
    id                    integer        PRIMARY KEY,
    order_id              integer        NOT NULL REFERENCES orders(id),
    merchant_id           integer        NOT NULL REFERENCES merchants(id),
    created_at            timestamptz    NOT NULL,
    amount_cents          integer        NOT NULL CHECK (amount_cents >= 0),
    tip_cents             integer,
    processing_fee_cents  integer,
    refunded_amount_cents integer        NOT NULL DEFAULT 0,
    card_brand            text,          -- null for cash and marketplace orders
    entry_method          text,
    status                payment_status NOT NULL DEFAULT 'completed'
);

CREATE INDEX orders_merchant_created   ON orders (merchant_id, created_at);
CREATE INDEX orders_merchant_channel   ON orders (merchant_id, channel);
CREATE INDEX orders_customer           ON orders (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX order_items_order         ON order_items (order_id);
CREATE INDEX order_items_item          ON order_items (item_id);
CREATE INDEX order_items_merchant      ON order_items (merchant_id);
CREATE INDEX payments_merchant_created ON payments (merchant_id, created_at);
CREATE INDEX items_merchant_category   ON items (merchant_id, category_id);
CREATE INDEX customers_merchant        ON customers (merchant_id);

-- ===========================================================================
-- Application tables (what the agent writes)
-- ===========================================================================

CREATE TYPE request_status AS ENUM ('answered', 'refused', 'blocked', 'error');

CREATE TABLE request_traces (
    id          uuid           PRIMARY KEY,
    merchant_id integer        NOT NULL REFERENCES merchants(id),
    created_at  timestamptz    NOT NULL DEFAULT now(),
    question    text           NOT NULL,
    status      request_status NOT NULL,
    answer      text,
    model       text,
    tokens_in   integer,
    tokens_out  integer,
    cost_usd    numeric(10, 6),
    latency_ms  integer,
    model_ms    integer,
    tool_ms     integer,
    cached      boolean        NOT NULL DEFAULT false,
    retries     integer        NOT NULL DEFAULT 0
);

CREATE TYPE actor AS ENUM ('model', 'code', 'human');

CREATE TABLE trace_steps (
    id         bigserial PRIMARY KEY,
    trace_id   uuid      NOT NULL REFERENCES request_traces(id) ON DELETE CASCADE,
    seq        integer   NOT NULL,
    actor      actor     NOT NULL,
    name       text      NOT NULL,
    outcome    text,
    detail     jsonb,
    latency_ms integer,
    UNIQUE (trace_id, seq)
);

CREATE TYPE proposal_status AS ENUM ('pending', 'approved', 'rejected', 'blocked');

CREATE TABLE proposals (
    id             uuid            PRIMARY KEY,
    merchant_id    integer         NOT NULL REFERENCES merchants(id),
    trace_id       uuid            REFERENCES request_traces(id),
    created_at     timestamptz     NOT NULL DEFAULT now(),
    kind           text            NOT NULL,
    summary        text            NOT NULL,
    audience_size  integer         NOT NULL,
    discount_pct   integer,
    draft_message  text,
    status         proposal_status NOT NULL DEFAULT 'pending',
    blocked_reason text,
    decided_at     timestamptz,
    payload        jsonb
);

CREATE INDEX traces_merchant_created ON request_traces (merchant_id, created_at DESC);
CREATE INDEX steps_trace             ON trace_steps (trace_id, seq);
CREATE INDEX proposals_merchant      ON proposals (merchant_id, created_at DESC);

COMMIT;
