import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { APP_BUILD_TAG } from "@/lib/version";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Lazily ensure the user belongs to at least one organization (an "individual" org by default).
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const md = user.user_metadata ?? {};
    const name =
      (typeof md.full_name === "string" && md.full_name) ||
      (typeof md.name === "string" && md.name) ||
      user.email?.split("@")[0] ||
      "Fotógrafo";
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${user.id.slice(0, 6)}`;
    const { data: org } = await supabase
      .from("organizations")
      .insert({ name, slug, type: "individual" })
      .select("id")
      .single();
    if (org) {
      await supabase
        .from("organization_members")
        .insert({ organization_id: org.id, user_id: user.id, role: "owner" });
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold tracking-tight flex items-baseline gap-2">
          Íris
          <span className="text-[10px] font-mono text-[var(--muted)] opacity-60">v{APP_BUILD_TAG}</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-[var(--muted)] hover:text-[var(--foreground)]">Eventos</Link>
          <Link href="/dashboard/perfil" className="text-[var(--muted)] hover:text-[var(--foreground)]">Perfil</Link>
          <form action="/auth/signout" method="post">
            <button className="text-[var(--muted)] hover:text-[var(--foreground)]">Sair</button>
          </form>
        </nav>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
