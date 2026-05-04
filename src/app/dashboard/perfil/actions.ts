"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(1).max(120),
  doc: z.string().max(20).optional().nullable(),
  pix_key: z.string().max(120).optional().nullable(),
});

export async function saveProfile(formData: FormData) {
  const parsed = schema.parse({
    name: formData.get("name"),
    doc: formData.get("doc") || null,
    pix_key: formData.get("pix_key") || null,
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
  if (!membership) throw new Error("Organização não encontrada");

  const { error } = await supabase
    .from("organizations")
    .update(parsed)
    .eq("id", membership.organization_id);
  if (error) throw error;

  revalidatePath("/dashboard/perfil");
}
