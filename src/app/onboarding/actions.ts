"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const orgTypeSchema = z.enum(["individual", "company"]);

export async function setOrgType(type: string) {
  const parsed = orgTypeSchema.parse(type);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/login");

  await supabase
    .from("organizations")
    .update({ type: parsed })
    .eq("id", membership.organization_id);

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/perfil");
}

const profileSchema = z.object({
  name: z.string().min(1).max(120),
  doc: z.string().max(20).optional().nullable(),
  pix_key: z.string().min(1).max(120),
});

export async function saveOnboardingProfile(formData: FormData) {
  const parsed = profileSchema.parse({
    name: formData.get("name"),
    doc: formData.get("doc") || null,
    pix_key: formData.get("pix_key"),
  });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/login");

  await supabase
    .from("organizations")
    .update(parsed)
    .eq("id", membership.organization_id);

  revalidatePath("/onboarding", "layout");
  redirect("/onboarding/evento");
}

const eventSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(200).optional().nullable(),
  date: z.string().optional().nullable(),
  price: z.coerce.number().min(0),
});

export async function saveOnboardingEvent(formData: FormData) {
  const parsed = eventSchema.parse({
    name: formData.get("name"),
    location: formData.get("location") || null,
    date: formData.get("date") || null,
    price: formData.get("price"),
  });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/login");

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      organization_id: membership.organization_id,
      name: parsed.name,
      location: parsed.location,
      date: parsed.date,
      price_cents: Math.round(parsed.price * 100),
      status: "active",
      public_listing: true,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("organizations")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", membership.organization_id);

  revalidatePath("/dashboard");
  redirect(`/dashboard/eventos/${event!.id}`);
}

export async function skipOnboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/login");

  await supabase
    .from("organizations")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", membership.organization_id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
