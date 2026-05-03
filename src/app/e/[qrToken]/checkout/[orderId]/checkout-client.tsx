"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/utils";

type Order = {
  id: string;
  total_cents: number;
  status: string;
  mp_qr_code: string | null;
  mp_qr_code_base64: string | null;
};

export function CheckoutClient({ order }: { order: Order }) {
  const [status, setStatus] = useState(order.status);
  const [downloads, setDownloads] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === "paid") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/orders/${order.id}/status`);
      if (!res.ok) return;
      const data = (await res.json()) as { status: string; downloads?: string[] };
      setStatus(data.status);
      if (data.downloads) setDownloads(data.downloads);
    }, 3000);
    return () => clearInterval(t);
  }, [order.id, status]);

  if (status === "paid" && downloads) {
    return (
      <main className="flex-1 px-6 py-12 max-w-md mx-auto">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-600">✓</div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Pagamento confirmado</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Os links também foram enviados por email e WhatsApp.
          </p>
        </div>
        <ul className="mt-8 space-y-2">
          {downloads.map((url, i) => (
            <li key={url}>
              <a
                href={url}
                className="block w-full py-3 px-4 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--border)]/40 transition-colors text-center"
              >
                Baixar foto {i + 1}
              </a>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="flex-1 px-6 py-12 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Pague com PIX</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Total: <strong>{formatBRL(order.total_cents)}</strong>. A liberação é automática.
      </p>

      {order.mp_qr_code_base64 && (
        <div className="mt-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/png;base64,${order.mp_qr_code_base64}`}
            alt="QR Code PIX"
            className="w-64 h-64"
          />
        </div>
      )}

      {order.mp_qr_code && (
        <div className="mt-6">
          <button
            onClick={() => {
              navigator.clipboard.writeText(order.mp_qr_code!);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="w-full py-3 rounded-md bg-[var(--foreground)] text-[var(--background)] font-medium"
          >
            {copied ? "Copiado!" : "Copiar código PIX"}
          </button>
          <p className="mt-3 text-xs text-[var(--muted)] break-all">{order.mp_qr_code}</p>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-[var(--muted)]">
        Aguardando confirmação do pagamento…
      </p>
    </main>
  );
}
