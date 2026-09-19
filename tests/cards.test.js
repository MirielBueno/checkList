import { test, expect, jest, beforeEach } from "@jest/globals";
import { createTaskView } from "../public/tasks.js";

let focus;
let message;
let approved;
class Element {
    constructor(tag) {
        this.tag = tag;
        this.children = [];
        this.events = {};
        this.value = "";
        this.attributes = {};
        this.classList = { toggle() {} };
    }
    append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
    addEventListener(name, callback) { this.events[name] = callback; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    focus() { focus = this; }
    querySelectorAll() {
        return this.children.flatMap(child => [ ...(["button", "input"].includes(child.tag) ? [child] : []), ...child.querySelectorAll() ]);
    }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
}
beforeEach(() => {
    focus = null; message = ""; approved = true;
    globalThis.document = { createElement: tag => new Element(tag) };
    globalThis.window = { confirm: () => approved, prompt: () => null };
    globalThis.fetch = jest.fn();
});
function setup(subtasks = []) {
    const task = { id: "task", title: "Study", subtasks };
    const list = new Element("ul");
    const onDelete = jest.fn();
    const render = createTaskView(list, text => message = text, onDelete);
    render(task, true);
    return { task, list, card: list.children[0], render, onDelete };
}
function response(data) { return { ok: true, status: 200, json: async () => data }; }
test("new cards focus their input and close the previous card", () => {
    const { card, list, render } = setup();
    expect(focus.tag).toBe("input");
    render({ id: "other", title: "Other", subtasks: [] }, true);
    expect(card.children[4].hidden).toBe(true);
    expect(list.children[1].children[4].hidden).toBe(false);
});
test("failed completion preserves saved state; success updates progress", async () => {
    const subtask = { id: "sub", text: "HTML", completed: false };
    const { card } = setup([subtask]);
    const checkbox = card.children[4].children[1].children[0].children[0].children[0];
    fetch.mockRejectedValueOnce(new Error("Offline"));
    checkbox.checked = true;
    await checkbox.events.change();
    expect(checkbox.checked).toBe(false);
    expect(subtask.completed).toBe(false);
    expect(message).toBe("Offline");
    expect(checkbox.disabled).toBe(false);
    fetch.mockResolvedValueOnce(response({ ...subtask, completed: true }));
    checkbox.checked = true;
    await checkbox.events.change();
    expect(subtask.completed).toBe(true);
    expect(card.children[1].textContent).toBe("1 of 1 completed");
});
test("cancelled and failed deletions preserve the card", async () => {
    const { card, list, onDelete } = setup();
    const button = card.children[3].children[2];
    approved = false;
    await button.events.click();
    expect(fetch).not.toHaveBeenCalled();
    approved = true;
    fetch.mockRejectedValueOnce(new Error("Offline"));
    await button.events.click();
    expect(list.children).toHaveLength(1);
    expect(onDelete).not.toHaveBeenCalled();
    fetch.mockResolvedValueOnce({ ok: true, status: 204 });
    await button.events.click();
    expect(list.children).toHaveLength(0);
    expect(onDelete).toHaveBeenCalledTimes(1);
});
test("failed subtask creation keeps input and successful save clears it", async () => {
    const { card, task } = setup();
    const form = card.children[4].children[0];
    const input = form.children[0].children[0];
    input.value = "HTML";
    fetch.mockRejectedValueOnce(new Error("Offline"));
    await form.events.submit({ preventDefault() {} });
    expect(input.value).toBe("HTML");
    expect(task.subtasks).toHaveLength(0);
    fetch.mockResolvedValueOnce(response({ id: "sub", text: "HTML", completed: false }));
    await form.events.submit({ preventDefault() {} });
    expect(input.value).toBe("");
    expect(task.subtasks).toHaveLength(1);
    expect(focus).toBe(input);
});
