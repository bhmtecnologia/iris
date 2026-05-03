import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SelfieCapture } from "./selfie-client";

export default async function EventLandingPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("events")
    .select("id, name, location, date, price_cents, status")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (!event || event.status !== "active") notFound();

  return (
    <main className="flex-1 flex flex-col items-center px-6 pt-12 pb-24">
      <div className="max-w-md w-full text-center">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{event.location ?? "Evento"}</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{event.name}</h1>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Para encontrar suas fotos, precisamos comparar uma selfie com os rostos
          detectados. Sua selfie é apagada automaticamente em 24h.
        </p>

        <div className="mt-8">
          <SelfieCapture eventId={event.id} qrToken={qrToken} />
        </div>

        <p className="mt-8 text-xs text-[var(--muted)]">
          Ao continuar você concorda com nossa{" "}
          <a href="/privacidade" className="underline underline-offset-4">política de privacidade (LGPD)</a>.
        </p>
      </div>
    </main>
  );
}
