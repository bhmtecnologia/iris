import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPixPayment } from "@/lib/mercadopago";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const schema = z.object({
  eventId: z.string().uuid(),
  searchId: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  const rl = rateLimit({ key: `orders:${clientIp(req)}`, limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }
  const body = schema.parse(await req.json());
  const admin = createAdminClient();

  const { data: search } = await admin
    .from("searches")
    .select("id, buyer_id, event_id, photo_ids, expires_at")
    .eq("id", body.searchId)
    .maybeSingle();
  if (!search || search.event_id !== body.eventId) {
    return NextResponse.json({ error: "invalid_search" }, { status: 400 });
  }
  if (new Date(search.expires_at) < new Date()) {
    return NextResponse.json({ error: "search_expired" }, { status: 410 });
  }
  const allowed = new Set(search.photo_ids);
  if (!body.photoIds.every((id) => allowed.has(id))) {
    return NextResponse.json({ error: "photo_not_in_search" }, { status: 400 });
  }

  const { data: event } = await admin
    .from("events")
    .select("id, name, price_cents")
    .eq("id", body.eventId)
    .single();
  if (!event) return NextResponse.json({ error: "event_not_found" }, { status: 404 });

  await admin.from("buyers").update({ email: body.email, phone: body.phone ?? null }).eq("id", search.buyer_id);

  const total = event.price_cents * body.photoIds.length;

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      buyer_id: search.buyer_id,
      event_id: body.eventId,
      photo_ids: body.photoIds,
      total_cents: total,
      search_id: search.id, // bind para gating do /status
    })
    .select("id")
    .single();
  if (error || !order) return NextResponse.json({ error: error?.message }, { status: 500 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pix = await createPixPayment({
    amountCents: total,
    description: `Íris · ${event.name} · ${body.photoIds.length} fotos`,
    payerEmail: body.email,
    externalReference: order.id,
    notificationUrl: `${appUrl}/api/webhooks/mercadopago`,
  });

  await admin
    .from("orders")
    .update({
      mp_payment_id: pix.id,
      mp_qr_code: pix.qrCode,
      mp_qr_code_base64: pix.qrCodeBase64,
    })
    .eq("id", order.id);

  logger.info("order.created", {
    orderId: order.id,
    eventId: body.eventId,
    photoCount: body.photoIds.length,
    totalCents: total,
    mpPaymentId: pix.id,
  });

  return NextResponse.json({ orderId: order.id });
}
