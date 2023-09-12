ALTER TABLE studios RENAME TO studios_old;
ALTER TABLE studio_snapshots RENAME TO studio_snapshots_old;

-- Identical to before, except we allow `name` to be null.
CREATE TABLE studios (
    id INTEGER PRIMARY KEY,
    name TEXT,
    user_id TEXT NOT NULL
);

CREATE TABLE studio_snapshots (
    id INTEGER PRIMARY KEY,
    studio_id INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,

    modified_at DATETIME NOT NULL DEFAULT (datetime('now')),

    -- JSON serialized fields
    context TEXT NOT NULL,
    messages TEXT NOT NULL
);

INSERT INTO studios(id, name, user_id)
SELECT id, name, user_id
FROM studios_old;

INSERT INTO studio_snapshots(id, studio_id, modified_at, context, messages)
SELECT id, studio_id, modified_at, context, messages
FROM studio_snapshots_old;

DROP TABLE studio_snapshots_old;
DROP TABLE studios_old;
