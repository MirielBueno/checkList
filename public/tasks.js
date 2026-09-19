import { api } from "./api.js";

// Os cards só alteram os dados visíveis depois da confirmação do servidor.
export function createTaskView(taskList, onError, onDelete) {
    let activeCard = null;
    let cardSequence = 0;

    function renderTask(task, open = false) {
        const item = document.createElement("li");
        item.className = "task-card";
        const header = document.createElement("div");
        header.className = "task-header";
        const title = document.createElement("h2");
        title.textContent = task.title;
        header.append(title);

        const summary = document.createElement("p");
        summary.className = "task-summary";
        const progress = document.createElement("progress");
        progress.setAttribute("aria-label", "Subtask completion");
        function updateSummary() {
            const completed = task.subtasks.filter(subtask => subtask.completed).length;
            summary.textContent = task.subtasks.length
                ? completed + " of " + task.subtasks.length + " completed" : "No subtasks yet";
            progress.max = task.subtasks.length || 1;
            progress.value = completed;
        }

        const details = document.createElement("div");
        details.className = "task-details";
        details.id = "task-details-" + ++cardSequence;
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.textContent = "Open";
        toggle.setAttribute("aria-controls", details.id);
        function setOpen(expanded) {
            details.hidden = !expanded;
            item.classList.toggle("is-editing", expanded);
            toggle.textContent = expanded ? "Done" : "Open";
            toggle.setAttribute("aria-expanded", String(expanded));
        }
        const card = { close: () => setOpen(false) };
        function openCard() {
            activeCard?.close();
            activeCard = card;
            setOpen(true);
            input.focus();
        }
        toggle.addEventListener("click", () => {
            if (details.hidden) openCard();
            else { setOpen(false); activeCard = null; }
        });

        // Bloqueia ações concorrentes no mesmo card durante uma requisição.
        let busy = false;
        async function run(action) {
            if (busy) return false;
            busy = true;
            item.setAttribute("aria-busy", "true");
            const controls = [...item.querySelectorAll("input, button")];
            controls.forEach(control => control.disabled = true);
            try {
                onError("");
                await action();
                return true;
            } catch (error) {
                onError(error.message || "Could not save changes. Please try again.");
                return false;
            } finally {
                controls.forEach(control => control.disabled = false);
                item.removeAttribute("aria-busy");
                busy = false;
            }
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", async () => {
            if (!window.confirm('Delete task "' + task.title + '" and all its subtasks?')) return;
            await run(async () => {
                await api.remove(task.id);
                if (activeCard === card) activeCard = null;
                item.remove();
                onDelete(task);
            });
        });

        const renameButton = document.createElement("button");
        renameButton.type = "button";
        renameButton.textContent = "Rename";
        renameButton.addEventListener("click", async () => {
            const value = window.prompt("Task title", task.title);
            if (value === null || !value.trim() || value.trim() === task.title) return;
            await run(async () => {
                const updated = await api.rename(task.id, value.trim());
                task.title = updated.title;
                title.textContent = task.title;
            });
        });
        const actions = document.createElement("div");
        actions.className = "task-actions";
        actions.append(toggle, renameButton, deleteButton);

        const subtaskForm = document.createElement("form");
        subtaskForm.className = "subtask-form";
        const label = document.createElement("label");
        label.textContent = "New subtask";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Enter a subtask";
        input.required = true;
        input.maxLength = 500;
        label.append(input);
        const addButton = document.createElement("button");
        addButton.type = "submit";
        addButton.textContent = "Add subtask";
        subtaskForm.append(label, addButton);
        const list = document.createElement("ul");
        list.className = "subtask-list";

        function renderSubtask(subtask) {
            const row = document.createElement("li");
            row.className = "subtask-item";
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = subtask.completed;
            const text = document.createElement("span");
            text.textContent = subtask.text;
            checkbox.addEventListener("change", async () => {
                const completed = checkbox.checked;
                checkbox.checked = subtask.completed;
                await run(async () => {
                    const updated = await api.updateSubtask(task.id, subtask.id, { completed });
                    subtask.completed = updated.completed;
                    checkbox.checked = subtask.completed;
                    updateSummary();
                });
            });
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "delete-button";
            remove.textContent = "Delete";
            remove.addEventListener("click", async () => {
                if (!window.confirm('Delete subtask "' + subtask.text + '"?')) return;
                await run(async () => {
                    await api.removeSubtask(task.id, subtask.id);
                    task.subtasks = task.subtasks.filter(current => current !== subtask);
                    row.remove();
                    updateSummary();
                });
            });
            label.append(checkbox, text);
            row.append(label, remove);
            list.append(row);
        }
        task.subtasks.forEach(renderSubtask);
        subtaskForm.addEventListener("submit", async event => {
            event.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            const saved = await run(async () => {
                const subtask = await api.addSubtask(task.id, text);
                task.subtasks.push(subtask);
                renderSubtask(subtask);
                updateSummary();
                input.value = "";
            });
            if (saved) input.focus();
        });

        setOpen(false);
        updateSummary();
        details.append(subtaskForm, list);
        item.append(header, summary, progress, actions, details);
        taskList.append(item);
        if (open) openCard();
    }
    return renderTask;
}
