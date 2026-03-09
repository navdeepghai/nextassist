from nextassist.database.pool import get_cursor

_TABLES_SQL = """
-- Sessions
CREATE TABLE IF NOT EXISTS na_session (
    id              VARCHAR(20) PRIMARY KEY,
    title           VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    user_email      VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Limit Reached', 'Archived')),
    last_message_at TIMESTAMPTZ,
    provider        VARCHAR(255),
    model           VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS na_message (
    id            VARCHAR(20) PRIMARY KEY,
    session_id    VARCHAR(20) NOT NULL REFERENCES na_session(id) ON DELETE CASCADE,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content       TEXT,
    provider      VARCHAR(255),
    model         VARCHAR(255),
    token_count   INTEGER NOT NULL DEFAULT 0,
    is_error      BOOLEAN NOT NULL DEFAULT FALSE,
    tool_call_id  VARCHAR(255),
    tool_calls    JSONB,
    attachments   JSONB DEFAULT '[]'::jsonb,
    metadata      JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Providers
CREATE TABLE IF NOT EXISTS na_ai_provider (
    provider_name        VARCHAR(255) PRIMARY KEY,
    provider_type        VARCHAR(50) NOT NULL CHECK (provider_type IN ('OpenAI', 'Anthropic', 'Google')),
    enabled              BOOLEAN NOT NULL DEFAULT TRUE,
    is_default           BOOLEAN NOT NULL DEFAULT FALSE,
    api_key_encrypted    TEXT NOT NULL,
    api_base_url         VARCHAR(500),
    organization_id      VARCHAR(255),
    default_model        VARCHAR(255),
    max_tokens           INTEGER NOT NULL DEFAULT 4096,
    temperature          REAL NOT NULL DEFAULT 0.7,
    max_context_messages INTEGER NOT NULL DEFAULT 20,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Settings (singleton — max 1 row)
CREATE TABLE IF NOT EXISTS na_settings (
    id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    default_provider    VARCHAR(255),
    enable_tool_calling BOOLEAN NOT NULL DEFAULT TRUE,
    enable_file_uploads BOOLEAN NOT NULL DEFAULT TRUE,
    modified_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tools (parameters embedded as JSONB)
CREATE TABLE IF NOT EXISTS na_tool (
    tool_name             VARCHAR(255) PRIMARY KEY,
    tool_type             VARCHAR(50) NOT NULL,
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    requires_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
    description           TEXT NOT NULL,
    reference_doctype     VARCHAR(255),
    function_path         TEXT,
    parameters            JSONB DEFAULT '[]'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Schedulers (recurring automated tasks)
CREATE TABLE IF NOT EXISTS na_scheduler (
    id                VARCHAR(20) PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    user_email        VARCHAR(255) NOT NULL,
    session_id        VARCHAR(20) REFERENCES na_session(id) ON DELETE SET NULL,
    enabled           BOOLEAN NOT NULL DEFAULT TRUE,
    status            VARCHAR(20) NOT NULL DEFAULT 'Active'
                      CHECK (status IN ('Active', 'Paused', 'Error', 'Completed')),
    cron_expression   VARCHAR(100) NOT NULL DEFAULT '0 9 * * *',
    next_run_at       TIMESTAMPTZ,
    query_doctype     VARCHAR(255) NOT NULL,
    query_filters     JSONB DEFAULT '{}'::jsonb,
    query_fields      JSONB DEFAULT '["name"]'::jsonb,
    query_condition   TEXT,
    action_type       VARCHAR(20) NOT NULL DEFAULT 'email'
                      CHECK (action_type IN ('email', 'notification', 'webhook', 'custom_code')),
    action_config     JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_runs        INTEGER NOT NULL DEFAULT 0,
    success_runs      INTEGER NOT NULL DEFAULT 0,
    error_runs        INTEGER NOT NULL DEFAULT 0,
    last_run_at       TIMESTAMPTZ,
    last_error        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    modified_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scheduler Runs (execution history)
CREATE TABLE IF NOT EXISTS na_scheduler_run (
    id                VARCHAR(20) PRIMARY KEY,
    scheduler_id      VARCHAR(20) NOT NULL REFERENCES na_scheduler(id) ON DELETE CASCADE,
    status            VARCHAR(20) NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running', 'success', 'error', 'skipped')),
    started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ,
    duration_ms       INTEGER,
    matched_count     INTEGER NOT NULL DEFAULT 0,
    actioned_count    INTEGER NOT NULL DEFAULT 0,
    error             TEXT,
    result_data       JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

_INDEXES_SQL = """
CREATE INDEX IF NOT EXISTS idx_session_user_status ON na_session (user_email, status);
CREATE INDEX IF NOT EXISTS idx_session_modified ON na_session (modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_session_created ON na_message (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_session_role ON na_message (session_id, role);
CREATE INDEX IF NOT EXISTS idx_scheduler_user_status ON na_scheduler (user_email, status);
CREATE INDEX IF NOT EXISTS idx_scheduler_enabled_next ON na_scheduler (next_run_at) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduler_run_scheduler ON na_scheduler_run (scheduler_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_run_status ON na_scheduler_run (scheduler_id, status);
CREATE INDEX IF NOT EXISTS idx_session_provider ON na_session (provider);
"""


def ensure_schema():
	"""Create all tables and indexes if they don't exist. Idempotent."""
	with get_cursor() as cur:
		cur.execute(_TABLES_SQL)
		cur.execute(_INDEXES_SQL)
