CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT
);

ALTER TABLE studios ADD COLUMN project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE studios DROP COLUMN user_id;
ALTER TABLE conversations ADD COLUMN project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE;
ALTER TABLE conversations DROP COLUMN repo_ref;
ALTER TABLE conversations DROP COLUMN user_id;

CREATE TABLE project_repos (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    repo_ref TEXT NOT NULL,
    branch TEXT,
    UNIQUE (project_id, repo_ref)
);
