import threading
from contextlib import contextmanager

import frappe
import psycopg2
import psycopg2.extras
from psycopg2 import pool as pg_pool

_pools: dict[str, pg_pool.ThreadedConnectionPool] = {}
_lock = threading.Lock()


def _get_pool() -> pg_pool.ThreadedConnectionPool:
	"""Get or create the connection pool for the current site."""
	site = frappe.local.site
	if site not in _pools:
		with _lock:
			if site not in _pools:
				config = frappe.conf.get("nextassist_pg", {})
				_pools[site] = pg_pool.ThreadedConnectionPool(
					minconn=config.get("min_connections", 2),
					maxconn=config.get("max_connections", 10),
					host=config.get("host", "127.0.0.1"),
					port=config.get("port", 5455),
					database=config.get("database", "nextassist"),
					user=config.get("user", "nextassist"),
					password=config.get("password", ""),
				)
	return _pools[site]


@contextmanager
def get_connection():
	"""Yield a PG connection. Auto-commits on success, rolls back on exception."""
	p = _get_pool()
	conn = p.getconn()
	try:
		yield conn
		conn.commit()
	except Exception:
		conn.rollback()
		raise
	finally:
		p.putconn(conn)


@contextmanager
def get_cursor():
	"""Yield a RealDictCursor inside a managed connection. Auto-commits on success."""
	with get_connection() as conn:
		with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
			yield cur


def test_connection() -> bool:
	"""Verify PostgreSQL is reachable. Returns True on success."""
	with get_cursor() as cur:
		cur.execute("SELECT 1 AS ok")
		row = cur.fetchone()
		return row and row["ok"] == 1
