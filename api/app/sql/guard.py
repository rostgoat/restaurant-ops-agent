"""
Checks the SQL the model wrote before any of it reaches the database.

Three rules:

1. Read the query as a parse tree, not as text. Searching the text for "DROP"
   is easy to slip past with a comment or odd capitalisation. Reading the
   structure is not.

2. Reading only. Anything that writes, deletes, or changes the database is
   refused, including when it is buried inside a larger query.

3. Add the restaurant filter here rather than trusting the query to have one.
   Every table the query reads is swapped for a version already narrowed to
   one restaurant:

       FROM orders  ->  FROM (SELECT * FROM orders WHERE merchant_id = 1) orders

   Doing it by swapping means a query cannot escape through a join or a
   nested query, which is what happens if you only bolt a filter onto the end.

Nothing here calls the model or the network, so the same query always gets the
same verdict.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import sqlglot
from sqlglot import exp

DIALECT = "postgres"

# Tables the agent may read, mapped to the column carrying the tenant id.
TENANT_COLUMN: dict[str, str] = {
    "merchants": "id",
    "categories": "merchant_id",
    "items": "merchant_id",
    "customers": "merchant_id",
    "orders": "merchant_id",
    "order_items": "merchant_id",
    "payments": "merchant_id",
}

# The application's own tables. The agent never reads these, so they are absent
# from TENANT_COLUMN and therefore rejected by the allowlist.
ALLOWED_TABLES = frozenset(TENANT_COLUMN)

# Resolved by name because sqlglot renames these between versions. A name it
# does not have is a construct it cannot parse, so nothing is lost by skipping.
FORBIDDEN_NODE_NAMES = (
    "Insert", "Update", "Delete", "Drop", "Create", "Alter",
    "TruncateTable", "Truncate", "Grant", "Merge", "Command",
)
FORBIDDEN_NODES = tuple(
    node
    for node in (getattr(exp, name, None) for name in FORBIDDEN_NODE_NAMES)
    if isinstance(node, type) and issubclass(node, exp.Expression)
)

# Functions that read the filesystem, reach the network, or escalate.
FORBIDDEN_FUNCTIONS = frozenset(
    {
        "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "pg_stat_file",
        "lo_import", "lo_export", "dblink", "dblink_exec", "pg_sleep",
        "pg_terminate_backend", "pg_cancel_backend", "copy", "pg_logdir_ls",
        "query_to_xml", "set_config", "current_setting",
    }
)

FORBIDDEN_SCHEMAS = frozenset({"pg_catalog", "information_schema", "pg_temp"})

DEFAULT_ROW_LIMIT = 500


@dataclass
class Check:
    """One deterministic check, recorded so the trace can show what ran."""

    name: str
    passed: bool
    detail: str | None = None


@dataclass
class GuardResult:
    ok: bool
    sql: str | None = None
    reason: str | None = None
    checks: list[Check] = field(default_factory=list)

    @property
    def blocked_by(self) -> str | None:
        for c in self.checks:
            if not c.passed:
                return c.name
        return None


class _Blocked(Exception):
    def __init__(self, check: str, reason: str):
        self.check = check
        self.reason = reason
        super().__init__(reason)


def guard(
    sql: str,
    merchant_id: int,
    *,
    row_limit: int = DEFAULT_ROW_LIMIT,
    allowed_tables: frozenset[str] = ALLOWED_TABLES,
) -> GuardResult:
    """Validate and rewrite model-generated SQL. Never raises."""
    checks: list[Check] = []

    def ok(name: str, detail: str | None = None) -> None:
        checks.append(Check(name, True, detail))

    try:
        tree = _parse_single(sql, ok)
        _reject_forbidden_statements(tree, ok)
        _reject_forbidden_functions(tree, ok)
        _collect_tables(tree, allowed_tables, ok)
        tree = _scope_to_tenant(tree, merchant_id, ok)
        tree = _apply_limit(tree, row_limit, ok)
    except _Blocked as b:
        checks.append(Check(b.check, False, b.reason))
        return GuardResult(ok=False, reason=b.reason, checks=checks)

    return GuardResult(ok=True, sql=tree.sql(dialect=DIALECT), checks=checks)


# --------------------------------------------------------------------- checks


def _parse_single(sql: str, ok) -> exp.Expression:
    try:
        statements = sqlglot.parse(sql, read=DIALECT)
    except Exception as e:  # sqlglot raises several parse error types
        raise _Blocked("parses", f"not valid SQL: {e}") from e

    statements = [s for s in statements if s is not None]
    if len(statements) == 0:
        raise _Blocked("parses", "empty statement")
    if len(statements) > 1:
        raise _Blocked(
            "single statement",
            f"{len(statements)} statements; only one is allowed",
        )
    ok("parses")
    ok("single statement")

    tree = statements[0]
    # A SELECT may be wrapped in WITH or combined with UNION / EXCEPT.
    if not isinstance(tree, exp.Select | exp.Union | exp.Except | exp.Intersect | exp.Subquery):
        raise _Blocked("select only", f"{type(tree).__name__.lower()} is not a SELECT")
    ok("select only")
    return tree


def _reject_forbidden_statements(tree: exp.Expression, ok) -> None:
    for node_type in FORBIDDEN_NODES:
        found = tree.find(node_type)
        if found is not None:
            raise _Blocked(
                "no writes",
                f"{node_type.__name__.lower()} is not permitted",
            )
    # `SELECT ... INTO new_table` writes despite being a SELECT.
    if tree.find(exp.Into) is not None:
        raise _Blocked("no writes", "select into is not permitted")
    ok("no writes")


def _reject_forbidden_functions(tree: exp.Expression, ok) -> None:
    for node in tree.find_all(exp.Anonymous, exp.Func):
        name = (node.sql_name() or "").lower()
        if isinstance(node, exp.Anonymous):
            name = str(node.this).lower()
        if name in FORBIDDEN_FUNCTIONS:
            raise _Blocked("no unsafe functions", f"{name}() is not permitted")
    ok("no unsafe functions")


def _collect_tables(tree: exp.Expression, allowed: frozenset[str], ok) -> set[str]:
    """Table names actually read, excluding CTE aliases defined in this query."""
    cte_names = {
        cte.alias_or_name.lower()
        for cte in tree.find_all(exp.CTE)
        if cte.alias_or_name
    }

    seen: set[str] = set()
    for table in tree.find_all(exp.Table):
        name = (table.name or "").lower()
        schema = (table.db or "").lower()
        if schema in FORBIDDEN_SCHEMAS:
            raise _Blocked("allowed tables", f"schema {schema} is not readable")
        if not name or name in cte_names:
            continue
        if name not in allowed:
            raise _Blocked(
                "allowed tables",
                f"table {name!r} is not readable; allowed: "
                + ", ".join(sorted(allowed)),
            )
        seen.add(name)

    if not seen:
        raise _Blocked("allowed tables", "query reads no permitted table")
    ok("allowed tables", ", ".join(sorted(seen)))
    return seen


def _scope_to_tenant(tree: exp.Expression, merchant_id: int, ok) -> exp.Expression:
    """Replace each tenant-scoped table with a pre-filtered subquery."""
    if not isinstance(merchant_id, int) or merchant_id <= 0:
        raise _Blocked("tenant scope", "merchant id must be a positive integer")

    cte_names = {
        cte.alias_or_name.lower()
        for cte in tree.find_all(exp.CTE)
        if cte.alias_or_name
    }
    rewritten: list[str] = []

    def rewrite(node: exp.Expression) -> exp.Expression:
        if not isinstance(node, exp.Table):
            return node
        name = (node.name or "").lower()
        if name in cte_names or name not in TENANT_COLUMN:
            return node
        # Already inside a scoping subquery this function produced.
        if node.find_ancestor(exp.Subquery) is not None and node.meta.get("scoped"):
            return node

        column = TENANT_COLUMN[name]
        alias = node.alias_or_name or name
        inner = exp.select("*").from_(exp.table_(name)).where(
            exp.condition(f"{column} = {merchant_id}")
        )
        inner.meta["scoped"] = True
        rewritten.append(f"{name}.{column}")
        return exp.Subquery(this=inner, alias=exp.TableAlias(this=exp.to_identifier(alias)))

    scoped = tree.transform(rewrite, copy=True)
    if not rewritten:
        raise _Blocked("tenant scope", "no tenant-scoped table to filter")
    ok("tenant scope", f"merchant_id={merchant_id} on " + ", ".join(sorted(set(rewritten))))
    return scoped


def _apply_limit(tree: exp.Expression, row_limit: int, ok) -> exp.Expression:
    existing = tree.args.get("limit")
    if existing is not None:
        try:
            current = int(existing.expression.this)
        except (AttributeError, TypeError, ValueError):
            current = row_limit + 1
        if current <= row_limit:
            ok("row limit", f"query limit {current}")
            return tree
        ok("row limit", f"lowered {current} to {row_limit}")
        return tree.limit(row_limit, copy=True)
    ok("row limit", f"injected {row_limit}")
    return tree.limit(row_limit, copy=True)
