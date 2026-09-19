import { randomUUID } from "node:crypto";

export function createRepository(pool) {
    return {
        async health() { await pool.query("SELECT 1 FROM checklist.tasks LIMIT 1"); },
        async list(ownerId) {
            const { rows } = await pool.query(`
                SELECT t.id, t.title, COALESCE(
                    json_agg(json_build_object('id', s.id, 'text', s.text, 'completed', s.completed)
                        ORDER BY s.created_at, s.id) FILTER (WHERE s.id IS NOT NULL), '[]'
                ) AS subtasks
                FROM checklist.tasks t LEFT JOIN checklist.subtasks s ON s.task_id = t.id
                WHERE t.owner_id = $1 GROUP BY t.id ORDER BY t.created_at, t.id`, [ownerId]);
            return rows;
        },
        async create(ownerId, title) {
            const { rows } = await pool.query("INSERT INTO checklist.tasks (id, title, owner_id) VALUES ($1, $2, $3) RETURNING id, title", [randomUUID(), title, ownerId]);
            return { ...rows[0], subtasks: [] };
        },
        async rename(ownerId, id, title) {
            const { rows } = await pool.query("UPDATE checklist.tasks SET title = $2 WHERE id = $1 AND owner_id = $3 RETURNING id, title", [id, title, ownerId]);
            return rows[0];
        },
        async remove(ownerId, id) {
            return (await pool.query("DELETE FROM checklist.tasks WHERE id = $1 AND owner_id = $2", [id, ownerId])).rowCount > 0;
        },
        async addSubtask(ownerId, taskId, text) {
            const { rows } = await pool.query(`INSERT INTO checklist.subtasks (id, task_id, text)
                SELECT $1, id, $3 FROM checklist.tasks WHERE id = $2 AND owner_id = $4 RETURNING id, text, completed`, [randomUUID(), taskId, text, ownerId]);
            return rows[0];
        },
        async updateSubtask(ownerId, taskId, id, changes) {
            const { rows } = await pool.query(`UPDATE checklist.subtasks
                SET text = COALESCE($3, text), completed = COALESCE($4, completed)
                WHERE task_id = $1 AND id = $2 AND EXISTS (SELECT 1 FROM checklist.tasks WHERE id = $1 AND owner_id = $5) RETURNING id, text, completed`,
                [taskId, id, changes.text ?? null, changes.completed ?? null, ownerId]);
            return rows[0];
        },
        async removeSubtask(ownerId, taskId, id) {
            return (await pool.query("DELETE FROM checklist.subtasks WHERE task_id = $1 AND id = $2 AND EXISTS (SELECT 1 FROM checklist.tasks WHERE id = $1 AND owner_id = $3)", [taskId, id, ownerId])).rowCount > 0;
        },
        async importTasks(ownerId, batchId, tasks) {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                const batch = await client.query("INSERT INTO checklist.user_imports (id, owner_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id", [batchId, ownerId]);
                if (batch.rowCount) {
                    for (const task of tasks) {
                        const id = randomUUID();
                        await client.query("INSERT INTO checklist.tasks (id, title, owner_id) VALUES ($1, $2, $3)", [id, task.title, ownerId]);
                        for (const subtask of task.subtasks) {
                            await client.query("INSERT INTO checklist.subtasks (id, task_id, text, completed) VALUES ($1, $2, $3, $4)",
                                [randomUUID(), id, subtask.text, subtask.completed]);
                        }
                    }
                }
                await client.query("COMMIT");
                return batch.rowCount > 0;
            } catch (error) {
                await client.query("ROLLBACK");
                throw error;
            } finally { client.release(); }
        }
    };
}
