/**
 * Dev-only stubs. Active when env vars are still the placeholder values
 * shipped in `.env.local`. Lets the full client journey work without AWS or
 * Mercado Pago accounts. Never activates in production builds.
 */
export const STUB_REKOGNITION =
  process.env.NODE_ENV !== "production" &&
  process.env.AWS_ACCESS_KEY_ID === "dev-placeholder";

export const STUB_MERCADOPAGO =
  process.env.NODE_ENV !== "production" &&
  process.env.MERCADO_PAGO_ACCESS_TOKEN === "dev-placeholder";

export const STUB_RESEND =
  process.env.NODE_ENV !== "production" &&
  (process.env.RESEND_API_KEY ?? "").startsWith("re_dev_");

export const STUB_WHATSAPP =
  process.env.NODE_ENV !== "production" && !process.env.ZAPI_INSTANCE_ID;
