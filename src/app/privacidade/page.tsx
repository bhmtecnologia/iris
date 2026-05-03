export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-sm leading-relaxed">
      <h1 className="text-3xl font-semibold tracking-tight">Privacidade · LGPD</h1>
      <p className="mt-6 text-[var(--muted)]">
        A Íris foi desenhada sob o conceito de <strong>Privacy by Design</strong>.
      </p>

      <h2 className="mt-10 text-lg font-semibold">Selfie de busca</h2>
      <p className="mt-2 text-[var(--muted)]">
        Sua selfie é usada apenas para gerar uma assinatura biométrica que localiza
        seu rosto entre as fotos do evento. Ela não é exibida para terceiros e é
        apagada automaticamente em até 24 horas.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Fotos do evento</h2>
      <p className="mt-2 text-[var(--muted)]">
        As fotos originais são armazenadas em ambiente criptografado e ficam
        disponíveis apenas para os compradores via link assinado, com prazo de
        expiração definido pelo fotógrafo.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Seus direitos</h2>
      <p className="mt-2 text-[var(--muted)]">
        Você pode solicitar exclusão dos seus dados a qualquer momento. Entre em
        contato pelo email do fotógrafo do evento.
      </p>
    </main>
  );
}
