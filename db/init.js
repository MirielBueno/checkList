import { readFile } from "node:fs/promises";
import { createPool } from "./pool.js";
const pool = createPool();
try {
    await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
    console.log("Tabelas do checklist criadas/verificadas.");
} catch (error) {
    console.error("Falha ao preparar o banco. Confira a conexão. Código:", error.code ?? "unknown");
    process.exitCode = 1;
} finally { await pool.end(); }
