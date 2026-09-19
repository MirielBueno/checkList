import { test, expect } from "@jest/globals";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRepository } from "../db/repository.js";

const databaseTest = process.env.TEST_DATABASE_URL ? test : test.skip;
databaseTest("PostgreSQL persists across connections; scopes updates, cascades and imports atomically", async () => {
    let pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const batchId = randomUUID();
    let taskId;
    let secondId;
    let importedId;
    try {
        await pool.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
        let repo = createRepository(pool);
        const task = await repo.create("Persistent task");
        taskId = task.id;
        const second = await repo.create("Another task");
        secondId = second.id;
        const sub = await repo.addSubtask(taskId, "Saved checkbox");
        await repo.updateSubtask(taskId, sub.id, { completed: true });
        expect(await repo.updateSubtask(secondId, sub.id, { completed: false })).toBeUndefined();
        await pool.end();
        pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
        repo = createRepository(pool);
        const loaded = (await repo.list()).find(row => row.id === taskId);
        expect(loaded.subtasks[0].completed).toBe(true);
        expect((await repo.rename(taskId, "New title")).title).toBe("New title");
        expect(await repo.removeSubtask(secondId, sub.id)).toBe(false);
        const importedTitle = "Imported " + batchId;
        const payload = [{ title: importedTitle, subtasks: [{ text: "Done", completed: true }] }];
        expect(await repo.importTasks(batchId, payload)).toBe(true);
        expect(await repo.importTasks(batchId, payload)).toBe(false);
        const matches = (await repo.list()).filter(row => row.title === importedTitle);
        expect(matches).toHaveLength(1);
        importedId = matches[0].id;
        expect(matches[0].subtasks[0].completed).toBe(true);
        const failedBatch = randomUUID();
        await expect(repo.importTasks(failedBatch, [{ title: "Rollback", subtasks: [{ text: "", completed: false }] }])).rejects.toThrow();
        expect((await pool.query("SELECT id FROM checklist.imports WHERE id = $1", [failedBatch])).rowCount).toBe(0);
        await repo.remove(taskId);
        expect((await pool.query("SELECT id FROM checklist.subtasks WHERE task_id = $1", [taskId])).rowCount).toBe(0);
        expect(await repo.remove(taskId)).toBe(false);
    } finally {
        await pool.query("DELETE FROM checklist.tasks WHERE id = ANY($1::uuid[])", [[taskId, secondId, importedId].filter(Boolean)]);
        await pool.query("DELETE FROM checklist.imports WHERE id = $1", [batchId]);
        await pool.end();
    }
}, 20000);
