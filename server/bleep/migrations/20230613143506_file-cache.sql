-- Add migration script here
CREATE TABLE file_cache (
    cache_hash TEXT PRIMARY KEY NOT NULL,
    repo_ref TEXT NOT NULL
);

CREATE TABLE chunk_cache (
    chunk_hash TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    branches TEXT NOT NULL,
    repo_ref TEXT NOT NULL
);
