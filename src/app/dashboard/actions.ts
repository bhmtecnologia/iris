"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const eventSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(200).optional().nullable(),
  date: z.string().optional().nullable(),
  price: z.coerce.number().min(0),
});

export async function createEventAction(formData: FormData) {
  const parsed = eventSchema.parse({
    name: formData.get("name"),
    location: formData.get("location") || null,
    date: formData.get("date") || null,
    price: formData.get("price"),
  });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: photographer } = await supabase
    .from("photographers")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!photographer) throw new Error("Fotógrafo não encontrado");

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      photographer_id: photographer.id,
      name: parsed.name,
      location: parsed.location,
      date: parsed.date,
      price_cents: Math.round(parsed.price * 100),
    })
    .select("id")
    .single();
  if (error) throw error;

  // Rekognition collection is created lazily on first upload to avoid AWS costs
  // for events that never receive photos.
  revalidatePath("/dashboard");
  redirect(`/dashboard/eventos/${event!.id}`);
}
