let client;
let initializing;

export async function getAuthClient() {
    if (!initializing) initializing = (async () => {
        const response = await fetch("/api/config", { signal: AbortSignal.timeout(10000) });
        const config = await response.json();
        if (!response.ok) throw new Error(config.error || "Login is unavailable.");
        client = globalThis.supabase.createClient(config.url, config.publishableKey);
        return client;
    })().catch(error => { initializing = null; throw error; });
    return initializing;
}

export async function getAccessToken(expectedUser) {
    const auth = await getAuthClient();
    const { data, error } = await auth.auth.getSession();
    if (error || !data.session) throw new Error("Please sign in again.");
    if (expectedUser && data.session.user.id !== expectedUser) throw new Error("Session changed. Please reload.");
    return data.session.access_token;
}

export async function initializeAuth(onSession) {
    const authForm = document.querySelector("#auth-form");
    const password = document.querySelector("#auth-password");
    const email = document.querySelector("#auth-email");
    const message = document.querySelector("#auth-message");
    const logout = document.querySelector("#sign-out");
    const auth = await getAuthClient();
    auth.auth.onAuthStateChange((event, session) => {
        // Executar fora do callback do SDK evita bloquear a renovação da sessão.
        setTimeout(() => onSession(session), 0);
    });

    authForm.addEventListener("submit", async event => {
        event.preventDefault();
        const signup = event.submitter?.value === "signup";
        if (signup && password.value.length < 8) {
            message.textContent = "Choose a password with at least 8 characters.";
            return;
        }
        const controls = [...authForm.querySelectorAll("input, button")];
        controls.forEach(control => control.disabled = true);
        message.textContent = signup ? "Creating account..." : "Signing in...";
        try {
            const credentials = { email: email.value.trim(), password: password.value };
            const result = signup
                ? await auth.auth.signUp({ ...credentials, options: { emailRedirectTo: location.origin } })
                : await auth.auth.signInWithPassword(credentials);
            if (result.error) throw result.error;
            password.value = "";
            message.textContent = signup && !result.data.session
                ? "Check your email to confirm your account, then sign in. If you already have an account, use Sign in."
                : "";
        } catch (error) {
            message.textContent = error.message || "Could not sign in. Please try again.";
        } finally { controls.forEach(control => control.disabled = false); }
    });

    logout.addEventListener("click", async () => {
        logout.disabled = true;
        try {
            const { error } = await auth.auth.signOut({ scope: "local" });
            if (error) throw error;
            onSession(null);
        } catch {
            document.querySelector("#storage-message").textContent = "Could not sign out. Please try again.";
        } finally { logout.disabled = false; }
    });
}
