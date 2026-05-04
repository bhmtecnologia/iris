import { notFound } from "next/navigation";
import { LoginDevForm } from "./login-dev-form";

// Atalho de password só pra desenvolvimento. Em produção, retorna 404
// pra evitar bypass do fluxo OAuth/magic-link via signup público.
export default function LoginDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LoginDevForm />;
}
