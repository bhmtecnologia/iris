import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveProfile } from "./actions";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: photographer } = await supabase
    .from("photographers")
    .select("name, doc, pix_key")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="max-w-xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Estes dados aparecem em recibos e são usados para o split de pagamento.
      </p>

      <form action={saveProfile} className="mt-8 space-y-4">
        <Field label="Nome do estúdio / fotógrafo" name="name" defaultValue={photographer?.name ?? ""} required />
        <Field label="CPF / CNPJ" name="doc" defaultValue={photographer?.doc ?? ""} placeholder="000.000.000-00" />
        <Field label="Chave PIX" name="pix_key" defaultValue={photographer?.pix_key ?? ""} placeholder="email, CPF, telefone ou chave aleatória" />
        <Field label="Email da conta" defaultValue={user.email ?? ""} disabled />

        <button className="mt-2 px-4 py-2 rounded-md bg-[var(--foreground)] text-[var(--background)] font-medium">
          Salvar
        </button>
      </form>
    </main>
  );
}

function Field(props: {
  label: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-[var(--muted)]">{props.label}</span>
      <input
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        required={props.required}
        disabled={props.disabled}
        className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--border)] bg-transparent disabled:opacity-50"
      />
    </label>
  );
}
