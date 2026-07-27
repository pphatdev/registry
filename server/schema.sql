CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    anon_id TEXT NOT NULL,
    alias TEXT NOT NULL,
    command TEXT NOT NULL,
    version TEXT NOT NULL,
    os TEXT,
    node TEXT,
    success INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS event_names (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ts TEXT NOT NULL,
    anon_id TEXT NOT NULL,
    day TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_command ON events(command);
CREATE INDEX IF NOT EXISTS idx_names_lookup ON event_names(kind, ts, name);

-- One anonymous user contributes at most one row per (kind, name, day).
-- This prevents heavy users from skewing the popularity counts.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_names_daily ON event_names(anon_id, kind, name, day);
