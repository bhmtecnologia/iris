import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: rwe } = await admin
    .from("real_world_events")
    .select("name, location, description, cover_photo_url")
    .eq("slug", slug)
    .eq("public_listing", true)
    .maybeSingle();
  if (!rwe) return { title: "Evento não encontrado · Íris" };
  return {
    title: `${rwe.name} · Íris`,
    description: rwe.description ?? `Encontre suas fotos do ${rwe.name} por reconhecimento facial.`,
    openGraph: {
      title: rwe.name,
      description: rwe.description ?? undefined,
      images: rwe.cover_photo_url ? [rwe.cover_photo_url] : undefined,
    },
  };
}

export default async function RWEDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: rwe } = await admin
    .from("real_world_events")
    .select(
      `id, slug, name, description, date, location, cover_photo_url, verified_by_iris,
       events:events!real_world_event_id (
         id, qr_token, name, price_cents, public_listing, status,
         organization:organizations (name),
         photos:photos!event_id (id, watermarked_path)
       )`
    )
    .eq("slug", slug)
    .eq("public_listing", true)
    .maybeSingle();

  if (!rwe) notFound();

  const coverages = (rwe.events ?? [])
    .filter((e) => e.public_listing && e.status === "active")
    .map((e) => ({
      id: e.id,
      qrToken: e.qr_token,
      name: e.name,
      priceCents: e.price_cents,
      orgName: (() => {
        const o = e.organization as { name?: string } | { name?: string }[] | null;
        if (!o) return "—";
        if (Array.isArray(o)) return o[0]?.name ?? "—";
        return o.name ?? "—";
      })(),
      photoCount: e.photos?.length ?? 0,
      cover: e.photos?.[0]?.watermarked_path
        ? admin.storage.from("watermarked").getPublicUrl(e.photos[0].watermarked_path).data.publicUrl
        : null,
    }));

  return (
    <main className="flex-1">
      <header className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">Íris</Link>
        <Link href="/eventos" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          ← todos os eventos
        </Link>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-12 pb-6">
        {rwe.verified_by_iris && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-black text-white text-[10px] uppercase tracking-wider">
            ✓ Verificado pela Íris
          </span>
        )}
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
          {rwe.name}
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          {rwe.location ?? "—"}
          {rwe.date && ` · ${new Date(rwe.date).toLocaleDateString("pt-BR", { dateStyle: "long" })}`}
        </p>
        {rwe.description && (
          <p className="mt-4 text-[var(--muted)] max-w-2xl">{rwe.description}</p>
        )}
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="mt-8 text-lg font-semibold tracking-tight">
          {coverages.length} {coverages.length === 1 ? "cobertura disponível" : "coberturas disponíveis"}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Selecione uma cobertura, dê uma selfie e veja suas fotos.
        </p>

        {coverages.length === 0 ? (
          <div className="mt-6 p-8 rounded-xl border border-dashed border-[var(--border)] text-center text-sm text-[var(--muted)]">
            Nenhuma cobertura ativa neste evento.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {coverages.map((c) => (
              <Link
                key={c.id}
                href={`/e/${c.qrToken}`}
                className="group flex gap-4 p-4 rounded-xl border border-[var(--border)] hover:border-[var(--foreground)] transition-colors"
              >
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-[var(--border)]/30 flex-shrink-0">
                  {c.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.cover} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium tracking-tight line-clamp-1">{c.orgName}</div>
                  <div className="mt-0.5 text-xs text-[var(--muted)] line-clamp-1">{c.name}</div>
                  <div className="mt-3 flex items-baseline gap-3 text-sm">
                    <span className="font-semibold">{formatBRL(c.priceCents)}</span>
                    <span className="text-xs text-[var(--muted)]">por foto</span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{c.photoCount} fotos disponíveis</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
