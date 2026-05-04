/**
 * Smoke test do Mercado Pago.
 * Roda contra as credenciais em .env.local e reporta se PIX está funcionando.
 *
 * Use: pnpm mp:smoke
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import crypto from "node:crypto";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

const TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

if (!TOKEN || TOKEN === "dev-placeholder") {
  console.log("⏸  MERCADO_PAGO_ACCESS_TOKEN é placeholder — stub local ativo, MP real não configurado.");
  console.log("    Stub auto-aprova pagamentos em 8s. App pronto para dev.");
  process.exit(0);
}

const isTest = TOKEN.startsWith("TEST-");
const isAppUsr = TOKEN.startsWith("APP_USR-");

console.log(`🔑 Token: ${isTest ? "TEST" : isAppUsr ? "APP_USR" : "?"} (${TOKEN.slice(0, 10)}…)`);
console.log("");

async function main() {
  // 1. Identifica o dono
  console.log("→ /users/me");
  const me = await (await fetch(`https://api.mercadopago.com/users/me?access_token=${TOKEN}`)).json();
  if (me.error) {
    console.error("  ✗", me.message);
    process.exit(1);
  }
  console.log(`  ✓ ${me.nickname} (${me.email}) [tags: ${me.tags?.join(",") ?? "—"}]`);
  const isSandboxUser = me.tags?.includes("test_user");
  console.log(`  ${isSandboxUser ? "🧪 sandbox (test user)" : "🚨 PRODUÇÃO REAL"}`);

  // 2. Confere métodos disponíveis
  console.log("\n→ /v1/payment_methods");
  const methods = await (await fetch(`https://api.mercadopago.com/v1/payment_methods?access_token=${TOKEN}`)).json();
  const hasPix = Array.isArray(methods) && methods.some((m: { id: string }) => m.id === "pix");
  const cards = Array.isArray(methods)
    ? methods.filter((m: { payment_type_id: string }) => m.payment_type_id === "credit_card").map((m: { id: string }) => m.id)
    : [];
  console.log(`  ${hasPix ? "✓" : "✗"} PIX disponível`);
  console.log(`  ${cards.length ? "✓" : "✗"} Cartões: ${cards.join(", ") || "—"}`);

  // 3. Tenta criar um PIX (nova API /v1/orders)
  console.log("\n→ POST /v1/orders (PIX R$ 1,00)");
  const r = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      "X-Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      type: "online",
      total_amount: "1.00",
      external_reference: `smoke_${Date.now()}`,
      description: "Iris smoke",
      transactions: {
        payments: [{ amount: "1.00", payment_method: { id: "pix", type: "bank_transfer" } }],
      },
      payer: {
        email: `buyer_smoke_${Date.now()}@testuser.com`,
        first_name: "Smoke",
        last_name: "Test",
        identification: { type: "CPF", number: "19119119100" },
      },
    }),
  });
  const body = await r.json();
  if (r.ok && body.id) {
    console.log(`  ✅ Order criada! id=${body.id}, status=${body.status}`);
    const qr = body.transactions?.payments?.[0]?.payment_method?.qr_code;
    if (qr) console.log(`  qr_code: ${qr.slice(0, 60)}…`);
    console.log("\n🎉 MP totalmente funcional. Pode trocar `dev-placeholder` no .env.local.");
  } else {
    console.error(`  ✗ status=${r.status}`);
    console.error(`     ${body.message ?? JSON.stringify(body)}`);
    if (body.cause?.length) console.error(`     causa:`, body.cause);
    console.log("\n⚠️  PIX ainda bloqueado. Mantenha o stub (MERCADO_PAGO_ACCESS_TOKEN=dev-placeholder).");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error("erro:", e.message ?? e);
  process.exit(1);
});
