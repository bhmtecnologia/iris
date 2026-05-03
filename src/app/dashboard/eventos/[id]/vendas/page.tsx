import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/utils";

export default async function SalesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("orders")
    .select("id, total_cents, status, paid_at, photo_ids, created_at")
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const paid = (orders ?? []).filter((o) => o.status === "paid");
  const totalPaid = paid.reduce((s, o) => s + o.total_cents, 0);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Vendas — {event.name}</h1>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card label="Vendas pagas" value={String(paid.length)} />
        <Card label="Receita" value={formatBRL(totalPaid)} />
        <Card label="Pedidos totais" value={String(orders?.length ?? 0)} />
      </div>

      <table className="mt-10 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
            <th className="py-2">Pedido</th>
            <th>Fotos</th>
            <th>Total</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {(orders ?? []).map((o) => (
            <tr key={o.id}>
              <td className="py-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
              <td>{o.photo_ids.length}</td>
              <td>{formatBRL(o.total_cents)}</td>
              <td className="uppercase text-xs tracking-wider">{o.status}</td>
              <td className="text-[var(--muted)]">{new Date(o.created_at).toLocaleString("pt-BR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-[var(--border)]">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
