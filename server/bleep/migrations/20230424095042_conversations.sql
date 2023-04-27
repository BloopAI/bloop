CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    repo_ref TEXT NOT NULL,
    -- JSON array of strings
    path_aliases TEXT NOT NULL
);

CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations (id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL
);
