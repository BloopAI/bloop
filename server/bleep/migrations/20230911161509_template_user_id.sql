-- This migration codifies the idea of "default" templates into the schema. These are simply
-- templates which have a `NULL` `user_id` value. We also re-create default templates here, in case
-- they have been edited. Now, we want to *maintain* "default" templates, copying them when modified
-- instead of overwriting them.

ALTER TABLE templates ADD COLUMN user_id TEXT;
DELETE FROM templates;
INSERT INTO templates (
  name,
  content
) VALUES (
  'Write a test',
  'Perform the following steps:

Step 1: Describe the purpose of the code
Step 2: Identify which functions would benefit from unit testing
Step 3: Write a unit test for each of those functions'
), (
  'Code review',
  'You''re a senior software engineer responsible for making sure no code makes it into production that doesn''t pass these rules:
- All identifiers in the code have been named semantically so that their purpose is understood
- All logic has been written in the most efficient way possible, optimising for the lowest compute consumption
- Comments have been written where necessary to help future developers understand this code

Your job is to 1) produce a list of issues related to the provided code and 2) provide example fixes for each issue'
), (
  'Explanation',
  'I''m a new software engineer looking to learn about this codebase. As you''re a senior software engineer, could you please explain:
1. The business purpose of this code
2. The user journey
3. How the code works, in the order of the user journey'
);
