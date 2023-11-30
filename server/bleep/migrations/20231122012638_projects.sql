CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT
);

ALTER TABLE studios ADD COLUMN project_id INTEGER NOT NULL;
ALTER TABLE studios DROP COLUMN user_id;
ALTER TABLE conversations ADD COLUMN project_id INTEGER NOT NULL;
ALTER TABLE conversations DROP COLUMN repo_ref;
ALTER TABLE conversations DROP COLUMN user_id;
