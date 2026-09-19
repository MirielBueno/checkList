import express from "express";
import { fileURLToPath } from "node:url";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function text(value, max) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
        throw Object.assign(new Error("Text must contain 1 to " + max + " characters."), { status: 400 });
    }
    return value.trim();
}

export function createApp(repository, auth = null) {
    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
    for (const name of ["id", "subtaskId"]) {
        app.param(name, (req, res, next, value) => {
            if (!uuid.test(value)) return res.status(400).json({ error: "Invalid identifier." });
            next();
        });
    }
    app.get("/api/health", async (req, res) => {
        await repository.health();
        res.json({ status: "ok", database: "connected" });
    });
    app.get("/api/config", (req, res) => {
        if (!auth) return res.status(503).json({ error: "Login is not configured yet. Set the Supabase public key on the server." });
        res.json(auth.publicConfig);
    });
    app.use("/api", async (req, res, next) => {
        const token = req.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
        if (!token) return res.status(401).json({ error: "Please sign in." });
        if (!auth) return res.status(503).json({ error: "Authentication is not configured." });
        let user;
        try { user = await auth.verify(token); }
        catch { return res.status(503).json({ error: "Authentication service unavailable. Please try again." }); }
        if (!user || !uuid.test(user.id)) return res.status(401).json({ error: "Your session expired. Please sign in again." });
        req.user = user;
        next();
    });
    app.get("/api/me", (req, res) => res.json({ id: req.user.id, email: req.user.email }));
    app.get("/api/tasks", async (req, res) => res.json(await repository.list(req.user.id)));
    app.post("/api/tasks", async (req, res) => res.status(201).json(await repository.create(req.user.id, text(req.body?.title, 200))));
    app.patch("/api/tasks/:id", async (req, res) => {
        const task = await repository.rename(req.user.id, req.params.id, text(req.body?.title, 200));
        task ? res.json(task) : res.status(404).json({ error: "Task not found." });
    });
    app.delete("/api/tasks/:id", async (req, res) => {
        (await repository.remove(req.user.id, req.params.id)) ? res.sendStatus(204) : res.status(404).json({ error: "Task not found." });
    });
    app.post("/api/tasks/:id/subtasks", async (req, res) => {
        const subtask = await repository.addSubtask(req.user.id, req.params.id, text(req.body?.text, 500));
        subtask ? res.status(201).json(subtask) : res.status(404).json({ error: "Task not found." });
    });
    app.patch("/api/tasks/:id/subtasks/:subtaskId", async (req, res) => {
        const changes = {};
        if (req.body?.text !== undefined) changes.text = text(req.body.text, 500);
        if (req.body?.completed !== undefined) {
            if (typeof req.body.completed !== "boolean") return res.status(400).json({ error: "Completed must be a boolean." });
            changes.completed = req.body.completed;
        }
        if (!Object.keys(changes).length) return res.status(400).json({ error: "No changes provided." });
        const subtask = await repository.updateSubtask(req.user.id, req.params.id, req.params.subtaskId, changes);
        subtask ? res.json(subtask) : res.status(404).json({ error: "Subtask not found." });
    });
    app.delete("/api/tasks/:id/subtasks/:subtaskId", async (req, res) => {
        (await repository.removeSubtask(req.user.id, req.params.id, req.params.subtaskId)) ? res.sendStatus(204) : res.status(404).json({ error: "Subtask not found." });
    });
    app.post("/api/import", async (req, res) => {
        const { id, tasks } = req.body ?? {};
        if (typeof id !== "string" || !uuid.test(id) || !Array.isArray(tasks) || tasks.length > 1000) return res.status(400).json({ error: "Invalid import." });
        const validated = tasks.map(task => {
            const title = text(task?.title, 200);
            if (!Array.isArray(task.subtasks) || task.subtasks.length > 1000) {
                throw Object.assign(new Error("Invalid subtasks."), { status: 400 });
            }
            return { title, subtasks: task.subtasks.map(subtask => {
                const value = text(subtask?.text, 500);
                if (typeof subtask.completed !== "boolean") throw Object.assign(new Error("Invalid completion."), { status: 400 });
                return { text: value, completed: subtask.completed };
            }) };
        });
        res.json({ imported: await repository.importTasks(req.user.id, id, validated) });
    });
    app.use("/api", (req, res) => res.status(404).json({ error: "Route not found." }));
    app.get("/vendor/supabase.js", (req, res) => {
        res.sendFile(fileURLToPath(new URL("./node_modules/@supabase/supabase-js/dist/umd/supabase.js", import.meta.url)));
    });
    app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));
    app.use((error, req, res, next) => {
        const status = error.status === 400 || error.status === 413 ? error.status : 503;
        res.status(status).json({ error: status === 503 ? "Database unavailable. Please try again." : status === 413 ? "Request too large." : error instanceof SyntaxError ? "Invalid JSON." : error.message });
    });
    return app;
}
