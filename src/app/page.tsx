import Link from "next/link";
import { APP_BUILD_TAG } from "@/lib/version";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between border-b border-[var(--border)]">
        <span className="font-semibold tracking-tight text-lg">Íris</span>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/eventos" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Buscar evento
          </Link>
          <Link href="/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
            Sou fotógrafo →
          </Link>
        </nav>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="max-w-xl text-center">
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Suas memórias
            <br />
            <span className="text-[var(--muted)]">te encontram.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-[var(--muted)] leading-relaxed">
            Sem buscar entre milhares de fotos. Tire uma selfie no evento,
            reconheça seu rosto, pague no PIX e receba em segundos.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/eventos"
              className="px-6 py-3 rounded-lg bg-[var(--foreground)] text-[var(--background)] font-medium"
            >
              Buscar evento
            </Link>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              ou aponte a câmera no QR Code do evento
            </div>
          </div>
        </div>
      </section>

      <footer className="px-6 py-6 border-t border-[var(--border)] text-xs text-[var(--muted)] flex justify-between items-center gap-4">
        <span>Íris · {new Date().getFullYear()}</span>
        <span className="font-mono text-[10px] opacity-60">v{APP_BUILD_TAG}</span>
        <Link href="/privacidade">Privacidade · LGPD</Link>
      </footer>
    </main>
  );
}
