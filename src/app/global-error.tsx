"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex items-center justify-center px-6 bg-[var(--background)] text-[var(--foreground)]">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Algo deu errado</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Já registramos o problema. Tente recarregar a página.
          </p>
          {error.digest && (
            <p className="mt-6 text-xs text-[var(--muted)] font-mono">ref: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
