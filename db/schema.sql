CREATE SCHEMA IF NOT EXISTS checklist;
CREATE TABLE IF NOT EXISTS checklist.tasks (
    id uuid PRIMARY KEY,
    title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checklist.subtasks (
    id uuid PRIMARY KEY,
    task_id uuid NOT NULL REFERENCES checklist.tasks(id) ON DELETE CASCADE,
    text text NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 500),
    completed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subtasks_task_id_idx ON checklist.subtasks(task_id);
CREATE TABLE IF NOT EXISTS checklist.imports (
    id uuid PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Estas tabelas são acessadas somente pelo backend.
ALTER TABLE checklist.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist.imports ENABLE ROW LEVEL SECURITY;

-- Migração aditiva: tarefas antigas ficam preservadas até a atribuição explícita.
ALTER TABLE checklist.tasks ADD COLUMN IF NOT EXISTS owner_id uuid;
CREATE INDEX IF NOT EXISTS tasks_owner_id_idx ON checklist.tasks(owner_id);
CREATE TABLE IF NOT EXISTS checklist.user_imports (
    owner_id uuid NOT NULL,
    id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (owner_id, id)
);
ALTER TABLE checklist.user_imports ENABLE ROW LEVEL SECURITY;
