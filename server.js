import express from "express";

const tasks = [];
const app = express();

app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {

    res.send("Server ok.");
});
app.get("/api/tasks", (req, res) =>{
    res.json(tasks);
});
app.listen(3000, () => {

    console.log("Server OK.");
});
app.post("/api/tasks", (req, res) => {
    const title = req.body?.title;

    if (typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({
            error: "A task title is required"
        });
    }

    const task = {
        title: title.trim(),
        subtasks: []
    };

    tasks.push(task);

    res.status(201).json(task);
});
app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
});