import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  eventId: z.string().uuid(),
  filename: z.string().min(1),
  contentType: z.string().default("image/jpeg"),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = schema.parse(await req.json());

  // Verify ownership via RLS by selecting the event from the user-scoped client.
  const { data: event } = await supabase.from("events").select("id").eq("id", body.eventId).maybeSingle();
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${body.eventId}/${nanoid(10)}-${safeName}`;

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("originals")
    .createSignedUploadUrl(path);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ path, signedUrl: data.signedUrl, token: data.token });
}
