import { jest, test, expect, beforeEach } from "@jest/globals";
import request from "supertest";
import { createApp } from "../app.js";

const id = "11111111-1111-4111-8111-111111111111";
const subId = "22222222-2222-4222-8222-222222222222";
let repo;
let app;
let auth;
const owner = "33333333-3333-4333-8333-333333333333";
function authorized() {
    const client = request(app);
    return Object.fromEntries(["get", "post", "patch", "delete"].map(method => [method, path => client[method](path).set("Authorization", "Bearer valid-token")]));
}
beforeEach(() => {
    repo = Object.fromEntries(["health", "list", "create", "rename", "remove", "addSubtask", "updateSubtask", "removeSubtask", "importTasks"].map(key => [key, jest.fn()]));
    repo.list.mockResolvedValue([]);
    auth = { publicConfig: { url: "https://example.supabase.co", publishableKey: "sb_publishable_example" }, verify: jest.fn(async token => token === "valid-token" ? { id: owner, email: "owner@example.test" } : null) };
    app = createApp(repo, auth);
});

test("lists tasks and reports database health", async () => {
    expect((await authorized().get("/api/tasks")).body).toEqual([]);
    expect((await authorized().get("/api/health")).body.database).toBe("connected");
});
test("validates title and trims before creating", async () => {
    for (const title of [" ", 4, "x".repeat(201), null]) {
        await authorized().post("/api/tasks").send({ title }).expect(400);
    }
    expect(repo.create).not.toHaveBeenCalled();
    repo.create.mockResolvedValue({ id, title: "Study", subtasks: [] });
    const result = await authorized().post("/api/tasks").send({ title: " Study " }).expect(201);
    expect(result.body.id).toBe(id);
    expect(repo.create).toHaveBeenCalledWith(owner, "Study");
});
test("invalid identifiers and missing resources have distinct statuses", async () => {
    await authorized().delete("/api/tasks/not-an-id").expect(400);
    await authorized().delete("/api/tasks/" + id).expect(404);
    repo.remove.mockResolvedValue(true);
    await authorized().delete("/api/tasks/" + id).expect(204);
});
test("updates only a boolean completion and scopes subtasks to the parent", async () => {
    const url = "/api/tasks/" + id + "/subtasks/" + subId;
    await authorized().patch(url).send({ completed: "false" }).expect(400);
    await authorized().patch(url).send({}).expect(400);
    repo.updateSubtask.mockResolvedValue({ id: subId, text: "HTML", completed: false });
    await authorized().patch(url).send({ completed: false }).expect(200);
    expect(repo.updateSubtask).toHaveBeenCalledWith(owner, id, subId, { completed: false });
});
test("supports rename and subtask creation/deletion", async () => {
    repo.rename.mockResolvedValue({ id, title: "Renamed" });
    await authorized().patch("/api/tasks/" + id).send({ title: "Renamed" }).expect(200);
    repo.addSubtask.mockResolvedValue({ id: subId, text: "HTML", completed: false });
    await authorized().post("/api/tasks/" + id + "/subtasks").send({ text: "HTML" }).expect(201);
    repo.removeSubtask.mockResolvedValue(true);
    await authorized().delete("/api/tasks/" + id + "/subtasks/" + subId).expect(204);
});
test("validates an entire import before writing", async () => {
    await authorized().post("/api/import").send({ id, tasks: [{ title: "Study", subtasks: [null] }] }).expect(400);
    expect(repo.importTasks).not.toHaveBeenCalled();
    repo.importTasks.mockResolvedValue(true);
    await authorized().post("/api/import").send({ id, tasks: [{ title: "Study", subtasks: [{ text: "HTML", completed: true }] }] }).expect(200);
    expect(repo.importTasks).toHaveBeenCalledTimes(1);
});
test("does not leak database errors or report success on failure", async () => {
    repo.create.mockRejectedValue(new Error("postgres://secret"));
    const response = await authorized().post("/api/tasks").send({ title: "Study" }).expect(503);
    expect(response.text).not.toContain("secret");
});
test("malformed JSON and unknown API routes return JSON errors", async () => {
    await authorized().post("/api/tasks").set("Content-Type", "application/json").send("{").expect(400);
    await authorized().get("/api/missing").expect(404).expect("Content-Type", /json/);
});

test("requires a validated token for every data route", async () => {
    for (const [method, path] of [
        ["get", "/api/tasks"], ["post", "/api/tasks"], ["patch", "/api/tasks/" + id],
        ["delete", "/api/tasks/" + id], ["post", "/api/tasks/" + id + "/subtasks"],
        ["patch", "/api/tasks/" + id + "/subtasks/" + subId],
        ["delete", "/api/tasks/" + id + "/subtasks/" + subId], ["post", "/api/import"], ["get", "/api/me"]
    ]) {
        await request(app)[method](path).expect(401);
        await request(app)[method](path).set("Authorization", "Bearer forged-token").expect(401);
    }
    expect(repo.list).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
});
test("identity is taken from verified token, never from request body", async () => {
    repo.create.mockResolvedValue({ id, title: "Mine", subtasks: [] });
    await authorized().post("/api/tasks").send({ title: "Mine", owner_id: id, userId: id }).expect(201);
    expect(repo.create).toHaveBeenCalledWith(owner, "Mine");
    await authorized().get("/api/tasks").expect(200);
    expect(repo.list).toHaveBeenCalledWith(owner);
});
test("auth outages fail closed and public config exposes only public settings", async () => {
    auth.verify.mockRejectedValueOnce(new Error("secret"));
    await authorized().get("/api/tasks").expect(503);
    expect(repo.list).not.toHaveBeenCalled();
    const config = await request(app).get("/api/config").expect(200);
    expect(Object.keys(config.body).sort()).toEqual(["publishableKey", "url"]);
    await request(createApp(repo)).get("/api/tasks").expect(401);
});
