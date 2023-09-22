CREATE TABLE docs (
    id INTEGER PRIMARY KEY,

    name TEXT NOT NULL,
    url TEXT NOT NULL,

    modified_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE studio_snapshots ADD COLUMN doc_context TEXT NOT NULL;
