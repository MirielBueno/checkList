import { createPool } from "./pool.js";

// Operação administrativa local; não existe rota pública para reivindicar tarefas.
const email = process.env.LEGACY_OWNER_EMAIL?.trim();
if (!email) {
    console.error("Preencha LEGACY_OWNER_EMAIL no .env com o email da sua conta confirmada.");
    process.exitCode = 1;
} else {
    const pool = createPool();
    try {
        const users = await pool.query(
            "SELECT id FROM auth.users WHERE lower(email) = lower($1) AND email_confirmed_at IS NOT NULL",
            [email]
        );
        if (users.rowCount !== 1) {
            console.error("Crie e confirme essa conta no aplicativo antes de associar as tarefas.");
            process.exitCode = 1;
        } else {
            const result = await pool.query("UPDATE checklist.tasks SET owner_id = $1 WHERE owner_id IS NULL", [users.rows[0].id]);
            console.log(`${result.rowCount} tarefa(s) antiga(s) associada(s) à conta configurada.`);
        }
    } catch {
        console.error("Não foi possível associar as tarefas. Confira a conexão e execute db:init.");
        process.exitCode = 1;
    } finally { await pool.end(); }
}
