import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayment, verifyWebhookSignature } from "@/lib/mercadopago";
import { sendDownloadEmail } from "@/lib/notifications/email";
import { sendDownloadWhatsApp } from "@/lib/notifications/whatsapp";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (secret) {
    const valid = verifyWebhookSignature({
      signatureHeader: req.headers.get("x-signature"),
      requestIdHeader: req.headers.get("x-request-id"),
      dataId: dataId ?? "",
      secret,
    });
    if (!valid) {
      logger.warn("mp_webhook.invalid_signature", { dataId });
      return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
    }
  }

  if (!dataId) return NextResponse.json({ ok: true });

  const payment = await getPayment(Number(dataId));
  if (!payment.external_reference) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  logger.info("mp_webhook.received", {
    dataId,
    paymentStatus: payment.status,
    orderId: payment.external_reference,
  });

  if (payment.status === "approved") {
    const { data: order } = await admin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", payment.external_reference)
      .eq("status", "pending")
      .select("id, photo_ids, event_id, buyer_id")
      .maybeSingle();

    if (order) {
      logger.info("order.paid", { orderId: order.id, photoCount: order.photo_ids.length });
      const { data: buyer } = await admin
        .from("buyers")
        .select("email, phone")
        .eq("id", order.buyer_id)
        .single();

      const { data: event } = await admin
        .from("events")
        .select("name")
        .eq("id", order.event_id)
        .single();

      const { data: photos } = await admin
        .from("photos")
        .select("original_path")
        .in("id", order.photo_ids);

      const links = await Promise.all(
        (photos ?? []).map(async (p) => {
          const { data } = await admin.storage
            .from("originals")
            .createSignedUrl(p.original_path, 60 * 60 * 24 * 7);
          return data?.signedUrl;
        })
      );
      const downloadLinks = links.filter((u): u is string => !!u);

      if (buyer?.email) {
        try {
          await sendDownloadEmail({
            to: buyer.email,
            eventName: event?.name ?? "Íris",
            downloadLinks,
          });
          await admin.from("deliveries").insert({ order_id: order.id, channel: "email", sent_at: new Date().toISOString() });
        } catch (e) {
          logger.error("delivery.email_failed", e, { orderId: order.id });
          await admin.from("deliveries").insert({ order_id: order.id, channel: "email", error: String(e) });
        }
      }
      if (buyer?.phone) {
        try {
          await sendDownloadWhatsApp({
            phone: buyer.phone.replace(/\D/g, ""),
            eventName: event?.name ?? "Íris",
            downloadLinks,
          });
          await admin.from("deliveries").insert({ order_id: order.id, channel: "whatsapp", sent_at: new Date().toISOString() });
        } catch (e) {
          logger.error("delivery.whatsapp_failed", e, { orderId: order.id });
          await admin.from("deliveries").insert({ order_id: order.id, channel: "whatsapp", error: String(e) });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
