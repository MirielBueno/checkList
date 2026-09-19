import "dotenv/config";
import pg from "pg";
import { readFileSync } from "node:fs";

export function createPool() {
    if (!process.env.DATABASE_URL) throw new Error("Preencha DATABASE_URL no .env.");
    const url = new URL(process.env.DATABASE_URL);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
    const ssl = local ? false : {
        rejectUnauthorized: true,
        ...(process.env.DATABASE_CA_FILE ? { ca: readFileSync(process.env.DATABASE_CA_FILE, "utf8") } : {})
    };
    return new pg.Pool({ connectionString: url.toString(), ssl, max: 5, connectionTimeoutMillis: 10000 });
}
