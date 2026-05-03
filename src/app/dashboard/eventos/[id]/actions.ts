"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteCollection } from "@/lib/rekognition";

async function ensureOwnership(eventId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("forbidden");
  return supabase;
}

const statusSchema = z.enum(["draft", "active", "archived"]);

export async function setEventStatus(eventId: string, status: string) {
  const supabase = await ensureOwnership(eventId);
  const parsed = statusSchema.parse(status);
  const { error } = await supabase
    .from("events")
    .update({ status: parsed })
    .eq("id", eventId);
  if (error) throw error;
  revalidatePath(`/dashboard/eventos/${eventId}`);
  revalidatePath("/dashboard");
}

export async function deleteEvent(eventId: string) {
  await ensureOwnership(eventId);

  // Best-effort cleanup of Rekognition + storage. Photos cascade-delete from DB.
  try { await deleteCollection(eventId); } catch { /* ignore */ }

  const admin = createAdminClient();
  const { data: photos } = await admin
    .from("photos")
    .select("original_path, watermarked_path")
    .eq("event_id", eventId);

  const originals = (photos ?? []).map((p) => p.original_path).filter(Boolean) as string[];
  const watermarks = (photos ?? []).map((p) => p.watermarked_path).filter(Boolean) as string[];
  if (originals.length) await admin.storage.from("originals").remove(originals);
  if (watermarks.length) await admin.storage.from("watermarked").remove(watermarks);

  await admin.from("events").delete().eq("id", eventId);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
