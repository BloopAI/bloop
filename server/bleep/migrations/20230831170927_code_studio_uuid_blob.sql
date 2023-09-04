-- We re-create `studios`, with the `id` type as `BLOB` this time.

DROP TABLE studios;
CREATE TABLE studios (
    -- UUID
    id BLOB NOT NULL,

    name TEXT NOT NULL,
    modified_at DATETIME NOT NULL DEFAULT (datetime('now')),

    -- JSON serialized fields
    context TEXT NOT NULL,
    messages TEXT NOT NULL
);
