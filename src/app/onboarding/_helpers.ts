import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireOnboardingOrg() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, type, doc, pix_key, onboarded_at")
    .eq("id", membership.organization_id)
    .single();
  if (!org) redirect("/login");

  return { supabase, user, org, role: membership.role };
}

export function progressLabel(step: 1 | 2 | 3) {
  return `Passo ${step} de 3`;
}
