import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/utils";
import { setEventStatus, deleteEvent } from "./actions";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, location, date, price_cents, status, qr_token")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const { data: photos, count: photosCount } = await supabase
    .from("photos")
    .select("id, watermarked_path, processed_at", { count: "exact" })
    .eq("event_id", id)
    .order("created_at", { ascending: false })
    .limit(48);

  const admin = createAdminClient();
  const photoItems = (photos ?? []).map((p) => {
    const url = p.watermarked_path
      ? admin.storage.from("watermarked").getPublicUrl(p.watermarked_path).data.publicUrl
      : null;
    return { id: p.id, url, processed: !!p.processed_at };
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000";
  const qrUrl = `${appUrl}/e/${event.qr_token}`;
  const qrSvg = await QRCode.toString(qrUrl, { type: "svg", margin: 1, width: 220 });

  const setStatus = setEventStatus.bind(null, event.id);
  const remove = deleteEvent.bind(null, event.id);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-baseline gap-4 justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-[var(--muted)]">← eventos</Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {event.location ?? "—"} · {event.date ?? "sem data"} · {formatBRL(event.price_cents)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/eventos/${event.id}/upload`}
            className="px-4 py-2 rounded-md bg-[var(--foreground)] text-[var(--background)] text-sm font-medium"
          >
            Subir fotos
          </Link>
          <Link
            href={`/dashboard/eventos/${event.id}/vendas`}
            className="px-4 py-2 rounded-md border border-[var(--border)] text-sm"
          >
            Vendas
          </Link>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-[var(--border)] md:col-span-1">
          <div className="text-sm text-[var(--muted)]">QR Code</div>
          <div className="mt-3 flex justify-center" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="mt-3 text-xs break-all text-[var(--muted)] text-center">{qrUrl}</div>
        </div>

        <div className="p-5 rounded-xl border border-[var(--border)] md:col-span-2 flex flex-col">
          <div className="text-sm text-[var(--muted)]">Status do evento</div>

          <div className="mt-3 flex gap-2 flex-wrap">
            {(["draft", "active", "archived"] as const).map((s) => (
              <form key={s} action={setStatus.bind(null, s)}>
                <button
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider rounded-md border transition-colors ${
                    event.status === s
                      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {s === "draft" ? "Rascunho" : s === "active" ? "Ativo" : "Arquivado"}
                </button>
              </form>
            ))}
          </div>

          <p className="mt-3 text-xs text-[var(--muted)]">
            Apenas eventos <strong>ativos</strong> aceitam selfies de busca dos clientes.
          </p>

          <div className="mt-auto pt-6 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Fotos" value={String(photosCount ?? 0)} />
            <Stat label="Preço" value={formatBRL(event.price_cents)} />
          </div>
        </div>
      </div>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Galeria</h2>
          <span className="text-sm text-[var(--muted)]">
            {photoItems.length} de {photosCount ?? 0}
          </span>
        </div>
        {photoItems.length === 0 ? (
          <div className="mt-6 p-8 rounded-xl border border-dashed border-[var(--border)] text-center text-sm text-[var(--muted)]">
            Nenhuma foto ainda. Suba a primeira tanda.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {photoItems.map((p) => (
              <div key={p.id} className="aspect-square overflow-hidden rounded-lg bg-[var(--border)]/40 relative">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted)]">
                    {p.processed ? "—" : "Processando"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-16 pt-8 border-t border-[var(--border)]">
        <div className="text-sm text-[var(--muted)]">Zona de risco</div>
        <form action={remove} className="mt-3">
          <button className="px-4 py-2 rounded-md border border-red-500/40 text-red-500 text-sm hover:bg-red-500/10">
            Excluir evento e todas as fotos
          </button>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Remove originais, watermarks, coleção facial e histórico. Vendas pagas permanecem nos relatórios.
          </p>
        </form>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}
