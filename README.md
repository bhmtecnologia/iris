# Íris

Plataforma de venda automatizada de fotos de eventos com busca por reconhecimento facial. PWA, fricção zero, PIX instantâneo.

## Stack

- **Next.js 15** (App Router, RSC) + TypeScript + Tailwind 4 + PWA
- **Supabase** (Postgres + pgvector + Auth + Storage)
- **AWS Rekognition** (Collections + IndexFaces + SearchFacesByImage)
- **Mercado Pago** (PIX + webhook)
- **Resend** (e-mail) + **Z-API** (WhatsApp)

## Setup

### 1. Provisionamento (Fase 0)

Crie contas e capture credenciais:
- AWS (IAM com `rekognition:*` em `us-east-1`)
- Supabase (URL, anon key, service role)
- Mercado Pago (Access Token + Webhook Secret)
- Resend (domínio verificado)
- Z-API (instance + token + client token)

### 2. Configurar env

```bash
cp .env.example .env.local
# preencha as chaves
```

### 3. Banco de dados

No SQL Editor do Supabase, rode `supabase/migrations/0001_initial.sql`.

Crie os buckets de Storage:
- `originals` (privado)
- `watermarked` (público)

### 4. Rodar localmente

```bash
pnpm install
pnpm dev
```

Acesse http://localhost:3000.

## Fluxos

- **Fotógrafo:** `/login` → magic link → `/dashboard` → criar evento → upload → ver QR.
- **Cliente:** escanear QR → `/e/{token}` → consentimento + selfie → `/resultados` → seleção → `/checkout` → PIX → download.

## Estrutura

```
src/
├── app/
│   ├── page.tsx                          # landing
│   ├── login/                            # auth fotógrafo
│   ├── dashboard/                        # portal fotógrafo
│   ├── e/[qrToken]/                      # jornada cliente
│   └── api/
│       ├── upload/{presign,complete}     # upload pipeline
│       ├── search                        # face match
│       ├── orders                        # criar pedido + PIX
│       ├── jobs/process                  # worker (Vercel Cron)
│       └── webhooks/mercadopago          # liberação automática
└── lib/
    ├── rekognition.ts
    ├── mercadopago.ts
    ├── watermark.ts
    ├── notifications/{email,whatsapp}.ts
    └── supabase/{client,server,admin}.ts
```

## Cron

Vercel Cron chama `/api/jobs/process` a cada minuto para processar fotos em lote (watermark + IndexFaces).

## Próximos passos

- Sprint 5: rate limiting, hCaptcha, retenção LGPD configurável, Sentry.
- Testes Playwright E2E.
- Onboarding de fotógrafos com split de pagamento.
