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
  'Write a test',
  'Perform the following steps:

Step 1: Describe the purpose of the code
Step 2: Identify which functions would benefit from unit testing
Step 3: Write a unit test for each of those functions'
), (
  'DEFAULT_CODE_REVIEW',
  'Code review',
  'You''re a senior software engineer responsible for making sure no code makes it into production that doesn''t pass these rules:
- All identifiers in the code have been named semantically so that their purpose is understood
- All logic has been written in the most efficient way possible, optimising for the lowest compute consumption
- Comments have been written where necessary to help future developers understand this code

Your job is to 1) produce a list of issues related to the provided code and 2) provide example fixes for each issue'
), (
  'DEFAULT_EXPLANATION',
  'Explanation',
  'I''m a new software engineer looking to learn about this codebase. As you''re a senior software engineer, could you please explain:
1. The business purpose of this code
2. The user journey
3. How the code works, in the order of the user journey'
);