"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginDevPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@iris.local");
  const [password, setPassword] = useState("iris-demo-2025");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else router.push("/dashboard");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">Login (dev)</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Atalho local com senha. Em produção use o magic link em <code>/login</code>.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-transparent outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-transparent outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </div>
    </main>
  );
}
