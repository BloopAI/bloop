CREATE TABLE docs (
    id INTEGER PRIMARY KEY,

    url TEXT NOT NULL,

    name TEXT,
    favicon TEXT,
    description TEXT,

    modified_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE studio_snapshots ADD COLUMN doc_context TEXT NOT NULL;
