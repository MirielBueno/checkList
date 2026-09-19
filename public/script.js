import { createTaskView } from "./tasks.js";
import { api, configureAuth, setSessionIdentity } from "./api.js";
import { getAccessToken, initializeAuth } from "./auth.js";
import { loadTasks } from "./storage.js";

const form = document.querySelector("#form-task");
const taskField = document.querySelector("#new-task");
const taskList = document.querySelector("#list-task");
const message = document.querySelector("#storage-message");
const reloadButton = document.querySelector("#reload-tasks");
const importButton = document.querySelector("#import-tasks");
const emptyState = document.querySelector("#empty-state");
const authPanel = document.querySelector("#auth-panel");
const workspace = document.querySelector("#workspace");
let tasks = [];
let ready = false;
let userId = null;
let generation = 0;
let renderTask;

function showMessage(text) { message.textContent = text; }
function updateEmptyState() { emptyState.hidden = !ready || tasks.length > 0; }
function toggleControls(disabled) {
    form.querySelector("button").disabled = disabled;
    reloadButton.disabled = disabled;
    importButton.disabled = disabled;
}
function importKey(suffix) { return "checklist-import-" + userId + "-" + suffix; }
function updateImportButton() {
    try {
        importButton.hidden = loadTasks().length === 0 ||
            localStorage.getItem("checklist-import-complete") === "true" ||
            localStorage.getItem(importKey("complete")) === "true";
    } catch { importButton.hidden = true; }
}
function handleSession(session) {
    const nextId = session?.user?.id ?? null;
    if (nextId === userId && (ready || nextId === null)) {
        authPanel.hidden = Boolean(nextId);
        workspace.hidden = !nextId;
        return;
    }
    userId = nextId;
    const version = ++generation;
    setSessionIdentity(userId);
    ready = false;
    tasks = [];
    taskList.replaceChildren();
    taskField.value = "";
    showMessage("");
    toggleControls(true);
    updateEmptyState();
    authPanel.hidden = Boolean(userId);
    workspace.hidden = !userId;
    document.querySelector("#account-email").textContent = session?.user?.email ?? "";
    if (!userId) return;
    renderTask = createTaskView(taskList,
        text => { if (version === generation) showMessage(text); },
        task => {
            if (version !== generation) return;
            tasks = tasks.filter(current => current !== task);
            updateEmptyState();
            taskField.focus();
        });
    updateImportButton();
    refresh();
}

async function refresh() {
    const version = generation;
    ready = false;
    toggleControls(true);
    taskList.inert = true;
    showMessage("Loading tasks...");
    try {
        const loaded = await api.list();
        if (version !== generation) return;
        tasks = loaded;
        taskList.replaceChildren();
        tasks.forEach(task => renderTask(task));
        ready = true;
        showMessage("");
    } catch (error) {
        if (version === generation) showMessage(error.message || "Could not load tasks. Click Reload to try again.");
    } finally {
        if (version === generation) {
            toggleControls(!ready);
            reloadButton.disabled = false;
            taskList.inert = false;
            updateEmptyState();
        }
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    const title = taskField.value.trim();
    if (!title || !ready || form.querySelector("button").disabled) return;
    const version = generation;
    toggleControls(true);
    showMessage("Saving...");
    try {
        const task = await api.create(title);
        if (version !== generation) return;
        tasks.push(task);
        renderTask(task, true);
        taskField.value = "";
        showMessage("");
        updateEmptyState();
    } catch (error) {
        if (version === generation) showMessage(error.message || "Could not create task.");
    } finally {
        if (version === generation) toggleControls(false);
    }
});

reloadButton.addEventListener("click", () => {
    if (taskList.querySelector('[aria-busy="true"]')) {
        showMessage("Wait for the current change to finish before reloading.");
        return;
    }
    refresh();
});

importButton.addEventListener("click", async () => {
    if (!ready || taskList.querySelector('[aria-busy="true"]')) return;
    if (!window.confirm("Import the tasks saved in this browser into your signed-in account?")) return;
    const version = generation;
    const idKey = importKey("id");
    const doneKey = importKey("complete");
    toggleControls(true);
    taskList.inert = true;
    try {
        const localTasks = loadTasks();
        let id = localStorage.getItem(idKey);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(idKey, id);
        }
        await api.importTasks(id, localTasks);
        if (version !== generation) return;
        localStorage.setItem(doneKey, "true");
        importButton.hidden = true;
        await refresh();
    } catch (error) {
        if (version === generation) showMessage(error.message || "Import failed. Your local backup is unchanged.");
    } finally {
        if (version === generation) {
            toggleControls(!ready);
            reloadButton.disabled = false;
            taskList.inert = false;
        }
    }
});

configureAuth(getAccessToken, () => {
    handleSession(null);
    document.querySelector("#auth-message").textContent = "Your session expired. Please sign in again.";
});
initializeAuth(handleSession).catch(error => {
    document.querySelector("#auth-message").textContent = error.message || "Could not load login. Reload to try again.";
    document.querySelectorAll("#auth-form button").forEach(button => button.disabled = true);
});
