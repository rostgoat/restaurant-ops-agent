#!/usr/bin/env python3
"""
Generate the synthetic point-of-sale dataset from the merchant profiles.

    python data/generate.py --out data/out --months 12 --seed 42
    python data/generate.py --out data/out --append-day 2026-10-20 --seed 42

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
    def __init__(self, out: Path, append: bool):
        out.mkdir(parents=True, exist_ok=True)
        self._files: dict[str, csv.writer] = {}
        self._handles = []
        self._out = out
        self._mode = "a" if append else "w"

    def table(self, name: str, header: list[str]):
        if name not in self._files:
            path = self._out / f"{name}.csv"
            new = self._mode == "w" or not path.exists()
            fh = open(path, self._mode, newline="")
            self._handles.append(fh)
            w = csv.writer(fh)
            if new:
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
        prices = np.maximum(
            25, from_percentiles(rng, spec["price_cents"], count).round(-1)
        ).astype(int)
        item_ids = []
        for i, price in enumerate(prices, start=1):
            iid = ids.take("item")
            item_ids.append(iid)
            item_w.writerow(
                [iid, profile["id"], cid, f"{spec['name']} {i}", int(price), "true"]
            )
        pools.append((float(spec["line_share"]), np.array(item_ids), prices))
    shares = np.array([p[0] for p in pools])
    return pools, shares / shares.sum()


def build_customers(profile: dict, ids: Ids, rng: np.random.Generator, w: Writer,
                    start: datetime, size: int) -> np.ndarray:
    c = profile["customers"]
    cw = w.table(
        "customers",
        [
            "id", "merchant_id", "first_seen_at", "has_email", "has_phone",
            "email_opt_in", "sms_opt_in", "sms_implied_consent", "unsubscribed_at",
        ],
    )
    ids_out = []
    span_days = 365
    for _ in range(size):
        cid = ids.take("customer")
        ids_out.append(cid)
        seen = start + timedelta(days=float(rng.random() * span_days))
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
                "",
            ]
        )
    return np.array(ids_out)


def generate_orders(profile: dict, ids: Ids, rng: np.random.Generator, w: Writer,
                    days: list[date], pools, pool_p, customer_ids: np.ndarray):
    tz = ZoneInfo(profile["timezone"])
    mid = profile["id"]
    hour_w = np.array(profile["hour_of_day_weights"], dtype=float)
    hour_p = hour_w / hour_w.sum()
    dow_w = profile["day_of_week_weights"]
    dow_mult = profile["day_of_week_value_multiplier"]
    dp_mult = profile["daypart_value_multiplier"]
    channels = profile["channels"]
    ch_names = list(channels)
    ch_p = np.array([channels[c]["share"] for c in ch_names])
    ch_p = ch_p / ch_p.sum()
    tax_rate = profile["tax_rate_bps"] / 10_000
    disc = profile["discount"]
    state_mix = profile["order_state_mix"]

    ow = w.table(
        "orders",
        [
            "id", "merchant_id", "customer_id", "created_at", "channel", "source_raw",
            "fulfillment_type", "state", "item_count", "gross_sales_cents",
            "discount_cents", "tax_cents", "tip_cents", "total_cents",
        ],
    )
    oiw = w.table(
        "order_items",
        ["id", "merchant_id", "order_id", "item_id", "quantity", "unit_price_cents", "total_cents"],
    )
    pw = w.table(
        "payments",
        [
            "id", "order_id", "merchant_id", "created_at", "amount_cents", "tip_cents",
            "processing_fee_cents", "refunded_amount_cents", "card_brand",
            "entry_method", "status",
        ],
    )

    per_month = profile["orders_per_month"]
    dow_total = sum(dow_w.values())
    pay = profile["payments"]

    for day in days:
        dname = DOW[day.weekday()]
        # orders_per_month spread over 52 weeks, then split by weekday weight.
        share = dow_w[dname] / dow_total
        expected = per_month * 12 * share / 52.0
        n = int(rng.poisson(max(0.1, expected)))
        if n == 0:
            continue

        hours = rng.choice(24, size=n, p=hour_p)
        chans = pick(rng, {c: channels[c]["share"] for c in ch_names}, n)
        baskets = np.maximum(
            1, from_percentiles(rng, profile["basket_size"], n).round()
        ).astype(int)

        for k in range(n):
            ch = channels[chans[k]]
            hour = int(hours[k])
            dp = daypart_of(hour)
            created = datetime(
                day.year, day.month, day.day, hour,
                int(rng.integers(0, 60)), int(rng.integers(0, 60)), tzinfo=tz,
            )

            size = int(baskets[k])
            if "basket_size_override" in ch:
                size = max(
                    1,
                    int(from_percentiles(rng, ch["basket_size_override"], 1)[0]),
                )
            # Moves ticket value, not basket size.
            occasion = dp_mult.get(dp, 1.0) * dow_mult.get(dname, 1.0)

            oid = ids.take("order")
            gross = 0
            lines = []
            for _ in range(size):
                pi = rng.choice(len(pools), p=pool_p)
                _, item_ids, prices = pools[pi]
                j = int(rng.integers(0, len(item_ids)))
                qty = 1 if rng.random() > 0.08 else 2
                # The markup lives on unit price, which is how marketplaces
                # actually price, so basket size stays flat across channels.
                unit = int(round(prices[j] * ch["value_multiplier"] * occasion))
                lines.append((int(item_ids[j]), qty, unit, unit * qty))
                gross += unit * qty

            discount = 0
            if rng.random() < disc["attach_rate"]:
                rate = float(from_percentiles(rng, disc["rate_pct"], 1)[0]) / 100
                discount = min(gross, int(round(gross * min(1.0, rate))))

            taxable = gross - discount
            tax = int(round(taxable * tax_rate))
            tip = ""
            tip_int = 0
            if ch["tips"] and rng.random() < ch.get("tip_attach_rate", 0.0):
                rate = float(from_percentiles(rng, profile["tip_rate_pct"], 1)[0]) / 100
                tip_int = int(round(gross * rate))
                tip = str(tip_int)
            total = taxable + tax + tip_int

            state = pick(rng, state_mix, 1)[0]
            fulfil = pick(rng, ch["fulfillment"], 1)[0]
            raw = ch["source_raw"][int(rng.integers(0, len(ch["source_raw"])))]
            cust = ""
            if len(customer_ids) and rng.random() < profile["customers"]["identified_order_rate"]:
                cust = str(int(rng.choice(customer_ids)))

            ow.writerow(
                [
                    oid, mid, cust, created.isoformat(), chans[k],
                    raw if raw is not None else "", fulfil, state, size,
                    gross, discount, tax, tip, total,
                ]
            )
            for item_id, qty, unit, line_total in lines:
                oiw.writerow(
                    [ids.take("order_item"), mid, oid, item_id, qty, unit, line_total]
                )

            if state == "completed":
                failed = rng.random() < pay["failure_rate"]
                refunded = 0 if failed else (
                    total if rng.random() < pay["refund_rate"] else 0
                )
                fee_rate = float(
                    from_percentiles(rng, pay["processing_fee_rate_pct"], 1)[0]
                ) / 100
                brand = pick(rng, pay["card_brand_mix"], 1)[0]
                entry = pick(rng, pay["entry_method_mix"], 1)[0]
                pw.writerow(
                    [
                        ids.take("payment"), oid, mid, created.isoformat(), total,
                        tip, int(round(total * fee_rate)), refunded,
                        "" if chans[k] in ("doordash", "uber_eats", "grubhub") else brand,
                        "" if chans[k] in ("doordash", "uber_eats", "grubhub") else entry,
                        "failed" if failed else "completed",
                    ]
                )


LOAD_SQL = """-- Generated by data/generate.py. Run against a database created with schema.sql.
\\copy merchants    FROM 'merchants.csv'    CSV HEADER
\\copy categories   FROM 'categories.csv'   CSV HEADER
\\copy items        FROM 'items.csv'        CSV HEADER
\\copy customers    FROM 'customers.csv'    CSV HEADER
\\copy orders       FROM 'orders.csv'       CSV HEADER
\\copy order_items  FROM 'order_items.csv'  CSV HEADER
\\copy payments     FROM 'payments.csv'     CSV HEADER
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path("data/out"))
    ap.add_argument("--profiles", type=Path, default=Path("data/profiles"))
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--append-day", type=str, default=None,
                    help="Generate a single day and append, for the nightly refresh.")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    append = args.append_day is not None
    w = Writer(args.out, append=append)
    ids = Ids()
    if append:
        # 10,000 ids per day, counted from 2025-01-01, clears the backfill's ids.
        day = date.fromisoformat(args.append_day)
        offset = (day - date(2025, 1, 1)).days * 10_000
        for f in ("order", "order_item", "payment", "customer", "item", "category"):
            setattr(ids, f, offset + 1)
        days = [day]
    else:
        end = date.today()
        days = [end - timedelta(days=i) for i in range(args.months * 30, 0, -1)]

    mw = w.table("merchants", ["id", "name", "cuisine", "timezone", "opened_at"])
    for path in sorted(args.profiles.glob("merchant_*.json")):
        profile = json.loads(path.read_text())
        rng = np.random.default_rng(args.seed + profile["id"])
        if not append:
            mw.writerow(
                [
                    profile["id"], profile["name"], profile["cuisine"],
                    profile["timezone"], profile["opened_at"],
                ]
            )
        pools, pool_p = (
            build_catalog(profile, ids, rng, w) if not append else (None, None)
        )
        customers = (
            build_customers(
                profile, ids, rng, w,
                datetime.now(ZoneInfo(profile["timezone"])) - timedelta(days=365),
                size=min(5000, profile["customers"]["directory_size"] // 20),
            )
            if not append
            else np.array([], dtype=int)
        )
        if pools is None:
            raise SystemExit(
                "--append-day needs catalog ids from a prior full run; not yet wired."
            )
        generate_orders(profile, ids, rng, w, days, pools, pool_p, customers)
        print(f"  {path.name}: {len(days)} days")

    w.close()
    (args.out / "load.sql").write_text(LOAD_SQL)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
