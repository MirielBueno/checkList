import { createApp } from "./app.js";
import { createPool } from "./db/pool.js";
import { createRepository } from "./db/repository.js";
import { createAuth } from "./auth.js";

try {
    const pool = createPool();
    pool.on("error", () => console.error("Conexão com o banco interrompida."));
    const app = createApp(createRepository(pool), createAuth());
    const port = process.env.PORT || 3000;
    const host = process.env.HOST || "0.0.0.0";
    const server = app.listen(port, host, () => console.log("Checklist: http://" + host + ":" + port));
    for (const signal of ["SIGINT", "SIGTERM"]) {
        process.once(signal, () => server.close(() => pool.end()));
    }
} catch (error) {
    console.error("Não foi possível iniciar. Confira DATABASE_URL no .env.");
    process.exitCode = 1;
}
