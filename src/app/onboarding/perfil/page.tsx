import Link from "next/link";
import { redirect } from "next/navigation";
import { progressLabel, requireOnboardingOrg } from "../_helpers";
import { saveOnboardingProfile } from "../actions";

export default async function OnboardingStep2() {
  const { org } = await requireOnboardingOrg();
  if (org.onboarded_at) redirect("/dashboard");

  const isCompany = org.type === "company";
  const docLabel = isCompany ? "CNPJ" : "CPF / MEI (CNPJ)";
  const docPlaceholder = isCompany ? "00.000.000/0000-00" : "000.000.000-00";

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <Link href="/onboarding" className="text-sm text-[var(--muted)]">← voltar</Link>
      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {progressLabel(2)}
      </div>
      <h1 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight leading-[1.1]">
        Conta da {isCompany ? "empresa" : "sua atuação"}.
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        Esses dados aparecem em recibos. A chave PIX é onde os pagamentos vão cair.
      </p>

      <form action={saveOnboardingProfile} className="mt-10 space-y-4">
        <Field
          label={isCompany ? "Nome da empresa" : "Seu nome ou nome artístico"}
          name="name"
          defaultValue={org.name}
          required
        />
        <Field
          label={docLabel}
          name="doc"
          defaultValue={org.doc ?? ""}
          placeholder={docPlaceholder}
        />
        <Field
          label="Chave PIX (onde recebe o dinheiro)"
          name="pix_key"
          defaultValue={org.pix_key ?? ""}
          placeholder="email, CPF/CNPJ, telefone ou chave aleatória"
          required
        />

        <div className="pt-4">
          <button className="w-full py-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium">
            Continuar
          </button>
        </div>
      </form>
    </main>
  );
}

function Field(props: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{props.label}</span>
      <input
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        required={props.required}
        className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--border)] bg-transparent"
      />
    </label>
  );
}
