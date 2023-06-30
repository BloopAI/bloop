CREATE TABLE query_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME NOT NULL default (datetime('now')),
    raw_query TEXT NOT NULL
);
