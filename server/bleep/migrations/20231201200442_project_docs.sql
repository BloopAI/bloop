CREATE TABLE project_docs (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    doc_id INTEGER NOT NULL,
    UNIQUE (project_id, doc_id)
);
