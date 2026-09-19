import { test, expect } from "@jest/globals";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRepository } from "../db/repository.js";

const databaseTest = process.env.TEST_DATABASE_URL ? test : test.skip;

databaseTest(
    "PostgreSQL persists data, isolates users, cascades deletes and imports atomically",
    async () => {
        let pool = new pg.Pool({
            connectionString: process.env.TEST_DATABASE_URL
        });

        const ownerA = randomUUID();
        const ownerB = randomUUID();
        const batchId = randomUUID();

        try {
            await pool.query(
                await readFile(
                    new URL("../db/schema.sql", import.meta.url),
                    "utf8"
                )
            );

            let repo = createRepository(pool);

            // Cada usuário cria sua própria tarefa.
            const taskA = await repo.create(ownerA, "Task from A");
            const taskB = await repo.create(ownerB, "Task from B");

            // Usuário A cria uma subtarefa.
            const subA = await repo.addSubtask(
                ownerA,
                taskA.id,
                "Saved checkbox"
            );

            await repo.updateSubtask(
                ownerA,
                taskA.id,
                subA.id,
                { completed: true }
            );

            // Usuário B não pode alterar dados do usuário A.
            expect(
                await repo.rename(ownerB, taskA.id, "Hacked")
            ).toBeUndefined();

            expect(
                await repo.addSubtask(ownerB, taskA.id, "Intrusion")
            ).toBeUndefined();

            expect(
                await repo.updateSubtask(
                    ownerB,
                    taskA.id,
                    subA.id,
                    { completed: false }
                )
            ).toBeUndefined();

            expect(
                await repo.removeSubtask(ownerB, taskA.id, subA.id)
            ).toBe(false);

            expect(
                await repo.remove(ownerB, taskA.id)
            ).toBe(false);

            // Reabre a conexão para verificar persistência.
            await pool.end();

            pool = new pg.Pool({
                connectionString: process.env.TEST_DATABASE_URL
            });

            repo = createRepository(pool);

            const tasksA = await repo.list(ownerA);
            const tasksB = await repo.list(ownerB);

            expect(
                tasksA.some(task => task.id === taskA.id)
            ).toBe(true);

            expect(
                tasksA.some(task => task.id === taskB.id)
            ).toBe(false);

            expect(
                tasksB.some(task => task.id === taskB.id)
            ).toBe(true);

            expect(
                tasksB.some(task => task.id === taskA.id)
            ).toBe(false);

            const loadedA = tasksA.find(
                task => task.id === taskA.id
            );

            expect(loadedA.subtasks[0].completed).toBe(true);

            // O proprietário consegue alterar sua própria tarefa.
            const renamed = await repo.rename(
                ownerA,
                taskA.id,
                "New title"
            );

            expect(renamed.title).toBe("New title");

            // Um mesmo ID de importação só pode ser usado uma vez
            // por usuário.
            const payloadA = [
                {
                    title: "Imported by A",
                    subtasks: [
                        {
                            text: "Done",
                            completed: true
                        }
                    ]
                }
            ];

            expect(
                await repo.importTasks(ownerA, batchId, payloadA)
            ).toBe(true);

            expect(
                await repo.importTasks(ownerA, batchId, payloadA)
            ).toBe(false);

            // O mesmo batchId pode existir para outro usuário.
            const payloadB = [
                {
                    title: "Imported by B",
                    subtasks: []
                }
            ];

            expect(
                await repo.importTasks(ownerB, batchId, payloadB)
            ).toBe(true);

            const importedA = (await repo.list(ownerA))
                .find(task => task.title === "Imported by A");

            const importedB = (await repo.list(ownerB))
                .find(task => task.title === "Imported by B");

            expect(importedA).toBeDefined();
            expect(importedA.subtasks[0].completed).toBe(true);

            expect(importedB).toBeDefined();

            // Uma importação inválida deve fazer rollback completo.
            const failedBatch = randomUUID();

            await expect(
                repo.importTasks(ownerA, failedBatch, [
                    {
                        title: "Rollback",
                        subtasks: [
                            {
                                text: "",
                                completed: false
                            }
                        ]
                    }
                ])
            ).rejects.toThrow();

            const failedImport = await pool.query(
                `
                SELECT id
                FROM checklist.user_imports
                WHERE owner_id = $1
                  AND id = $2
                `,
                [ownerA, failedBatch]
            );

            expect(failedImport.rowCount).toBe(0);

            // Exclusão da tarefa deve excluir também suas subtarefas.
            expect(
                await repo.remove(ownerA, taskA.id)
            ).toBe(true);

            const remainingSubtasks = await pool.query(
                `
                SELECT id
                FROM checklist.subtasks
                WHERE task_id = $1
                `,
                [taskA.id]
            );

            expect(remainingSubtasks.rowCount).toBe(0);

            expect(
                await repo.remove(ownerA, taskA.id)
            ).toBe(false);
        } finally {
            // Limpa tudo criado pelos dois usuários de teste.
            await pool.query(
                `
                DELETE FROM checklist.tasks
                WHERE owner_id = ANY($1::uuid[])
                `,
                [[ownerA, ownerB]]
            );

            await pool.query(
                `
                DELETE FROM checklist.user_imports
                WHERE owner_id = ANY($1::uuid[])
                `,
                [[ownerA, ownerB]]
            );

            await pool.end();
        }
    },
    20000
);