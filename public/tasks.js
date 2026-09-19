// Os callbacks avisam a aplicação quando os cards alteram os dados.
export function createTaskView(taskList, onChange, onDelete) {
    let activeCard = null;
    let cardSequence = 0;

    function renderSubtask(subtask, task, list, updateSummary) {
        const item = document.createElement("li");
        item.className = "subtask-item";
    
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = subtask.completed;
    
        const text = document.createElement("span");
        text.textContent = subtask.text;
    
        checkbox.addEventListener("change", () => {
            subtask.completed = checkbox.checked;
            updateSummary();
            onChange();
        });
    
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            if (!window.confirm('Delete subtask "' + subtask.text + '"?')) return;
            task.subtasks = task.subtasks.filter(current => current !== subtask);
            item.remove();
            updateSummary();
            onChange();
        });
    
        label.append(checkbox, text);
        item.append(label, deleteButton);
        list.append(item);
    }
    
    function renderTask(task, open = false) {
        const item = document.createElement("li");
        item.className = "task-card";
    
        const header = document.createElement("div");
        header.className = "task-header";
    
        const title = document.createElement("h2");
        title.textContent = task.title;
    
        const summary = document.createElement("p");
        summary.className = "task-summary";
        const progress = document.createElement("progress");
        progress.setAttribute("aria-label", "Subtask completion");
        function updateSummary() {
            const completed = task.subtasks.filter(subtask => subtask.completed).length;
            summary.textContent = task.subtasks.length
                ? `${completed} of ${task.subtasks.length} completed`
                : "No subtasks yet";
            progress.max = task.subtasks.length || 1;
            progress.value = completed;
        }
    
        const details = document.createElement("div");
        details.className = "task-details";
        details.id = `task-details-${++cardSequence}`;
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "toggle-button";
        toggle.setAttribute("aria-controls", details.id);
        function setOpen(expanded) {
            details.hidden = !expanded;
            item.classList.toggle("is-editing", expanded);
            toggle.textContent = expanded ? "Done" : "Open";
            toggle.setAttribute("aria-expanded", String(expanded));
        }
        const card = { close: () => setOpen(false) };
        function openCard() {
            if (activeCard) activeCard.close();
            activeCard = card;
            setOpen(true);
            input.focus();
        }
        toggle.addEventListener("click", () => {
            if (details.hidden) openCard();
            else {
                setOpen(false);
                activeCard = null;
            }
        });
        setOpen(false);
        updateSummary();
    
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            if (!window.confirm('Delete task "' + task.title + '" and all its subtasks?')) return;
    
            if (activeCard === card) activeCard = null;
            item.remove();
            onDelete(task);
        });
        header.append(title);
        const actions = document.createElement("div");
        actions.className = "task-actions";
        actions.append(toggle, deleteButton);
    
        const subtaskForm = document.createElement("form");
        subtaskForm.className = "subtask-form";
        const label = document.createElement("label");
        label.textContent = "New subtask";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Enter a subtask";
        input.required = true;
        label.append(input);
    
        const addButton = document.createElement("button");
        addButton.type = "submit";
        addButton.textContent = "Add subtask";
        subtaskForm.append(label, addButton);
    
        const list = document.createElement("ul");
        list.className = "subtask-list";
        task.subtasks.forEach(subtask => renderSubtask(subtask, task, list, updateSummary));
    
        subtaskForm.addEventListener("submit", event => {
            event.preventDefault();
            const text = input.value.trim();
            if (!text) return;
            const subtask = { text, completed: false };
            task.subtasks.push(subtask);
            renderSubtask(subtask, task, list, updateSummary);
            updateSummary();
            onChange();
            input.value = "";
            input.focus();
        });
    
        details.append(subtaskForm, list);
        item.append(header, summary, progress, actions, details);
        taskList.append(item);
        if (open) openCard();
    }

    return renderTask;
}

