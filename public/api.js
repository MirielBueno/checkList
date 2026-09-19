async function request(path, method = "GET", body) {
    const response = await fetch("/api" + path, {
        method,
        headers: body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Could not reach the server.");
    }
    return response.status === 204 ? null : response.json();
}

export const api = {
    list: () => request("/tasks"),
    create: title => request("/tasks", "POST", { title }),
    rename: (id, title) => request("/tasks/" + id, "PATCH", { title }),
    remove: id => request("/tasks/" + id, "DELETE"),
    addSubtask: (id, text) => request("/tasks/" + id + "/subtasks", "POST", { text }),
    updateSubtask: (id, subtaskId, changes) => request("/tasks/" + id + "/subtasks/" + subtaskId, "PATCH", changes),
    removeSubtask: (id, subtaskId) => request("/tasks/" + id + "/subtasks/" + subtaskId, "DELETE"),
    importTasks: (id, tasks) => request("/import", "POST", { id, tasks })
};
