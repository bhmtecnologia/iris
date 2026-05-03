"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState<"google" | "magic" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginWithGoogle() {
    setLoading("google");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setLoading(null);
      setError(error.message);
    }
    // On success Supabase redirects, no further state to set.
  }

  async function loginWithMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading("magic");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(null);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Portal do fotógrafo.
        </p>

        <button
          onClick={loginWithGoogle}
          disabled={loading !== null}
          className="mt-8 w-full py-3 rounded-lg border border-[var(--border)] flex items-center justify-center gap-3 hover:bg-[var(--border)]/30 transition-colors disabled:opacity-50"
        >
          <GoogleIcon />
          <span className="text-sm font-medium">
            {loading === "google" ? "Redirecionando…" : "Continuar com Google"}
          </span>
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
          <div className="flex-1 h-px bg-[var(--border)]" />
          ou
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {sent ? (
          <p className="text-sm text-center">
            ✓ Link enviado para <strong>{email}</strong>. Confira sua caixa de entrada.
          </p>
        ) : (
          <form onSubmit={loginWithMagicLink} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-transparent outline-none focus:border-[var(--foreground)] transition-colors"
            />
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full py-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium disabled:opacity-50 transition-opacity"
            >
              {loading === "magic" ? "Enviando…" : "Enviar link mágico"}
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
    </svg>
  );
}
