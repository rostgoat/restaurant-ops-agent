"""
Tests for the enforcement layer.

Grouped by what they prove rather than by function, because the point of the
suite is the claim "a bad model decision cannot become a bad query", and each
group is one way that claim could fail.
"""
from __future__ import annotations

import pytest

from app.sql.guard import ALLOWED_TABLES, guard

MERCHANT = 1
OTHER = 2


def run(sql: str, merchant_id: int = MERCHANT, **kw):
    return guard(sql, merchant_id, **kw)


def norm(sql: str) -> str:
    return " ".join(sql.lower().split())


# ----------------------------------------------------------- it runs at all


def test_simple_select_passes_and_is_rewritten():
    r = run("SELECT count(*) FROM orders")
    assert r.ok, r.reason
    assert "merchant_id = 1" in norm(r.sql)
    assert "limit 500" in norm(r.sql)


def test_every_check_is_recorded_for_the_trace():
    r = run("SELECT count(*) FROM orders")
    names = [c.name for c in r.checks]
    assert names == [
        "parses",
        "single statement",
        "select only",
        "no writes",
        "no unsafe functions",
        "allowed tables",
        "tenant scope",
        "row limit",
    ]
    assert all(c.passed for c in r.checks)


def test_blocked_result_names_the_failing_check():
    r = run("DELETE FROM orders")
    assert not r.ok
    assert r.blocked_by is not None
    assert r.sql is None


# ------------------------------------------------------------ no writes


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO orders (id) VALUES (1)",
        "UPDATE orders SET total_cents = 0",
        "DELETE FROM orders",
        "DROP TABLE orders",
        "ALTER TABLE orders ADD COLUMN x int",
        "CREATE TABLE evil (id int)",
        "TRUNCATE orders",
    ],
)
def test_write_statements_are_blocked(sql):
    r = run(sql)
    assert not r.ok, f"{sql} was allowed"


def test_select_into_is_blocked_despite_being_a_select():
    r = run("SELECT * INTO exfil FROM orders")
    assert not r.ok
    assert "into" in (r.reason or "").lower()


def test_write_hidden_in_a_cte_is_blocked():
    r = run("WITH x AS (DELETE FROM orders RETURNING id) SELECT * FROM x")
    assert not r.ok


def test_second_statement_is_blocked():
    r = run("SELECT 1 FROM orders; DROP TABLE orders")
    assert not r.ok
    assert r.blocked_by in {"single statement", "parses"}


def test_a_comment_does_not_smuggle_a_write_past_the_parser():
    # The textual check this replaces would see "DROP" and block a valid query,
    # or miss it entirely depending on which way the regex went.
    r = run("SELECT count(*) /* DROP TABLE orders */ FROM orders")
    assert r.ok, r.reason


# ------------------------------------------------------- table allowlist


def test_unknown_table_is_blocked():
    r = run("SELECT * FROM request_traces")
    assert not r.ok
    assert "request_traces" in (r.reason or "")


def test_application_tables_are_not_in_the_allowlist():
    for table in ("request_traces", "trace_steps", "proposals"):
        assert table not in ALLOWED_TABLES


@pytest.mark.parametrize("schema", ["pg_catalog", "information_schema"])
def test_system_schemas_are_blocked(schema):
    r = run(f"SELECT * FROM {schema}.tables")
    assert not r.ok


def test_join_onto_a_forbidden_table_is_blocked():
    r = run(
        "SELECT o.id FROM orders o JOIN request_traces t ON t.merchant_id = o.merchant_id"
    )
    assert not r.ok


# ------------------------------------------------------ unsafe functions


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT pg_read_file('/etc/passwd') FROM orders",
        "SELECT pg_sleep(60) FROM orders",
        "SELECT dblink('x', 'y') FROM orders",
        "SELECT lo_import('/etc/passwd') FROM orders",
    ],
)
def test_unsafe_functions_are_blocked(sql):
    r = run(sql)
    assert not r.ok


def test_ordinary_aggregates_are_allowed():
    r = run("SELECT date_trunc('day', created_at), sum(total_cents) FROM orders GROUP BY 1")
    assert r.ok, r.reason


# --------------------------------------------------------- tenant scoping


def test_scope_is_applied_to_both_sides_of_a_join():
    r = run(
        "SELECT o.id, p.amount_cents FROM orders o "
        "JOIN payments p ON p.order_id = o.id"
    )
    assert r.ok, r.reason
    assert norm(r.sql).count("merchant_id = 1") == 2


def test_scope_is_applied_inside_a_subquery():
    r = run(
        "SELECT id FROM orders WHERE customer_id IN (SELECT id FROM customers)"
    )
    assert r.ok, r.reason
    assert norm(r.sql).count("merchant_id = 1") == 2


def test_scope_is_applied_inside_a_cte():
    r = run("WITH recent AS (SELECT * FROM orders) SELECT count(*) FROM recent")
    assert r.ok, r.reason
    assert "merchant_id = 1" in norm(r.sql)


def test_cte_alias_is_not_treated_as_a_table():
    # `recent` is defined in the query, so it must not trip the allowlist.
    r = run("WITH recent AS (SELECT * FROM orders) SELECT count(*) FROM recent")
    assert r.ok, r.reason


def test_a_query_naming_another_merchant_still_only_sees_its_own():
    # Caller is merchant 1, query asks for merchant 2. The rewrite adds its own
    # filter anyway, so this returns nothing rather than the wrong rows.
    r = run(f"SELECT count(*) FROM orders WHERE merchant_id = {OTHER}")
    assert r.ok, r.reason
    sql = norm(r.sql)
    assert "merchant_id = 1" in sql
    assert f"merchant_id = {OTHER}" in sql


def test_merchants_table_is_scoped_on_its_own_id_column():
    r = run("SELECT name FROM merchants")
    assert r.ok, r.reason
    assert "id = 1" in norm(r.sql)


@pytest.mark.parametrize("bad", [0, -1, "1", None, 1.5])
def test_non_positive_or_non_integer_merchant_id_is_rejected(bad):
    r = guard("SELECT count(*) FROM orders", bad)  # type: ignore[arg-type]
    assert not r.ok
    assert r.blocked_by == "tenant scope"


def test_scope_survives_a_union():
    r = run("SELECT id FROM orders UNION SELECT id FROM payments")
    assert r.ok, r.reason
    assert norm(r.sql).count("merchant_id = 1") == 2


# -------------------------------------------------------------- row limit


def test_limit_is_injected_when_absent():
    r = run("SELECT id FROM orders")
    assert "limit 500" in norm(r.sql)


def test_a_smaller_limit_is_left_alone():
    r = run("SELECT id FROM orders LIMIT 10")
    assert r.ok, r.reason
    assert "limit 10" in norm(r.sql)


def test_an_oversized_limit_is_lowered():
    r = run("SELECT id FROM orders LIMIT 100000")
    assert r.ok, r.reason
    sql = norm(r.sql)
    assert "limit 500" in sql
    assert "100000" not in sql


def test_row_limit_is_configurable():
    r = run("SELECT id FROM orders", row_limit=25)
    assert "limit 25" in norm(r.sql)


# ------------------------------------------------------------ bad input


@pytest.mark.parametrize("sql", ["", "   ", "not sql at all", "SELECT FROM"])
def test_unparseable_input_is_blocked_without_raising(sql):
    r = run(sql)
    assert not r.ok
    assert r.reason


def test_a_select_with_no_table_is_blocked():
    # Nothing to scope, so there is nothing to permit.
    r = run("SELECT 1")
    assert not r.ok
