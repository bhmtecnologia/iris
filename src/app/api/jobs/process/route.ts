import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyWatermark } from "@/lib/watermark";
import { collectionIdForEvent, indexFaces } from "@/lib/rekognition";
import { logger } from "@/lib/logger";
import {
  RekognitionClient,
  CreateCollectionCommand,
  ResourceAlreadyExistsException,
} from "@aws-sdk/client-rekognition";

export const maxDuration = 60;

const rk = new RekognitionClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

/**
 * Worker invoked by Vercel Cron (vercel.json) every minute.
 * Pulls up to N queued process_photo jobs and runs them inline.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return processQueue();
}

export async function POST(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return processQueue();
}

async function processQueue() {
  const admin = createAdminClient();
  // Atomic SKIP LOCKED claim — múltiplas invocações concorrentes do Vercel Cron
  // não pegam o mesmo job (evita pagar Rekognition em dobro).
  const { data: jobs, error: claimErr } = await admin.rpc("claim_photo_jobs", { p_limit: 5 });
  if (claimErr) {
    logger.error("job.claim_failed", claimErr);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const job of (jobs ?? []) as { id: string; payload: unknown; attempts: number }[]) {
    try {
      await processPhoto(job.payload as { photoId: string; eventId: string; path: string });
      await admin.from("jobs").update({ status: "done" }).eq("id", job.id);
      results.push({ id: job.id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("job.process_photo_failed", err, { jobId: job.id, payload: job.payload });
      // attempts já incrementado pela função claim_photo_jobs
      await admin
        .from("jobs")
        .update({ status: "failed", error: msg })
        .eq("id", job.id);
      results.push({ id: job.id, ok: false, error: msg });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

async function processPhoto({
  photoId,
  eventId,
  path,
}: {
  photoId: string;
  eventId: string;
  path: string;
}) {
  const admin = createAdminClient();

  // Lazy-create the Rekognition collection.
  try {
    await rk.send(new CreateCollectionCommand({ CollectionId: collectionIdForEvent(eventId) }));
    await admin
      .from("events")
      .update({ rekognition_collection_id: collectionIdForEvent(eventId) })
      .eq("id", eventId);
  } catch (e) {
    if (!(e instanceof ResourceAlreadyExistsException)) throw e;
  }

  const { data: file, error } = await admin.storage.from("originals").download(path);
  if (error || !file) throw error ?? new Error("download_failed");
  const buf = Buffer.from(await file.arrayBuffer());

  const watermarked = await applyWatermark(buf);
  const wmPath = path.replace(/^/, "wm/");
  const { error: upErr } = await admin.storage
    .from("watermarked")
    .upload(wmPath, watermarked, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw upErr;

  const faceIds = await indexFaces(eventId, photoId, new Uint8Array(buf));

  await admin
    .from("photos")
    .update({
      watermarked_path: wmPath,
      rekognition_face_ids: faceIds,
      processed_at: new Date().toISOString(),
    })
    .eq("id", photoId);
}
