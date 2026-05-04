/**
 * Local dev seed.
 * Creates demo organizations, photographers (auth users), real-world events
 * (RWEs), coverages (events), and processed photos.
 *
 * Idempotente: skip se já existe (checa por slug).
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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing Supabase env vars. Run `supabase start` first.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ============================================================================
// Catálogo de eventos demo
// ============================================================================

type Photographer = {
  email: string;
  password: string;
  orgName: string;
  orgSlug: string;
  orgType: "individual" | "company";
};

type Coverage = {
  photographer: string; // chave do PHOTOGRAPHERS map
  priceCents: number;
  photoCount: number;
};

type DemoEvent = {
  slug: string;
  name: string;
  description: string;
  date: string;
  location: string;
  verified: boolean;
  coverages: Coverage[];
};

const PHOTOGRAPHERS: Record<string, Photographer> = {
  demo: {
    email: "demo@iris.local",
    password: "iris-demo-2025",
    orgName: "Demo Studio",
    orgSlug: "demo-studio",
    orgType: "company",
  },
  esportes: {
    email: "esportes@iris.local",
    password: "iris-demo-2025",
    orgName: "Esportes em Foco",
    orgSlug: "esportes-em-foco",
    orgType: "company",
  },
  flash: {
    email: "flash@iris.local",
    password: "iris-demo-2025",
    orgName: "Flash Eventos",
    orgSlug: "flash-eventos",
    orgType: "company",
  },
  carla: {
    email: "carla@iris.local",
    password: "iris-demo-2025",
    orgName: "Carla Mendes Fotografia",
    orgSlug: "carla-mendes",
    orgType: "individual",
  },
};

const EVENTS: DemoEvent[] = [
  {
    slug: "cruzeiro-x-galo-brasileirao-2026",
    name: "Cruzeiro x Atlético-MG · Brasileirão 2026",
    description:
      "Clássico mineiro válido pelo Brasileirão Série A. Mineirão lotado, torcida embandeirada, momentos da chegada, da arquibancada e dos gols.",
    date: "2026-04-19",
    location: "Belo Horizonte · MG · Mineirão",
    verified: true,
    coverages: [
      { photographer: "esportes", priceCents: 1500, photoCount: 18 },
      { photographer: "flash", priceCents: 1200, photoCount: 12 },
    ],
  },
  {
    slug: "maratona-brasilia-2026",
    name: "Maratona de Brasília 2026",
    description:
      "21º Maratona Internacional de Brasília. Largada na Esplanada, percurso pelo Eixo Monumental.",
    date: "2026-06-15",
    location: "Brasília · DF",
    verified: true,
    coverages: [
      { photographer: "esportes", priceCents: 1800, photoCount: 15 },
    ],
  },
  {
    slug: "carnaval-salvador-2026-bloco-olodum",
    name: "Bloco Olodum · Carnaval Salvador 2026",
    description:
      "Desfile do bloco Olodum no Pelourinho. Tradição, percussão e a melhor vista do Carnaval baiano.",
    date: "2026-02-13",
    location: "Salvador · BA · Pelourinho",
    verified: true,
    coverages: [
      { photographer: "flash", priceCents: 2000, photoCount: 14 },
      { photographer: "carla", priceCents: 1800, photoCount: 8 },
    ],
  },
  {
    slug: "formatura-unb-2026-direito",
    name: "Formatura UnB 2026/1 · Faculdade de Direito",
    description: "Solenidade de colação de grau e baile.",
    date: "2026-03-22",
    location: "Brasília · DF · CCBB",
    verified: false,
    coverages: [{ photographer: "carla", priceCents: 3500, photoCount: 10 }],
  },
  {
    slug: "lollapalooza-brasil-2026",
    name: "Lollapalooza Brasil 2026",
    description: "Festival de música no Autódromo de Interlagos.",
    date: "2026-03-28",
    location: "São Paulo · SP · Interlagos",
    verified: true,
    coverages: [
      { photographer: "flash", priceCents: 2500, photoCount: 16 },
      { photographer: "esportes", priceCents: 2200, photoCount: 9 },
    ],
  },
  {
    slug: "corrida-da-lapa-2026",
    name: "Corrida da Lapa 2026",
    description: "Corrida de rua amadora · 5km e 10km · Arcos da Lapa.",
    date: "2026-05-04",
    location: "Rio de Janeiro · RJ",
    verified: false,
    coverages: [{ photographer: "demo", priceCents: 1500, photoCount: 12 }],
  },
];

// ============================================================================
// Helpers
// ============================================================================

async function ensureUser(p: Photographer) {
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === p.email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user!;
  }
  return user!;
}

async function ensureOrg(p: Photographer, userId: string) {
  let { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", p.orgSlug)
    .maybeSingle();
  if (!org) {
    const ins = await admin
      .from("organizations")
      .insert({
        name: p.orgName,
        slug: p.orgSlug,
        type: p.orgType,
        pix_key: p.email,
        onboarded_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    org = ins.data;
  }
  // Garante membership
  await admin
    .from("organization_members")
    .upsert(
      { organization_id: org!.id, user_id: userId, role: "owner" },
      { onConflict: "organization_id,user_id" }
    );
  return org!;
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

async function ensurePhotos(eventId: string, count: number, slugSeed: string) {
  const { count: existing } = await admin
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if ((existing ?? 0) >= count) return;

  for (let i = 0; i < count; i++) {
    const seed = `${slugSeed}-${i}`;
    const url = `https://picsum.photos/seed/${seed}/1600/1200`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  ! falha ao baixar ${url}: ${res.status}`);
      continue;
    }
    const original = Buffer.from(await res.arrayBuffer());
    const wm = await applyWatermark(original);

    const originalPath = `${eventId}/seed-${i}.jpg`;
    const wmPath = `wm/${eventId}/seed-${i}.jpg`;

    await admin.storage
      .from("originals")
      .upload(originalPath, original, { contentType: "image/jpeg", upsert: true });
    await admin.storage
      .from("watermarked")
      .upload(wmPath, wm, { contentType: "image/jpeg", upsert: true });

    await admin.from("photos").insert({
      event_id: eventId,
      original_path: originalPath,
      watermarked_path: wmPath,
      rekognition_face_ids: [`stub-${slugSeed}-${i}`],
      processed_at: new Date().toISOString(),
    });
    process.stdout.write(`    ${i + 1}/${count}\r`);
  }
  console.log();
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("→ Garantindo fotógrafos");
  const orgIds: Record<string, string> = {};
  for (const [key, p] of Object.entries(PHOTOGRAPHERS)) {
    const user = await ensureUser(p);
    const org = await ensureOrg(p, user.id);
    orgIds[key] = org.id;
    console.log(`  ✓ ${p.email}`);
  }

  console.log("\n→ Garantindo eventos públicos");
  const summary: { name: string; qrTokens: string[] }[] = [];

  for (const ev of EVENTS) {
    let { data: rwe } = await admin
      .from("real_world_events")
      .select("id")
      .eq("slug", ev.slug)
      .maybeSingle();

    if (!rwe) {
      const ownerKey = ev.coverages[0].photographer;
      const ownerEmail = PHOTOGRAPHERS[ownerKey].email;
      const { data: list } = await admin.auth.admin.listUsers();
      const ownerUser = list.users.find((u) => u.email === ownerEmail)!;
      const ins = await admin
        .from("real_world_events")
        .insert({
          slug: ev.slug,
          name: ev.name,
          description: ev.description,
          date: ev.date,
          location: ev.location,
          public_listing: true,
          verified_by_iris: ev.verified,
          created_by: ownerUser.id,
        })
        .select("id")
        .single();
      if (ins.error) throw ins.error;
      rwe = ins.data;
    }

    console.log(`\n  ${ev.verified ? "★" : "·"} ${ev.name}`);
    const qrTokens: string[] = [];

    for (const cov of ev.coverages) {
      const orgId = orgIds[cov.photographer];
      const orgName = PHOTOGRAPHERS[cov.photographer].orgName;
      const eventName = `${ev.name} · ${orgName}`;

      // Idempotência: 1 coverage por org+RWE
      let { data: event } = await admin
        .from("events")
        .select("id, qr_token")
        .eq("real_world_event_id", rwe.id)
        .eq("organization_id", orgId)
        .maybeSingle();

      if (!event) {
        const ins = await admin
          .from("events")
          .insert({
            organization_id: orgId,
            real_world_event_id: rwe.id,
            name: eventName,
            location: ev.location,
            date: ev.date,
            price_cents: cov.priceCents,
            status: "active",
            public_listing: true,
          })
          .select("id, qr_token")
          .single();
        if (ins.error) throw ins.error;
        event = ins.data;
      }

      console.log(`    └ ${orgName} · R$ ${(cov.priceCents / 100).toFixed(2)} · ${cov.photoCount} fotos`);
      await ensurePhotos(event.id, cov.photoCount, `${ev.slug}-${cov.photographer}`);
      qrTokens.push(event.qr_token);
    }

    summary.push({ name: ev.name, qrTokens });
  }

  console.log("\n✅ Seed completo.\n");
  console.log("   Login fotógrafos (todos com senha iris-demo-2025):");
  for (const p of Object.values(PHOTOGRAPHERS)) {
    console.log(`     ${p.email.padEnd(28)} → ${p.orgName}`);
  }
  console.log(`\n   Login dev:  ${APP_URL}/login-dev`);
  console.log(`\n   Página pública de eventos:`);
  console.log(`     ${APP_URL}/eventos`);
  console.log(`\n   QR tokens dos eventos (acesso direto / cliente):`);
  for (const ev of summary) {
    console.log(`     ${ev.name}`);
    for (const qr of ev.qrTokens) {
      console.log(`       ${APP_URL}/e/${qr}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
