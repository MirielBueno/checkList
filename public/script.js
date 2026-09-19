import { createTaskView } from "./tasks.js";
import { api } from "./api.js";
import { loadTasks } from "./storage.js";

const form = document.querySelector("#form-task");
const taskField = document.querySelector("#new-task");
const taskList = document.querySelector("#list-task");
const message = document.querySelector("#storage-message");
const reloadButton = document.querySelector("#reload-tasks");
const importButton = document.querySelector("#import-tasks");
const emptyState = document.querySelector("#empty-state");
let tasks = [];
let ready = false;

function showMessage(text) { message.textContent = text; }
function updateEmptyState() { emptyState.hidden = !ready || tasks.length > 0; }
const renderTask = createTaskView(taskList, showMessage, task => {
    tasks = tasks.filter(current => current !== task);
    updateEmptyState();
    taskField.focus();
});

async function refresh() {
    ready = false;
    form.querySelector("button").disabled = true;
    reloadButton.disabled = true;
    importButton.disabled = true;
    showMessage("Loading tasks...");
    try {
        const loaded = await api.list();
        tasks = loaded;
        taskList.replaceChildren();
        tasks.forEach(task => renderTask(task));
        ready = true;
        showMessage("");
    } catch (error) {
        showMessage("Could not load tasks. Check the server and database, then click Reload.");
    } finally {
        form.querySelector("button").disabled = !ready;
        reloadButton.disabled = false;
        importButton.disabled = !ready;
        updateEmptyState();
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    const title = taskField.value.trim();
    if (!title || !ready) return;
    const button = form.querySelector("button");
    if (button.disabled) return;
    button.disabled = true;
    reloadButton.disabled = true;
    importButton.disabled = true;
    showMessage("Saving...");
    try {
        const task = await api.create(title);
        tasks.push(task);
        renderTask(task, true);
        taskField.value = "";
        showMessage("");
        updateEmptyState();
    } catch (error) {
        showMessage(error.message || "Could not create task. Please try again.");
    } finally {
        button.disabled = false;
        reloadButton.disabled = false;
        importButton.disabled = false;
    }
});

reloadButton.addEventListener("click", () => {
    if (taskList.querySelector('[aria-busy="true"]')) {
        showMessage("Wait for the current change to finish before reloading.");
        return;
    }
    refresh();
});

// O backup antigo fica preservado. O identificador torna a importação repetível sem duplicar.
try {
    importButton.hidden = loadTasks().length === 0 || localStorage.getItem("checklist-import-complete") === "true";
} catch (error) {
    showMessage("The local backup could not be read.");
}
importButton.addEventListener("click", async () => {
    if (!ready || taskList.querySelector('[aria-busy="true"]')) return;
    importButton.disabled = true;
    reloadButton.disabled = true;
    form.querySelector("button").disabled = true;
    try {
        const localTasks = loadTasks();
        let id = localStorage.getItem("checklist-import-id");
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem("checklist-import-id", id);
        }
        await api.importTasks(id, localTasks);
        localStorage.setItem("checklist-import-complete", "true");
        importButton.hidden = true;
        await refresh();
    } catch (error) {
        showMessage(error.message || "Import failed. Your local backup is unchanged.");
    } finally {
        importButton.disabled = !ready;
        reloadButton.disabled = false;
        form.querySelector("button").disabled = !ready;
    }
});

refresh();
