-- Add migration script here
ALTER TABLE conversations DROP COLUMN llm_history;
ALTER TABLE conversations DROP COLUMN code_chunks;
ALTER TABLE conversations DROP COLUMN path_aliases;