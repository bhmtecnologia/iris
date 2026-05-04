import crypto from "node:crypto";
import { STUB_MERCADOPAGO } from "./dev-stubs";

const MP_API = "https://api.mercadopago.com";

function authHeaders(idempotencyKey?: string) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
  };
  if (idempotencyKey) h["X-Idempotency-Key"] = idempotencyKey;
  return h;
}

export type PixPayment = {
  id: string;
  qrCode: string;
  qrCodeBase64: string;
  status: string;
  ticketUrl?: string;
};

// In-memory store of stub payments for dev.
const stubPayments = new Map<string, { externalReference: string; status: string }>();
const STUB_AUTOPAY_MS = 8000;
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
    const id = `STUB${Date.now()}${Math.floor(Math.random() * 1000)}`;
    stubPayments.set(id, { externalReference: params.externalReference, status: "pending" });
    setTimeout(() => {
      const p = stubPayments.get(id);
      if (p) p.status = "approved";
      fetch(`${params.notificationUrl}?data.id=${id}&type=payment`, {
        method: "POST",
        headers: { "x-stub-mp": "1" },
      }).catch(() => {});
    }, STUB_AUTOPAY_MS);
    return {
      id,
      qrCode: `00020126STUB-PIX-${params.externalReference}`,
      qrCodeBase64: STUB_QR_PNG_BASE64,
      status: "pending",
    };
  }

  const amount = (params.amountCents / 100).toFixed(2);
  const isLocalhost = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(params.notificationUrl);

  // MP sandbox exige payer email "@testuser.com". Em produção, usa o real.
  const isSandboxToken = (process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "").startsWith("TEST-")
    || /test_user/i.test(process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "");
  // Detecta APP_USR de test seller olhando o sellerType — fazemos isso mais barato:
  // em sandbox, sempre forçamos o email pra @testuser.com.
  const payerEmail = isSandboxToken || process.env.NODE_ENV !== "production"
    ? `buyer_${params.externalReference.slice(0, 8)}@testuser.com`
    : params.payerEmail;

  const body = {
    type: "online",
    total_amount: amount,
    external_reference: params.externalReference,
    description: params.description,
    transactions: {
      payments: [
        {
          amount,
          payment_method: { id: "pix", type: "bank_transfer" },
        },
      ],
    },
    payer: {
      email: payerEmail,
      first_name: "Comprador",
      last_name: "Iris",
      identification: { type: "CPF", number: "19119119100" },
    },
    ...(isLocalhost ? {} : { notification_url: params.notificationUrl }),
  };

  const res = await fetch(`${MP_API}/v1/orders`, {
    method: "POST",
    headers: authHeaders(crypto.randomUUID()),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`MP /v1/orders ${res.status}: ${data.message ?? JSON.stringify(data)}`);
  }

  const payment = data.transactions?.payments?.[0];
  const pm = payment?.payment_method;
  return {
    id: data.id,
    qrCode: pm?.qr_code ?? "",
    qrCodeBase64: pm?.qr_code_base64 ?? "",
    status: data.status,
    ticketUrl: pm?.ticket_url,
  };
}

export type OrderResource = {
  id: string;
  status: string;
  external_reference?: string;
  transactions?: { payments?: { id: string; status: string }[] };
};

export async function getPayment(orderId: string): Promise<OrderResource> {
  if (STUB_MERCADOPAGO) {
    const p = stubPayments.get(orderId);
    return {
      id: orderId,
      status: p?.status ?? "pending",
      external_reference: p?.externalReference,
    };
  }
  const res = await fetch(`${MP_API}/v1/orders/${orderId}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(`MP GET /v1/orders/${orderId} ${res.status}: ${data.message}`);
  return data;
}

/**
 * Normaliza diferentes status do MP em "approved" / "pending" / "failed".
 * `/v1/orders` usa `processed`, `action_required`, `cancelled`, etc.
 */
export function isApproved(order: OrderResource): boolean {
  if (order.status === "processed") return true;
  // legacy /v1/payments format (caso webhook mande payment id antigo)
  if (order.status === "approved") return true;
  return false;
}

/**
 * Validates MP webhook signature (formato legacy + novo).
 * Header: x-signature: ts=...,v1=...
 * Manifest: id:<dataId>;request-id:<requestId>;ts:<ts>;
 *
 * Inclui:
 *  - ts freshness (anti-replay; janela de 5min)
 *  - length-safe HMAC compare (não joga se v1 vier curto)
 */
const WEBHOOK_TS_WINDOW_MS = 5 * 60 * 1000;

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

  // ts freshness — MP envia em milissegundos
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(Date.now() - tsNum) > WEBHOOK_TS_WINDOW_MS) return false;

  const manifest = `id:${dataId};request-id:${requestIdHeader};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  // length-check antes do timingSafeEqual (evita throw em buffers de tamanho diferente)
  const expectedBuf = Buffer.from(expected, "utf8");
  const v1Buf = Buffer.from(v1, "utf8");
  if (expectedBuf.length !== v1Buf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, v1Buf);
}
