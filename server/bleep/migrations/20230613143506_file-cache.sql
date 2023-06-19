-- Add migration script here
CREATE TABLE file_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_ref TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content_hash TEXT NOT NULL,

    -- JSON
    branches TEXT NOT NULL
);
