import { createClient } from "@supabase/supabase-js";

export function createAuth(env = process.env) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_PUBLISHABLE_KEY;
    // Só uma chave pública pode ser disponibilizada ao navegador.
    if (!url || !key?.startsWith("sb_publishable_")) return null;
    const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(10000) }) }
    });
    return {
        publicConfig: { url, publishableKey: key },
        async verify(token) {
            const { data, error } = await client.auth.getUser(token);
            if (error) {
                if (!error.status || error.status >= 500 || error.status === 429) {
                    throw new Error("Authentication service unavailable");
                }
                return null;
            }
            return data.user;
        }
    };
}
