-- This is a partial migration to migrate to the new `projects` structure. Here, we try to migrate
-- as much of the data as possible. However, we cannot migrate everything as some JSON data has to
-- be directly manipulated, in a way that is difficult with plain SQLite. As a compromise, we create
-- a `rust_migrations` table, and keep track of logical changes there, intended to be applied
-- immediately after all other pending database migrations.

CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT
);

-- First, we have to modify studios & snapshots. This involves recreating the `studios` table, and
-- consequently also the `studio_snapshots` table, as SQLite doesn't allow us to dynamically modify
-- foreign key constraints. So, we instead recreate both tables and copy data as required.

ALTER TABLE studios RENAME TO studios_old;
ALTER TABLE studio_snapshots RENAME TO studio_snapshots_old;

ALTER TABLE studios_old ADD COLUMN project_id INTEGER;
ALTER TABLE projects ADD COLUMN studio_id_tmp INTEGER;

INSERT INTO projects (studio_id_tmp, user_id, name)
SELECT id, user_id, name FROM studios_old;

UPDATE studios_old
SET project_id = (SELECT id FROM projects WHERE projects.studio_id_tmp = studios_old.id);

CREATE TABLE studios (
    id INTEGER PRIMARY KEY,
    name TEXT,
    project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE
);

CREATE TABLE studio_snapshots (
    id INTEGER PRIMARY KEY,
    studio_id INTEGER NOT NULL REFERENCES studios (id) ON DELETE CASCADE,

    modified_at DATETIME NOT NULL DEFAULT (datetime('now')),

    -- JSON serialized fields
    context TEXT NOT NULL,
    messages TEXT NOT NULL,
    doc_context TEXT NOT NULL DEFAULT '[]'
);

INSERT INTO studios (id, name, project_id)
SELECT id, name, project_id FROM studios_old;

INSERT INTO studio_snapshots (id, studio_id, modified_at, context, messages, doc_context)
SELECT id, studio_id, modified_at, context, messages, doc_context FROM studio_snapshots_old;

DROP TABLE studios_old;
DROP TABLE studio_snapshots_old;

ALTER TABLE projects DROP COLUMN studio_id_tmp;

-- Next, we can update the conversations table, following a similar process.

ALTER TABLE conversations RENAME TO conversations_old;
ALTER TABLE conversations_old ADD COLUMN project_id INTEGER;
ALTER TABLE projects ADD COLUMN conversation_id_tmp;

INSERT INTO projects (conversation_id_tmp, user_id, name)
SELECT id, user_id, title FROM conversations_old;

UPDATE conversations_old
SET project_id = (SELECT id FROM projects WHERE projects.conversation_id_tmp = conversations_old.id);

CREATE TABLE conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    thread_id TEXT NOT NULL,
    title TEXT NOT NULL,

    -- JSON serialized fields
    exchanges TEXT NOT NULL
);

INSERT INTO conversations (id, project_id, created_at, thread_id, title, exchanges)
SELECT id, project_id, created_at, thread_id, title, exchanges FROM conversations_old;

-- NB: We keep the `conversations_old` table around briefly, so that we can also create entries in `project_repos`:

CREATE TABLE project_repos (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    repo_ref TEXT NOT NULL,
    branch TEXT,
    UNIQUE (project_id, repo_ref)
);

INSERT INTO project_repos (project_id, repo_ref)
SELECT project_id, repo_ref FROM conversations_old;

DROP TABLE conversations_old;

-- Finally, we create a new table to keep track of whether our manually-written Rust logic to
-- migrate JSON data has been applied.

CREATE TABLE rust_migrations (
    id INTEGER PRIMARY KEY,

    -- A textual reference we use in the Rust code to check the status of this logical migration.
    ref TEXT NOT NULL,

    applied BOOL NOT NULL
);

INSERT INTO rust_migrations (ref, applied) VALUES ("project_migration", false);
