import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ResultsGrid } from "./results-client";

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ qrToken: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { qrToken } = await params;
  const { s } = await searchParams;
  if (!s) redirect(`/e/${qrToken}`);

  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id, name, price_cents")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (!event) notFound();

  const { data: search } = await admin
    .from("searches")
    .select("id, photo_ids, expires_at, event_id")
    .eq("id", s)
    .maybeSingle();
  if (!search || search.event_id !== event.id) notFound();

  const { data: photos } = await admin
    .from("photos")
    .select("id, watermarked_path")
    .in("id", search.photo_ids)
    .order("created_at");

  const items = await Promise.all(
    (photos ?? []).map(async (p) => {
      if (!p.watermarked_path) return { id: p.id, url: null };
      const { data } = admin.storage.from("watermarked").getPublicUrl(p.watermarked_path);
      return { id: p.id, url: data.publicUrl };
    })
  );

  return (
    <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {items.length} {items.length === 1 ? "foto encontrada" : "fotos encontradas"}.
        Selecione as que deseja comprar.
      </p>
      <ResultsGrid
        items={items}
        eventId={event.id}
        searchId={search.id}
        priceCents={event.price_cents}
        qrToken={qrToken}
      />
    </main>
  );
}
