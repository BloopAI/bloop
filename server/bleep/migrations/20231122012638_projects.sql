CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT
);

ALTER TABLE studios ADD COLUMN project_id INTEGER NOT NULL;
ALTER TABLE conversations ADD COLUMN project_id INTEGER NOT NULL;
