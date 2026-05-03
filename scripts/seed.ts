/**
 * Local dev seed.
 * Creates a demo photographer (auth user), a demo event, and N processed photos
 * (originals + watermarked) so the client journey works end-to-end.
 *
 * Run with: pnpm seed
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PHOTO_COUNT = Number(process.env.SEED_PHOTOS ?? 12);
const PHOTOG_EMAIL = process.env.SEED_EMAIL ?? "demo@iris.local";
const PHOTOG_PASSWORD = process.env.SEED_PASSWORD ?? "iris-demo-2025";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase env vars. Run `supabase start` first.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("→ Garantindo usuário fotógrafo:", PHOTOG_EMAIL);

  // Find or create the auth user.
  const { data: usersList } = await admin.auth.admin.listUsers();
  let user = usersList?.users?.find((u) => u.email === PHOTOG_EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: PHOTOG_EMAIL,
      password: PHOTOG_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log("  ✓ usuário criado");
  } else {
    console.log("  ✓ usuário existente");
  }

  // Photographer row.
  let { data: photographer } = await admin
    .from("photographers")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!photographer) {
    const ins = await admin
      .from("photographers")
      .insert({ user_id: user!.id, name: "Demo Fotógrafo" })
      .select("id")
      .single();
    photographer = ins.data;
    console.log("  ✓ photographer row criado");
  }

  // Event.
  const eventName = `Corrida da Lapa · Demo ${new Date().toLocaleDateString("pt-BR")}`;
  const { data: event, error: evErr } = await admin
    .from("events")
    .insert({
      photographer_id: photographer!.id,
      name: eventName,
      location: "Rio de Janeiro · RJ",
      date: new Date().toISOString().slice(0, 10),
      price_cents: 1500,
      status: "active",
    })
    .select("id, qr_token")
    .single();
  if (evErr) throw evErr;
  console.log("→ Evento criado:", event.id, "qrToken=", event.qr_token);

  // Download N stock photos and store both original + watermarked.
  console.log(`→ Subindo ${PHOTO_COUNT} fotos…`);

  for (let i = 0; i < PHOTO_COUNT; i++) {
    const seed = `iris-${event.id}-${i}`;
    const url = `https://picsum.photos/seed/${seed}/1600/1200`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ! falha ao baixar ${url}: ${res.status}`);
      continue;
    }
    const original = Buffer.from(await res.arrayBuffer());

    const wm = await applyWatermark(original);

    const originalPath = `${event.id}/seed-${i}.jpg`;
    const wmPath = `wm/${event.id}/seed-${i}.jpg`;

    const up1 = await admin.storage
      .from("originals")
      .upload(originalPath, original, { contentType: "image/jpeg", upsert: true });
    if (up1.error) throw up1.error;

    const up2 = await admin.storage
      .from("watermarked")
      .upload(wmPath, wm, { contentType: "image/jpeg", upsert: true });
    if (up2.error) throw up2.error;

    const { data: photo, error: phErr } = await admin
      .from("photos")
      .insert({
        event_id: event.id,
        original_path: originalPath,
        watermarked_path: wmPath,
        rekognition_face_ids: [`stub-seed-${i}`],
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (phErr) throw phErr;
    process.stdout.write(`  ✓ ${i + 1}/${PHOTO_COUNT}\r`);
    void photo;
  }
  console.log("\n");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000";
  console.log("✅ Seed completo.\n");
  console.log("   Login do fotógrafo:");
  console.log(`     email:    ${PHOTOG_EMAIL}`);
  console.log(`     senha:    ${PHOTOG_PASSWORD}`);
  console.log(`     URL:      ${appUrl}/login-dev`);
  console.log("");
  console.log("   Jornada do cliente (escaneie/abra no celular):");
  console.log(`     ${appUrl}/e/${event.qr_token}`);
}

const TEXT = "ÍRIS · PREVIEW";
async function applyWatermark(input: Buffer) {
  const image = sharp(input).rotate();
  const meta = await image.metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 800;
  const fontSize = Math.round(Math.min(w, h) / 18);
  const tile = Math.round(Math.min(w, h) / 3);

  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" patternUnits="userSpaceOnUse" width="${tile}" height="${tile}" patternTransform="rotate(-30)">
          <text x="0" y="${fontSize}" font-family="Helvetica, Arial, sans-serif"
                font-size="${fontSize}" font-weight="700" fill="rgba(255,255,255,0.35)"
                stroke="rgba(0,0,0,0.25)" stroke-width="1">${TEXT}</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)" />
    </svg>`;

  return image
    .resize({ width: Math.min(w, 1600), withoutEnlargement: true })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 78 })
    .toBuffer();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
