import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">Íris</Link>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">Sair</button>
        </form>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
