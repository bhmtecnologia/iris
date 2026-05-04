import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatBRL } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; cidade?: string };

export default async function EventosListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, cidade } = await searchParams;
  const admin = createAdminClient();

  let query = admin
    .from("real_world_events")
    .select(
      `id, slug, name, date, location, cover_photo_url, verified_by_iris,
       events:events!real_world_event_id (id, price_cents, public_listing, status,
         photos:photos!event_id (id))`
    )
    .eq("public_listing", true)
    .order("verified_by_iris", { ascending: false })
    .order("date", { ascending: false, nullsFirst: false })
    .limit(48);

  if (q) query = query.ilike("name", `%${q}%`);
  if (cidade) query = query.ilike("location", `%${cidade}%`);

  const { data: rwes } = await query;

  const items = (rwes ?? []).map((rwe) => {
    const activeCoverages = (rwe.events ?? []).filter(
      (e) => e.public_listing && e.status === "active"
    );
    const photoCount = activeCoverages.reduce(
      (s, e) => s + ((e.photos ?? []).length ?? 0),
      0
    );
    const prices = activeCoverages
      .map((e) => e.price_cents)
      .filter((p): p is number => typeof p === "number");
    const minPrice = prices.length ? Math.min(...prices) : null;
    const maxPrice = prices.length ? Math.max(...prices) : null;

    let cover = rwe.cover_photo_url;
    if (!cover) {
      // fallback: pega 1ª foto da 1ª cobertura
      const firstCoverage = activeCoverages[0];
      const firstPhoto = firstCoverage?.photos?.[0];
      if (firstPhoto) {
        cover = admin.storage.from("watermarked").getPublicUrl(
          `wm/${firstCoverage.id}/seed-0.jpg`
        ).data.publicUrl;
      }
    }

    return { ...rwe, photoCount, minPrice, maxPrice, cover, coverageCount: activeCoverages.length };
  });

  return (
    <main className="flex-1">
      <header className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">Íris</Link>
        <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Sou fotógrafo →
        </Link>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-12 pb-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Encontre seu evento</h1>
        <p className="mt-2 text-[var(--muted)]">
          Achou seu rosto? É só dar uma selfie e a Íris encontra suas fotos.
        </p>

        <form className="mt-8 flex gap-2 max-w-2xl">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome do evento (ex: Cruzeiro, Maratona BSB)"
            className="flex-1 px-4 py-3 rounded-lg border border-[var(--border)] bg-transparent outline-none focus:border-[var(--foreground)]"
          />
          <input
            type="search"
            name="cidade"
            defaultValue={cidade}
            placeholder="Cidade"
            className="w-40 px-4 py-3 rounded-lg border border-[var(--border)] bg-transparent outline-none focus:border-[var(--foreground)]"
          />
          <button className="px-6 py-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium">
            Buscar
          </button>
        </form>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        {items.length === 0 ? (
          <div className="mt-8 p-12 rounded-xl border border-dashed border-[var(--border)] text-center text-[var(--muted)]">
            Nenhum evento {q || cidade ? "encontrado com esse filtro" : "publicado ainda"}.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/eventos/${item.slug}`}
                className="group block rounded-xl overflow-hidden border border-[var(--border)] hover:border-[var(--foreground)] transition-colors"
              >
                <div className="aspect-[4/3] relative bg-[var(--border)]/30 overflow-hidden">
                  {item.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.cover}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[var(--muted)]">
                      sem capa
                    </div>
                  )}
                  {item.verified_by_iris && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] uppercase tracking-wider">
                      ✓ Verificado
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold tracking-tight line-clamp-1">{item.name}</h3>
                  <p className="mt-1 text-xs text-[var(--muted)] line-clamp-1">
                    {item.location ?? "—"}
                    {item.date && ` · ${new Date(item.date).toLocaleDateString("pt-BR")}`}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>
                      {item.coverageCount} {item.coverageCount === 1 ? "fotógrafo" : "fotógrafos"} ·{" "}
                      {item.photoCount} fotos
                    </span>
                    {item.minPrice != null && (
                      <span className="font-medium text-[var(--foreground)]">
                        {item.minPrice === item.maxPrice
                          ? formatBRL(item.minPrice)
                          : `${formatBRL(item.minPrice!)}–${formatBRL(item.maxPrice!)}`}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
