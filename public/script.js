import { createTaskView } from "./tasks.js";
import { loadTasks, saveTasks as writeTasks } from "./storage.js";

const form = document.querySelector("#form-task");
const taskField = document.querySelector("#new-task");
const taskList = document.querySelector("#list-task");
const storageMessage = document.querySelector("#storage-message");
let storageAvailable = true;
let tasks = [];

try {
    tasks = loadTasks();
} catch (error) {
    storageMessage.textContent = "Saved tasks could not be loaded. Changes will not be saved until you reload successfully.";
    storageAvailable = false;
}



function saveTasks() {
    if (!storageAvailable) return;
    try {
        writeTasks(tasks);
        storageMessage.textContent = "";
    } catch (error) {
        storageMessage.textContent = "Changes could not be saved. Keep this page open and try again.";
    }
}

const renderTask = createTaskView(taskList, saveTasks, (task) => {
    tasks = tasks.filter(current => current !== task);
    saveTasks();
    taskField.focus();
});

form.addEventListener("submit", event => {
    event.preventDefault();
    const title = taskField.value.trim();
    if (!title) return;
    const task = { title, subtasks: [] };
    tasks.push(task);
    renderTask(task, true);
    saveTasks();
    taskField.value = "";
});

tasks.forEach(task => renderTask(task));

async function checkServer() {
    try {
        const response = await fetch("/api/health");

        if (!response.ok) {
            throw new Error("Server returned an error");
        }

        const data = await response.json();
        console.log("Server status:", data.status);
    } catch (error) {
        console.error("Could not connect to the server:", error);
    }
}

checkServer();

async function fetchTasks() {
    try {
        const response = await fetch("/api/tasks");

        if (!response.ok) {
            throw new Error("Could not load tasks");
        }

        const serverTasks = await response.json();
        console.log("Server tasks:", serverTasks);
    } catch (error) {
        console.error("Could not fetch tasks:", error);
    }
}

fetchTasks();