#!/usr/bin/env python3
"""
Generate the synthetic point-of-sale dataset from the merchant profiles.

    python data/generate.py --out data/out --months 12 --seed 42
    python data/generate.py --out data/append/2026-10-20 --append-day 2026-10-20 --seed 42

Writes one CSV per table plus load.sql. Deterministic: the same seed and
arguments always produce the same dataset, so the repo stores a config and a
generator rather than a dump.

Two things it models that independent sampling would get wrong:

  Channel markup. Delivery marketplaces list the same items at a markup, so
  basket size stays flat while ticket value runs higher.

  Missing tips. Marketplaces do not pass tips to the POS, so tip_cents is
  NULL for those channels rather than 0.
"""

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np

DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
DAYPARTS = [
    ("early_morning", range(5, 11)),
    ("lunch", range(11, 15)),
    ("afternoon", range(15, 17)),
    ("dinner", range(17, 22)),
]


def daypart_of(hour: int) -> str:
    for name, hours in DAYPARTS:
        if hour in hours:
            return name

    return "late_night"


def from_percentiles(rng: np.random.Generator, p: dict, n: int) -> np.ndarray:
    """
    Sample by interpolating the profile's percentile curve.

    The tail beyond the highest percentile is deliberately not linear. A
    profile like {p99: 8, max: 304} describes a distribution where almost
    everything sits near 8 and a handful of catering orders reach 304.
    Interpolating straight from p99 to max puts a full 1% of samples in that
    range and inflates the mean. Instead the last decade of probability is
    split geometrically, so max is reachable but rare.
    """
    keys = sorted((k for k in p if k.startswith("p")), key=lambda k: int(k[1:]))
    xs = [int(k[1:]) / 100 for k in keys]
    ys = [float(p[k]) for k in keys]

    if "max" in p and ys:
        top_x, top_y = xs[-1], ys[-1]
        hi = float(p["max"])

        if hi > top_y:
            gap = 1.0 - top_x

            for frac, scale in ((0.1, 1.5), (0.01, 3.0)):
                xs.append(1.0 - gap * frac)
                ys.append(min(hi, top_y * scale))
            xs.append(1.0)
            ys.append(hi)

    return np.interp(rng.random(n), np.array(xs), np.array(ys))


def pick(rng: np.random.Generator, mapping: dict[str, float], n: int) -> np.ndarray:
    keys = list(mapping)
    w = np.array([mapping[k] for k in keys], dtype=float)

    return rng.choice(keys, size=n, p=w / w.sum())


# Membership by id, not by draw, so an appended day agrees with the backfill.
# One customer in 50 is a regular; one in 500 is also a serial refunder.
REGULAR_EVERY = 50
SERIAL_REFUNDER_EVERY = 500


@dataclass
class Ids:
    """Monotonic id allocator, so appended days never collide with backfill."""

    order: int = 1
    order_item: int = 1
    payment: int = 1
    customer: int = 1
    item: int = 1
    category: int = 1

    def take(self, field: str, n: int = 1) -> int:
        start = getattr(self, field)
        setattr(self, field, start + n)

        return start


class Writer:
    def __init__(self, out: Path):
        out.mkdir(parents=True, exist_ok=True)
        self._files: dict[str, csv.writer] = {}
        self._handles = []
        self._out = out

    def table(self, name: str, header: list[str]):
        if name not in self._files:
            fh = open(self._out / f"{name}.csv", "w", newline="")
            self._handles.append(fh)
            w = csv.writer(fh)
            w.writerow(header)
            self._files[name] = w

        return self._files[name]

    def close(self):
        for fh in self._handles:
            fh.close()


def build_catalog(profile: dict, ids: Ids, rng: np.random.Generator, w: Writer):
    """Categories and items. Returns per-category item pools for order building."""
    cat_w = w.table("categories", ["id", "merchant_id", "name"])
    item_w = w.table(
        "items", ["id", "merchant_id", "category_id", "name", "price_cents", "is_active"]
    )
    pools: list[tuple[float, np.ndarray, np.ndarray]] = []

    for spec in profile["categories"]:
        cid = ids.take("category")
        cat_w.writerow([cid, profile["id"], spec["name"]])
        count = max(1, int(spec["item_count"]))
        prices = np.maximum(25, from_percentiles(rng, spec["price_cents"], count).round(-1)).astype(
            int
        )
        item_ids = []

        for i, price in enumerate(prices, start=1):
            iid = ids.take("item")
            item_ids.append(iid)
            item_w.writerow([iid, profile["id"], cid, f"{spec['name']} {i}", int(price), "true"])
        pools.append((float(spec["line_share"]), np.array(item_ids), prices))
    shares = np.array([p[0] for p in pools])

    return pools, shares / shares.sum()


def read_catalog(profile: dict, catalog: Path):
    mid = profile["id"]

    with open(catalog / "categories.csv", newline="") as fh:
        category_ids = {
            row["name"]: int(row["id"])
            for row in csv.DictReader(fh)
            if int(row["merchant_id"]) == mid
        }
    by_category: dict[int, list[tuple[int, int]]] = {}

    with open(catalog / "items.csv", newline="") as fh:
        for row in csv.DictReader(fh):
            if int(row["merchant_id"]) == mid:
                by_category.setdefault(int(row["category_id"]), []).append(
                    (int(row["id"]), int(row["price_cents"]))
                )
    pools = []

    for spec in profile["categories"]:
        items = by_category[category_ids[spec["name"]]]
        pools.append(
            (
                float(spec["line_share"]),
                np.array([item_id for item_id, _ in items]),
                np.array([price for _, price in items]),
            )
        )
    shares = np.array([p[0] for p in pools])

    return pools, shares / shares.sum()


def read_customer_ids(profile: dict, catalog: Path) -> np.ndarray:
    mid = profile["id"]

    with open(catalog / "customers.csv", newline="") as fh:
        return np.array(
            [int(row["id"]) for row in csv.DictReader(fh) if int(row["merchant_id"]) == mid]
        )


def build_customers(
    profile: dict, ids: Ids, rng: np.random.Generator, w: Writer, start: datetime, size: int
) -> np.ndarray:
    c = profile["customers"]
    cw = w.table(
        "customers",
        [
            "id",
            "merchant_id",
            "first_seen_at",
            "has_email",
            "has_phone",
            "email_opt_in",
            "sms_opt_in",
            "sms_implied_consent",
            "unsubscribed_at",
        ],
    )
    ids_out = []
    span_days = 365

    for _ in range(size):
        cid = ids.take("customer")
        ids_out.append(cid)
        seen = start + timedelta(days=float(rng.random() * span_days))
        unsubscribed = ""

        if rng.random() < c["unsubscribed_rate"]:
            remaining = max(1.0, (start + timedelta(days=span_days) - seen).days)
            unsubscribed = (seen + timedelta(days=float(rng.random() * remaining))).isoformat()
        cw.writerow(
            [
                cid,
                profile["id"],
                seen.isoformat(),
                str(rng.random() < c["has_email_rate"]).lower(),
                str(rng.random() < c["has_phone_rate"]).lower(),
                str(rng.random() < c["email_opt_in_rate"]).lower(),
                str(rng.random() < c["sms_opt_in_rate"]).lower(),
                str(rng.random() < c["sms_implied_consent_rate"]).lower(),
                unsubscribed,
            ]
        )
    return np.array(ids_out)


ORDER_COLUMNS = [
    "id", "merchant_id", "customer_id", "created_at", "channel", "source_raw",
    "fulfillment_type", "state", "item_count", "gross_sales_cents", "discount_cents",
    "tax_cents", "tip_cents", "total_cents",
]  # fmt: skip
ORDER_ITEM_COLUMNS = [
    "id",
    "merchant_id",
    "order_id",
    "item_id",
    "quantity",
    "unit_price_cents",
    "total_cents",
]
PAYMENT_COLUMNS = [
    "id", "order_id", "merchant_id", "created_at", "amount_cents", "tip_cents",
    "processing_fee_cents", "refunded_amount_cents", "card_brand", "entry_method", "status",
]  # fmt: skip
MARKETPLACE = ("doordash", "uber_eats", "grubhub")


def generate_orders(
    profile: dict,
    ids: Ids,
    rng: np.random.Generator,
    w: Writer,
    days: list[date],
    pools,
    pool_p,
    customer_ids: np.ndarray,
):
    """Every rng call happens in the same order as before, so seed 42 still
    yields the same dataset. Keep it that way when editing."""
    writers = (
        w.table("orders", ORDER_COLUMNS),
        w.table("order_items", ORDER_ITEM_COLUMNS),
        w.table("payments", PAYMENT_COLUMNS),
    )
    channels = profile["channels"]
    hour_w = np.array(profile["hour_of_day_weights"], dtype=float)
    hour_p = hour_w / hour_w.sum()
    regulars = (
        customer_ids[customer_ids % REGULAR_EVERY == 0] if len(customer_ids) else customer_ids
    )

    for day in days:
        n = _orders_on(rng, profile, day)

        if n == 0:
            continue
        hours = rng.choice(24, size=n, p=hour_p)
        chans = pick(rng, {c: channels[c]["share"] for c in channels}, n)
        baskets = np.maximum(1, from_percentiles(rng, profile["basket_size"], n).round()).astype(
            int
        )

        for k in range(n):
            _write_order(
                profile, ids, rng, writers, pools, pool_p, customer_ids, regulars,
                day, chans[k], int(hours[k]), int(baskets[k]),
            )  # fmt: skip


def _orders_on(rng: np.random.Generator, profile: dict, day: date) -> int:
    """orders_per_month spread over 52 weeks, then split by weekday weight."""
    dow_w = profile["day_of_week_weights"]
    share = dow_w[DOW[day.weekday()]] / sum(dow_w.values())
    expected = profile["orders_per_month"] * 12 * share / 52.0

    return int(rng.poisson(max(0.1, expected)))


def _write_order(
    profile, ids, rng, writers, pools, pool_p, customer_ids, regulars, day, chan, hour, size
):
    ow, oiw, pw = writers
    ch = profile["channels"][chan]
    dname = DOW[day.weekday()]
    created = _created_at(rng, profile, day, hour)

    if "basket_size_override" in ch:
        size = max(1, int(from_percentiles(rng, ch["basket_size_override"], 1)[0]))
    # Moves ticket value, not basket size.
    occasion = profile["daypart_value_multiplier"].get(daypart_of(hour), 1.0) * profile[
        "day_of_week_value_multiplier"
    ].get(dname, 1.0)
    oid = ids.take("order")
    lines, gross = _basket(rng, pools, pool_p, size, ch["value_multiplier"], occasion)
    discount = _discount(rng, profile["discount"], gross)
    taxable = gross - discount
    tax_rate = profile["tax_rate_bps"] / 10_000
    tax = int(round(taxable * tax_rate))
    tip_int = _tip(rng, profile, ch, gross)
    tip = str(tip_int) if tip_int else ""
    total = taxable + tax + tip_int
    state = pick(rng, profile["order_state_mix"], 1)[0]
    fulfil = pick(rng, ch["fulfillment"], 1)[0]
    raw = ch["source_raw"][int(rng.integers(0, len(ch["source_raw"])))]
    cust = _customer(rng, profile, customer_ids, regulars)
    mid = profile["id"]
    ow.writerow(
        [oid, mid, cust, created.isoformat(), chan, raw if raw is not None else "", fulfil,
         state, size, gross, discount, tax, tip, total]
    )  # fmt: skip

    for item_id, qty, unit, line_total in lines:
        oiw.writerow([ids.take("order_item"), mid, oid, item_id, qty, unit, line_total])

    if state == "completed":
        _write_payment(pw, ids, rng, profile, chan, oid, created, total, tip, cust)


def _created_at(rng: np.random.Generator, profile: dict, day: date, hour: int) -> datetime:
    return datetime(
        day.year,
        day.month,
        day.day,
        hour,
        int(rng.integers(0, 60)),
        int(rng.integers(0, 60)),
        tzinfo=ZoneInfo(profile["timezone"]),
    )


def _basket(rng, pools, pool_p, size: int, markup: float, occasion: float):
    """The markup lives on unit price, which is how marketplaces actually
    price, so basket size stays flat across channels."""
    lines = []
    gross = 0

    for _ in range(size):
        pi = rng.choice(len(pools), p=pool_p)
        _, item_ids, prices = pools[pi]
        j = int(rng.integers(0, len(item_ids)))
        qty = 1 if rng.random() > 0.08 else 2
        unit = int(round(prices[j] * markup * occasion))
        lines.append((int(item_ids[j]), qty, unit, unit * qty))
        gross += unit * qty

    return lines, gross


def _discount(rng: np.random.Generator, disc: dict, gross: int) -> int:
    if rng.random() >= disc["attach_rate"]:
        return 0
    rate = float(from_percentiles(rng, disc["rate_pct"], 1)[0]) / 100

    return min(gross, int(round(gross * min(1.0, rate))))


def _tip(rng: np.random.Generator, profile: dict, ch: dict, gross: int) -> int:
    if not ch["tips"] or rng.random() >= ch.get("tip_attach_rate", 0.0):
        return 0
    rate = float(from_percentiles(rng, profile["tip_rate_pct"], 1)[0]) / 100

    return int(round(gross * rate))


def _customer(rng, profile: dict, customer_ids: np.ndarray, regulars: np.ndarray) -> str:
    c = profile["customers"]

    if not len(customer_ids) or rng.random() >= c["identified_order_rate"]:
        return ""
    from_regulars = rng.random() < c["regular_order_share"]
    pool = regulars if len(regulars) and from_regulars else customer_ids

    return str(int(rng.choice(pool)))


def _write_payment(pw, ids, rng, profile, chan, oid, created, total, tip, cust) -> None:
    pay = profile["payments"]
    failed = rng.random() < pay["failure_rate"]
    serial = cust != "" and int(cust) % SERIAL_REFUNDER_EVERY == 0
    refund_rate = profile["customers"]["serial_refund_rate"] if serial else pay["refund_rate"]
    refunded = 0 if failed else (total if rng.random() < refund_rate else 0)
    fee_rate = float(from_percentiles(rng, pay["processing_fee_rate_pct"], 1)[0]) / 100
    brand, entry = _card(rng, pay, chan)
    pw.writerow(
        [ids.take("payment"), oid, profile["id"], created.isoformat(), total, tip,
         int(round(total * fee_rate)), refunded, brand, entry, "failed" if failed else "completed"]
    )  # fmt: skip


def _card(rng: np.random.Generator, pay: dict, chan: str) -> tuple[str, str]:
    """Blank for marketplace orders, which pay out in bulk, and for cash."""
    if chan in MARKETPLACE:
        return "", ""

    if rng.random() < pay["cash_share"]:
        return "", "CASH"

    return pick(rng, pay["card_brand_mix"], 1)[0], pick(rng, pay["entry_method_mix"], 1)[0]


LOAD_SQL = """-- Generated by data/generate.py. Run against a database created with schema.sql.
\\copy merchants    FROM 'merchants.csv'    CSV HEADER
\\copy categories   FROM 'categories.csv'   CSV HEADER
\\copy items        FROM 'items.csv'        CSV HEADER
\\copy customers    FROM 'customers.csv'    CSV HEADER
\\copy orders       FROM 'orders.csv'       CSV HEADER
\\copy order_items  FROM 'order_items.csv'  CSV HEADER
\\copy payments     FROM 'payments.csv'     CSV HEADER
"""

APPEND_SQL = """-- Generated by data/generate.py --append-day. Adds one day to a loaded database.
\\copy orders       FROM 'orders.csv'       CSV HEADER
\\copy order_items  FROM 'order_items.csv'  CSV HEADER
\\copy payments     FROM 'payments.csv'     CSV HEADER
"""


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("data/out"))
    ap.add_argument("--profiles", type=Path, default=Path("data/profiles"))
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument(
        "--append-day",
        type=str,
        default=None,
        help="Generate one day of orders into --out, using the catalog in --catalog.",
    )
    ap.add_argument(
        "--catalog",
        type=Path,
        default=Path("data/out"),
        help="A previous full run, read for item and customer ids when appending.",
    )
    ap.add_argument("--seed", type=int, default=42)

    return ap.parse_args()


def appended_day(ids: Ids, day: date) -> list[date]:
    """10,000 ids per day, counted from 2025-01-01, clears the backfill's ids."""
    offset = (day - date(2025, 1, 1)).days * 10_000

    for f in ("order", "order_item", "payment"):
        setattr(ids, f, offset + 1)

    return [day]


def backfill_days(months: int) -> list[date]:
    end = date.today()

    return [end - timedelta(days=i) for i in range(months * 30, 0, -1)]


def catalog_for_append(profile: dict, args: argparse.Namespace, day: date):
    # Seeded by day as well, or every appended day would replay the same
    # random stream and look alike.
    rng = np.random.default_rng(args.seed + profile["id"] + day.toordinal())
    pools, pool_p = read_catalog(profile, args.catalog)

    return rng, pools, pool_p, read_customer_ids(profile, args.catalog)


def catalog_for_backfill(profile: dict, args: argparse.Namespace, ids: Ids, w: Writer, mw):
    rng = np.random.default_rng(args.seed + profile["id"])
    mw.writerow([profile[k] for k in ("id", "name", "cuisine", "timezone", "opened_at")])
    pools, pool_p = build_catalog(profile, ids, rng, w)
    customers = build_customers(
        profile,
        ids,
        rng,
        w,
        datetime.now(ZoneInfo(profile["timezone"])) - timedelta(days=365),
        size=min(5000, profile["customers"]["directory_size"] // 20),
    )

    return rng, pools, pool_p, customers


def main() -> None:
    args = parse_args()
    append = args.append_day is not None
    w = Writer(args.out)
    ids = Ids()

    if append:
        day = date.fromisoformat(args.append_day)
        days = appended_day(ids, day)
    else:
        days = backfill_days(args.months)
        mw = w.table("merchants", ["id", "name", "cuisine", "timezone", "opened_at"])

    for path in sorted(args.profiles.glob("merchant_*.json")):
        profile = json.loads(path.read_text())

        if append:
            rng, pools, pool_p, customers = catalog_for_append(profile, args, day)
        else:
            rng, pools, pool_p, customers = catalog_for_backfill(profile, args, ids, w, mw)
        generate_orders(profile, ids, rng, w, days, pools, pool_p, customers)
        print(f"  {path.name}: {len(days)} days")
    w.close()
    (args.out / "load.sql").write_text(APPEND_SQL if append else LOAD_SQL)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
