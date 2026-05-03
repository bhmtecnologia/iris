import { MercadoPagoConfig, Payment } from "mercadopago";
import crypto from "node:crypto";
import { STUB_MERCADOPAGO } from "./dev-stubs";

const config = STUB_MERCADOPAGO
  ? null
  : new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN! });

export type PixPayment = {
  id: number;
  qrCode: string;
  qrCodeBase64: string;
  status: string;
};

// In-memory store of stub payments for dev. Auto-marks as approved after a delay.
const stubPayments = new Map<number, { externalReference: string; status: string }>();
const STUB_AUTOPAY_MS = 8000;

// 1×1 transparent PNG as a placeholder QR image.
const STUB_QR_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export async function createPixPayment(params: {
  amountCents: number;
  description: string;
  payerEmail: string;
  externalReference: string;
  notificationUrl: string;
}): Promise<PixPayment> {
  if (STUB_MERCADOPAGO) {
    const id = Math.floor(Math.random() * 1_000_000_000);
    stubPayments.set(id, { externalReference: params.externalReference, status: "pending" });
    setTimeout(() => {
      const p = stubPayments.get(id);
      if (p) p.status = "approved";
      // Fire the local webhook so the order is marked paid + delivery jobs run.
      fetch(`${params.notificationUrl}?data.id=${id}&type=payment`, {
        method: "POST",
        headers: { "x-stub-mp": "1" },
      }).catch(() => {});
    }, STUB_AUTOPAY_MS);
    return {
      id,
      qrCode: `00020126STUB-PIX-${params.externalReference}-${params.amountCents}5204000053039865802BR6304ABCD`,
      qrCodeBase64: STUB_QR_PNG_BASE64,
      status: "pending",
    };
  }

  const payment = new Payment(config!);
  const result = await payment.create({
    body: {
      transaction_amount: params.amountCents / 100,
      description: params.description,
      payment_method_id: "pix",
      payer: { email: params.payerEmail },
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
    },
  });

  const tx = result.point_of_interaction?.transaction_data;
  return {
    id: result.id!,
    qrCode: tx?.qr_code ?? "",
    qrCodeBase64: tx?.qr_code_base64 ?? "",
    status: result.status ?? "pending",
  };
}

export async function getPayment(paymentId: number) {
  if (STUB_MERCADOPAGO) {
    const p = stubPayments.get(paymentId);
    return {
      id: paymentId,
      status: p?.status ?? "pending",
      external_reference: p?.externalReference,
    };
  }
  const payment = new Payment(config!);
  return payment.get({ id: paymentId });
}

/**
 * Validates MP webhook signature.
 * Header format: x-signature: ts=...,v1=...
 * Manifest: id:<dataId>;request-id:<requestId>;ts:<ts>;
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string;
  secret: string;
}): boolean {
  const { signatureHeader, requestIdHeader, dataId, secret } = params;
  if (!signatureHeader || !requestIdHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim())) as [string, string][]
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestIdHeader};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
