/**
 * Configurações do produto que podem variar por ambiente ou por organização.
 */

const DEFAULT_PLATFORM_FEE_BPS = 1500; // 15%

/**
 * Fee da plataforma em basis points (1% = 100 bps).
 * Lê do env `IRIS_PLATFORM_FEE_BPS`. Default = 1500 (15%).
 *
 * Para override por organização, passe o valor de `organizations.platform_fee_bps`.
 */
export function platformFeeBps(orgFeeBps?: number | null): number {
  if (typeof orgFeeBps === "number") return orgFeeBps;
  const env = process.env.IRIS_PLATFORM_FEE_BPS;
  if (env) {
    const n = Number(env);
    if (!Number.isNaN(n) && n >= 0 && n <= 5000) return n;
  }
  return DEFAULT_PLATFORM_FEE_BPS;
}

/**
 * Calcula o split em centavos. Retorna o que vai pra Íris e pra organização.
 * Útil para passar pro Marketplace MP futuramente.
 */
export function calculateSplit(amountCents: number, orgFeeBps?: number | null) {
  const bps = platformFeeBps(orgFeeBps);
  const platformCents = Math.round((amountCents * bps) / 10_000);
  const sellerCents = amountCents - platformCents;
  return { platformCents, sellerCents, feeBps: bps };
}
