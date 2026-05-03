import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchByImage } from "@/lib/rekognition";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  const rl = rateLimit({ key: `search:${clientIp(req)}`, limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const fd = await req.formData();
  const eventId = String(fd.get("eventId") ?? "");
  const selfie = fd.get("selfie");
  if (!eventId || !(selfie instanceof File)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: ev } = await admin
    .from("events")
    .select("id, status")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || ev.status !== "active") {
    return NextResponse.json({ error: "event_inactive" }, { status: 403 });
  }

  const buf = new Uint8Array(await selfie.arrayBuffer());
  const selfieHash = crypto.createHash("sha256").update(buf).digest("hex");

  let matches: { photoId: string; similarity: number }[] = [];
  try {
    matches = await searchByImage(eventId, buf);
  } catch (err) {
    logger.warn("search.no_face_or_failure", { eventId, ip: clientIp(req), reason: String(err) });
    return NextResponse.json({ error: "no_face" }, { status: 422 });
  }

  const photoIds = Array.from(new Set(matches.map((m) => m.photoId)));
  if (photoIds.length === 0) {
    return NextResponse.json({ error: "no_match" }, { status: 404 });
  }

  const { data: buyer } = await admin
    .from("buyers")
    .insert({ selfie_hash: selfieHash, lgpd_consent_at: new Date().toISOString() })
    .select("id")
    .single();
  if (!buyer) return NextResponse.json({ error: "buyer_create_failed" }, { status: 500 });

  const { data: search, error } = await admin
    .from("searches")
    .insert({ buyer_id: buyer.id, event_id: eventId, photo_ids: photoIds })
    .select("id")
    .single();
  if (error || !search) return NextResponse.json({ error: error?.message }, { status: 500 });

  logger.info("search.success", { eventId, photoCount: photoIds.length, searchId: search.id });
  return NextResponse.json({ searchId: search.id, photoCount: photoIds.length });
}
