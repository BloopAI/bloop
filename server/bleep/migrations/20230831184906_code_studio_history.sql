ALTER TABLE studios RENAME TO studios_old;

CREATE TABLE studios (
    id BLOB NOT NULL,
    name TEXT NOT NULL,

    PRIMARY KEY (id)
);

CREATE TABLE studio_snapshots (
    id INTEGER PRIMARY KEY,
    studio_id BLOB NOT NULL,

    modified_at DATETIME NOT NULL DEFAULT (datetime('now')),

    -- JSON serialized fields
    context TEXT NOT NULL,
    messages TEXT NOT NULL,

    FOREIGN KEY(studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

INSERT INTO studios(id, name)
SELECT id, name
FROM studios_old;

INSERT INTO studio_snapshots(studio_id, modified_at, context, messages)
SELECT id, modified_at, context, messages
FROM studios_old; 

DROP TABLE studios_old;
