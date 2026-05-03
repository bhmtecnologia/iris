import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/utils";
import { createEventAction } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("id, name, location, date, price_cents, status, qr_token")
    .order("created_at", { ascending: false });

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Eventos</h1>
        <span className="text-sm text-[var(--muted)]">{events?.length ?? 0} no total</span>
      </div>

      <form action={createEventAction} className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 p-5 rounded-xl border border-[var(--border)]">
        <input name="name" required placeholder="Nome do evento" className="px-3 py-2 rounded-md border border-[var(--border)] bg-transparent" />
        <input name="location" placeholder="Local" className="px-3 py-2 rounded-md border border-[var(--border)] bg-transparent" />
        <input name="date" type="date" className="px-3 py-2 rounded-md border border-[var(--border)] bg-transparent" />
        <input name="price" type="number" min={0} step="0.01" required placeholder="Preço por foto (R$)" className="px-3 py-2 rounded-md border border-[var(--border)] bg-transparent" />
        <button className="md:col-span-2 py-2 rounded-md bg-[var(--foreground)] text-[var(--background)] font-medium">
          Criar evento
        </button>
      </form>

      <ul className="mt-8 divide-y divide-[var(--border)] border-t border-b border-[var(--border)]">
        {events?.map((e) => (
          <li key={e.id} className="py-4 flex items-center justify-between gap-4">
            <Link href={`/dashboard/eventos/${e.id}`} className="flex-1 min-w-0">
              <div className="font-medium truncate">{e.name}</div>
              <div className="text-sm text-[var(--muted)] truncate">
                {e.location ?? "—"} · {e.date ?? "sem data"} · {formatBRL(e.price_cents)}
              </div>
            </Link>
            <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{e.status}</span>
          </li>
        ))}
        {(!events || events.length === 0) && (
          <li className="py-8 text-center text-sm text-[var(--muted)]">Nenhum evento ainda.</li>
        )}
      </ul>
    </main>
  );
}
