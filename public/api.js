let tokenProvider = async () => { throw new Error("Please sign in."); };
let unauthorized = () => {};
let sessionVersion = 0;
let currentUser = null;

export function configureAuth(getToken, onUnauthorized) {
    tokenProvider = getToken;
    unauthorized = onUnauthorized;
}
export function setSessionIdentity(userId) {
    if (userId !== currentUser) {
        currentUser = userId;
        sessionVersion++;
    }
}
async function request(path, method = "GET", body) {
    const version = sessionVersion;
    if (!currentUser) throw new Error("Please sign in.");
    const token = await tokenProvider(currentUser);
    if (version !== sessionVersion) throw new Error("Session changed.");
    const response = await fetch("/api" + path, {
        method,
        headers: { Authorization: "Bearer " + token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (version !== sessionVersion) throw new Error("Session changed.");
    if (response.status === 401) unauthorized();
    if (!response.ok) throw new Error(data?.error || "Could not reach the server.");
    return data;
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
