DROP TABLE studios;
DROP TABLE studio_snapshots;

-- Identical to before, except we change the primary key to be of type `INTEGER`.
CREATE TABLE studios (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT NOT NULL
);

-- Identical to before, except we change the `studio_id` column to be of type `INTEGER`.
CREATE TABLE studio_snapshots (
    id INTEGER PRIMARY KEY,
    studio_id INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,

    modified_at DATETIME NOT NULL DEFAULT (datetime('now')),

    -- JSON serialized fields
    context TEXT NOT NULL,
    messages TEXT NOT NULL
);
