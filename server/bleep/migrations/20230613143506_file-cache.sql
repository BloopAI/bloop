-- Add migration script here
CREATE TABLE file_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_ref TEXT NOT NULL,
    cache_hash TEXT NOT NULL
);
