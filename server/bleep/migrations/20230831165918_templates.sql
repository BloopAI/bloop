CREATE TABLE templates (
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    modified_at DATETIME NOT NULL DEFAULT (datetime('now')),
    content TEXT NOT NULL
);