CREATE TABLE studios (
    -- UUID
    id TEXT NOT NULL,

    name TEXT NOT NULL,
    modified_at DATETIME NOT NULL DEFAULT (datetime('now')),

    -- JSON serialized fields
    context TEXT NOT NULL,
    messages TEXT NOT NULL
);
