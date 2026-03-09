# NextAssist

AI Chatbot Assistant for Frappe — multi-provider chat with tool calling, code execution, charts, schedulers, and more.

## Prerequisites

- Python 3.14+
- Node.js 18+
- PostgreSQL 14+
- Frappe Bench v15+

## Installation

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/user/nextassist --branch main
bench install-app nextassist
```

The `bench install-app` command automatically creates the PostgreSQL schema and default settings via the `after_install` hook.

## PostgreSQL Setup

NextAssist uses a dedicated PostgreSQL database (separate from Frappe's MariaDB/Postgres).

### 1. Create the database

```sql
CREATE USER nextassist WITH PASSWORD 'your_secure_password';
CREATE DATABASE nextassist OWNER nextassist;
```

### 2. Configure the connection

Add the `nextassist_pg` block to your site's `site_config.json`:

```json
{
  "nextassist_pg": {
    "host": "127.0.0.1",
    "port": 5432,
    "database": "nextassist",
    "user": "nextassist",
    "password": "your_secure_password",
    "min_connections": 2,
    "max_connections": 10
  }
}
```

### 3. Sync the schema

If you need to manually create or update tables and indexes:

```bash
bench --site your-site.local execute nextassist.database.schema.ensure_schema
```

This is idempotent — safe to run multiple times. It uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.

## Frontend Development

```bash
cd apps/nextassist/frontend

# Install dependencies
yarn install

# Start dev server with hot reload
yarn dev

# Production build
yarn build
```

The production build outputs to `nextassist/public/nextassist/` and is served by Frappe.

## Pre-commit Hooks

This project uses `pre-commit` for code quality. Install it once:

```bash
cd apps/nextassist
pre-commit install
```

Tools configured:
- **ruff** — Python linting, import sorting, formatting
- **eslint** — JavaScript linting
- **prettier** — JavaScript/SCSS formatting
- **pyupgrade** — Python syntax upgrades

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.14, Frappe Framework |
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Database | PostgreSQL (psycopg2, connection pooling) |
| AI Providers | OpenAI, Anthropic, Google Gemini |
| Charts | Frappe Charts |
| Markdown | react-markdown + remark-gfm |

## User Guide

See [docs/user-guide.md](docs/user-guide.md) for the full user guide, also available at `/nextassist/userguide` on your site.

## License

MIT
