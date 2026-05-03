"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SelfieCapture({ eventId, qrToken }: { eventId: string; qrToken: string }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);

    const fd = new FormData();
    fd.append("eventId", eventId);
    fd.append("selfie", file);

    const res = await fetch("/api/search", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) {
      setError("Não conseguimos detectar um rosto. Tente outra foto.");
      return;
    }
    const { searchId } = (await res.json()) as { searchId: string };
    router.push(`/e/${qrToken}/resultados?s=${searchId}`);
  }

  return (
    <div>
      <label className="flex items-start gap-3 text-left text-sm text-[var(--muted)]">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>
          Autorizo o uso da minha selfie apenas para localizar minhas fotos neste evento.
          Os dados biométricos são apagados automaticamente em 24h.
        </span>
      </label>

      <label
        className={`mt-6 block w-full rounded-xl py-4 px-6 text-center font-medium transition-opacity ${
          consent ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--border)] text-[var(--muted)] pointer-events-none"
        }`}
      >
        {loading ? "Procurando…" : "Tirar selfie"}
        <input
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={onChange}
          disabled={!consent || loading}
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
