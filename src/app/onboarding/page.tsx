import { redirect } from "next/navigation";
import { progressLabel, requireOnboardingOrg } from "./_helpers";
import { setOrgType } from "./actions";

export default async function OnboardingStep1() {
  const { org } = await requireOnboardingOrg();
  if (org.onboarded_at) redirect("/dashboard");

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {progressLabel(1)}
      </div>
      <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
        Bem-vindo à Íris.
      </h1>
      <p className="mt-4 text-[var(--muted)]">
        Em menos de 5 minutos você está pronto pra vender sua primeira foto.
        Pra começar, conta pra gente como você trabalha.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <form action={setOrgType.bind(null, "company")}>
          <button className="w-full text-left p-5 rounded-xl border border-[var(--border)] hover:border-[var(--foreground)] transition-colors">
            <div className="text-lg font-semibold tracking-tight">Empresa de eventos</div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              Vários fotógrafos cobrindo eventos esportivos, festivais, formaturas.
              Recebimento centralizado no CNPJ.
            </div>
          </button>
        </form>

        <form action={setOrgType.bind(null, "individual")}>
          <button className="w-full text-left p-5 rounded-xl border border-[var(--border)] hover:border-[var(--foreground)] transition-colors">
            <div className="text-lg font-semibold tracking-tight">Fotógrafo profissional</div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              Solo, com CPF ou MEI. Você fotografa, sobe e vende. Recebe direto na sua conta.
            </div>
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs text-[var(--muted)]">
        Você pode mudar isso depois em <strong>Perfil</strong>.
      </p>
    </main>
  );
}
