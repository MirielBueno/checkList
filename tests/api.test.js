import { jest, test, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../app.js";

const id = "11111111-1111-4111-8111-111111111111";
const subId = "22222222-2222-4222-8222-222222222222";
let repo;
let app;
beforeEach(() => {
    repo = Object.fromEntries(["health", "list", "create", "rename", "remove", "addSubtask", "updateSubtask", "removeSubtask", "importTasks"].map(key => [key, jest.fn()]));
    repo.list.mockResolvedValue([]);
    app = createApp(repo);
});

test("lists tasks and reports database health", async () => {
    expect((await request(app).get("/api/tasks")).body).toEqual([]);
    expect((await request(app).get("/api/health")).body.database).toBe("connected");
});
test("validates title and trims before creating", async () => {
    for (const title of [" ", 4, "x".repeat(201), null]) {
        await request(app).post("/api/tasks").send({ title }).expect(400);
    }
    expect(repo.create).not.toHaveBeenCalled();
    repo.create.mockResolvedValue({ id, title: "Study", subtasks: [] });
    const result = await request(app).post("/api/tasks").send({ title: " Study " }).expect(201);
    expect(result.body.id).toBe(id);
    expect(repo.create).toHaveBeenCalledWith("Study");
});
test("invalid identifiers and missing resources have distinct statuses", async () => {
    await request(app).delete("/api/tasks/not-an-id").expect(400);
    await request(app).delete("/api/tasks/" + id).expect(404);
    repo.remove.mockResolvedValue(true);
    await request(app).delete("/api/tasks/" + id).expect(204);
});
test("updates only a boolean completion and scopes subtasks to the parent", async () => {
    const url = "/api/tasks/" + id + "/subtasks/" + subId;
    await request(app).patch(url).send({ completed: "false" }).expect(400);
    await request(app).patch(url).send({}).expect(400);
    repo.updateSubtask.mockResolvedValue({ id: subId, text: "HTML", completed: false });
    await request(app).patch(url).send({ completed: false }).expect(200);
    expect(repo.updateSubtask).toHaveBeenCalledWith(id, subId, { completed: false });
});
test("supports rename and subtask creation/deletion", async () => {
    repo.rename.mockResolvedValue({ id, title: "Renamed" });
    await request(app).patch("/api/tasks/" + id).send({ title: "Renamed" }).expect(200);
    repo.addSubtask.mockResolvedValue({ id: subId, text: "HTML", completed: false });
    await request(app).post("/api/tasks/" + id + "/subtasks").send({ text: "HTML" }).expect(201);
    repo.removeSubtask.mockResolvedValue(true);
    await request(app).delete("/api/tasks/" + id + "/subtasks/" + subId).expect(204);
});
test("validates an entire import before writing", async () => {
    await request(app).post("/api/import").send({ id, tasks: [{ title: "Study", subtasks: [null] }] }).expect(400);
    expect(repo.importTasks).not.toHaveBeenCalled();
    repo.importTasks.mockResolvedValue(true);
    await request(app).post("/api/import").send({ id, tasks: [{ title: "Study", subtasks: [{ text: "HTML", completed: true }] }] }).expect(200);
    expect(repo.importTasks).toHaveBeenCalledTimes(1);
});
test("does not leak database errors or report success on failure", async () => {
    repo.create.mockRejectedValue(new Error("postgres://secret"));
    const response = await request(app).post("/api/tasks").send({ title: "Study" }).expect(503);
    expect(response.text).not.toContain("secret");
});
test("malformed JSON and unknown API routes return JSON errors", async () => {
    await request(app).post("/api/tasks").set("Content-Type", "application/json").send("{").expect(400);
    await request(app).get("/api/missing").expect(404).expect("Content-Type", /json/);
});
