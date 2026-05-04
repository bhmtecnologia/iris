import Link from "next/link";
import { redirect } from "next/navigation";
import { progressLabel, requireOnboardingOrg } from "../_helpers";
import { saveOnboardingEvent, skipOnboarding } from "../actions";

export default async function OnboardingStep3() {
  const { org } = await requireOnboardingOrg();
  if (org.onboarded_at) redirect("/dashboard");

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <Link href="/onboarding/perfil" className="text-sm text-[var(--muted)]">← voltar</Link>
      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {progressLabel(3)}
      </div>
      <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]">
        Crie seu primeiro evento.
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Vai aparecer no seu painel com QR Code pronto pra colar/imprimir no evento.
        Pode editar tudo depois.
      </p>

      <form action={saveOnboardingEvent} className="mt-10 space-y-4">
        <Field label="Nome do evento" name="name" placeholder="Ex: Maratona BSB 2026" required />
        <Field label="Local" name="location" placeholder="Cidade · UF · Local" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" name="date" type="date" />
          <Field label="Preço por foto (R$)" name="price" type="number" min="0" step="0.01" defaultValue="15.00" required />
        </div>

        <button className="mt-4 w-full py-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium">
          Criar evento e ir pro dashboard
        </button>
      </form>

      <form action={skipOnboarding} className="mt-3">
        <button className="w-full py-3 rounded-lg text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          Pular por enquanto
        </button>
      </form>
    </main>
  );
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        required={props.required}
        min={props.min}
        step={props.step}
        className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--border)] bg-transparent"
      />
    </label>
  );
}
