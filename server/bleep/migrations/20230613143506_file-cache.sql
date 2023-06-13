-- Add migration script here
CREATE TABLE file_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_ref TEXT NOT NULL,
    file_name TEXT NOT NULL,
    hash TEXT NOT NULL,

    -- JSON
    branches TEXT NOT NULL
);
