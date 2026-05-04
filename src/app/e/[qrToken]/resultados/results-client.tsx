"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatBRL } from "@/lib/utils";

type Item = { id: string; url: string | null };

export function ResultsGrid({
  items,
  eventId,
  searchId,
  priceCents,
  qrToken,
}: {
  items: Item[];
  eventId: string;
  searchId: string;
  priceCents: number;
  qrToken: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const total = priceCents * selected.size;

  async function checkout() {
    setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        searchId,
        photoIds: Array.from(selected),
        email,
        phone,
      }),
    });
    setLoading(false);
    if (!res.ok) return;
    const { orderId } = await res.json();
    router.push(`/e/${qrToken}/checkout/${orderId}?s=${encodeURIComponent(searchId)}`);
  }

  return (
    <div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((it) => {
          const isSel = selected.has(it.id);
          return (
            <button
              key={it.id}
              onClick={() => toggle(it.id)}
              className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                isSel ? "border-[var(--foreground)]" : "border-transparent"
              }`}
            >
              {it.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[var(--border)] flex items-center justify-center text-xs text-[var(--muted)]">
                  Processando…
                </div>
              )}
              {isSel && (
                <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--foreground)] text-[var(--background)] text-xs flex items-center justify-center">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-[var(--border)] bg-[var(--background)] p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{selected.size} fotos selecionadas</span>
              <span className="font-semibold">{formatBRL(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="email"
                required
                placeholder="email para entrega"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 rounded-md border border-[var(--border)] bg-transparent text-sm"
              />
              <input
                type="tel"
                placeholder="WhatsApp (opcional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="px-3 py-2 rounded-md border border-[var(--border)] bg-transparent text-sm"
              />
            </div>
            <button
              onClick={checkout}
              disabled={loading || !email}
              className="w-full py-3 rounded-md bg-[var(--foreground)] text-[var(--background)] font-medium disabled:opacity-50"
            >
              {loading ? "Gerando PIX…" : "Pagar com PIX"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
