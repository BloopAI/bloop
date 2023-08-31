CREATE TABLE templates (
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    modified_at DATETIME NOT NULL DEFAULT (datetime('now')),
    content TEXT NOT NULL
);

INSERT INTO templates (
  id,
  name,
  content
) VALUES (
  'DEFAULT_UNIT_TEST',
  'Unit Test',
  'Perform the following steps:\n\nStep 1: Describe the purpose of the code\nStep 2: Identify which functions would benefit from unit testing\nStep 3: Write a unit test for each of those functions'
);