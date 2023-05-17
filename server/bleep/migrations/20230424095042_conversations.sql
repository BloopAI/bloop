CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    repo_ref TEXT NOT NULL,
    title TEXT NOT NULL,

    -- JSON serialized fields
    exchanges TEXT NOT NULL,
    llm_history TEXT NOT NULL,
    path_aliases TEXT NOT NULL,
    code_chunks TEXT NOT NULL,
    commits TEXT NOT NULL
);
