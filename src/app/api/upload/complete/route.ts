import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  eventId: z.string().uuid(),
  path: z.string().min(1),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = schema.parse(await req.json());

  const { data: event } = await supabase.from("events").select("id").eq("id", body.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: photo, error } = await admin
    .from("photos")
    .insert({ event_id: body.eventId, original_path: body.path })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("jobs").insert({
    type: "process_photo",
    payload: { photoId: photo.id, eventId: body.eventId, path: body.path },
  });

  return NextResponse.json({ ok: true, photoId: photo.id });
}
