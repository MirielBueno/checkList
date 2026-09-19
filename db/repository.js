import { randomUUID } from "node:crypto";

export function createRepository(pool) {
    return {
        async health() { await pool.query("SELECT 1 FROM checklist.tasks LIMIT 1"); },
        async list() {
            const { rows } = await pool.query(`
                SELECT t.id, t.title, COALESCE(
                    json_agg(json_build_object('id', s.id, 'text', s.text, 'completed', s.completed)
                        ORDER BY s.created_at, s.id) FILTER (WHERE s.id IS NOT NULL), '[]'
                ) AS subtasks
                FROM checklist.tasks t LEFT JOIN checklist.subtasks s ON s.task_id = t.id
                GROUP BY t.id ORDER BY t.created_at, t.id`);
            return rows;
        },
        async create(title) {
            const { rows } = await pool.query("INSERT INTO checklist.tasks (id, title) VALUES ($1, $2) RETURNING id, title", [randomUUID(), title]);
            return { ...rows[0], subtasks: [] };
        },
        async rename(id, title) {
            const { rows } = await pool.query("UPDATE checklist.tasks SET title = $2 WHERE id = $1 RETURNING id, title", [id, title]);
            return rows[0];
        },
        async remove(id) {
            return (await pool.query("DELETE FROM checklist.tasks WHERE id = $1", [id])).rowCount > 0;
        },
        async addSubtask(taskId, text) {
            const { rows } = await pool.query(`INSERT INTO checklist.subtasks (id, task_id, text)
                SELECT $1, id, $3 FROM checklist.tasks WHERE id = $2 RETURNING id, text, completed`, [randomUUID(), taskId, text]);
            return rows[0];
        },
        async updateSubtask(taskId, id, changes) {
            const { rows } = await pool.query(`UPDATE checklist.subtasks
                SET text = COALESCE($3, text), completed = COALESCE($4, completed)
                WHERE task_id = $1 AND id = $2 RETURNING id, text, completed`,
                [taskId, id, changes.text ?? null, changes.completed ?? null]);
            return rows[0];
        },
        async removeSubtask(taskId, id) {
            return (await pool.query("DELETE FROM checklist.subtasks WHERE task_id = $1 AND id = $2", [taskId, id])).rowCount > 0;
        },
        async importTasks(batchId, tasks) {
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                const batch = await client.query("INSERT INTO checklist.imports (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id", [batchId]);
                if (batch.rowCount) {
                    for (const task of tasks) {
                        const id = randomUUID();
                        await client.query("INSERT INTO checklist.tasks (id, title) VALUES ($1, $2)", [id, task.title]);
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
