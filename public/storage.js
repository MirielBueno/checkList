const storageKey = "checklist-tasks";

// Converte o texto salvo em uma lista de tarefas e valida sua estrutura.
export function loadTasks() {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(saved) || !saved.every(task =>
        task !== null && typeof task.title === "string" &&
        Array.isArray(task.subtasks) &&
        task.subtasks.every(subtask =>
            subtask !== null && typeof subtask.text === "string" &&
            typeof subtask.completed === "boolean"
        )
    )) {
        throw new Error("Invalid saved tasks");
    }
    return saved;
}

// Recebe os dados da aplicação; este módulo não precisa acessar o HTML.
export function saveTasks(tasks) {
    localStorage.setItem(storageKey, JSON.stringify(tasks));
}
