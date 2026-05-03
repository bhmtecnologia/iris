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

  const { error } = await supabase
    .from("photographers")
    .update(parsed)
    .eq("user_id", user.id);
  if (error) throw error;

  revalidatePath("/dashboard/perfil");
}
