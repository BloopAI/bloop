-- This migration adds an additional `refactor` template for Code Studio.
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
), (
    'Refactor',
    'You are a senior software engineer reviewing a junior colleague''s code. Your job is to re-write it so that it is cleaner and more readable. 

You should:
- Only respond with code
- Write code that is identical in functionality to your colleague''s
- Write code that is cleaner and more readable than your colleague''s
- If possible, write code that is more performant than your colleague''s
- If possible, write code that is more secure than your colleague''s
- If necessary, introduce new abstractions (classes, functions etc.)'
);
