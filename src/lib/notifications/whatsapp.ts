/**
 * Z-API integration. Docs: https://developer.z-api.io
 * Requires an active WhatsApp instance.
 */
import { STUB_WHATSAPP } from "../dev-stubs";

const BASE = "https://api.z-api.io/instances";

export async function sendDownloadWhatsApp(params: {
  phone: string; // 5511999998888
  eventName: string;
  downloadLinks: string[];
}) {
  if (STUB_WHATSAPP) {
    console.log("[stub:whatsapp] →", params.phone, params.eventName, params.downloadLinks);
    return { ok: true };
  }
  const instance = process.env.ZAPI_INSTANCE_ID!;
  const token = process.env.ZAPI_TOKEN!;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN!;

  const body = [
    `*Íris* — Suas fotos de ${params.eventName} estão prontas!`,
    "",
    "Links válidos por 7 dias:",
    ...params.downloadLinks.map((u, i) => `${i + 1}. ${u}`),
  ].join("\n");

  const res = await fetch(`${BASE}/${instance}/token/${token}/send-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
    },
    body: JSON.stringify({ phone: params.phone, message: body }),
  });
  if (!res.ok) throw new Error(`Z-API: ${res.status} ${await res.text()}`);
  return res.json();
}
