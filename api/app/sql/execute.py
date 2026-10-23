from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol
from uuid import UUID

import psycopg
from psycopg_pool import ConnectionPool


class QueryError(Exception):
    pass


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[list[Any]]

    def to_payload(self, max_rows: int) -> dict[str, Any]:
        return {
            "columns": self.columns,
            "row_count": len(self.rows),
            "rows": [[json_value(v) for v in row] for row in self.rows[:max_rows]],
            "truncated": len(self.rows) > max_rows,
        }


class QueryRunner(Protocol):
    def run(self, sql: str) -> QueryResult: ...


class PostgresRunner:
    def __init__(self, dsn: str, *, statement_timeout_ms: int = 5000, max_connections: int = 4):
        self._pool = ConnectionPool(dsn, open=False, min_size=0, max_size=max_connections)
        self._timeout_ms = statement_timeout_ms

    def run(self, sql: str) -> QueryResult:
        self._pool.open()
        try:
            with self._pool.connection() as conn:
                conn.read_only = True
                with conn.transaction():
                    conn.execute(
                        "SELECT set_config('statement_timeout', %s, true)",
                        (str(self._timeout_ms),),
                    )
                    cur = conn.execute(sql)
                    columns = [d.name for d in cur.description or []]
                    rows = [list(row) for row in cur.fetchall()]
        except psycopg.Error as e:
            raise QueryError(_message(e)) from e
        return QueryResult(columns, rows)

    def close(self) -> None:
        self._pool.close()


def _message(e: psycopg.Error) -> str:
    diag = getattr(e, "diag", None)
    primary = getattr(diag, "message_primary", None)
    return primary or str(e)


def json_value(value: Any) -> Any:
    if value is None or isinstance(value, bool | int | float | str):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return str(value)
