# Íris

> Suas memórias te encontram.

Plataforma de venda automatizada de fotos de eventos (esportivos, festas, formaturas) por **reconhecimento facial**. O cliente escaneia um QR Code no evento, tira uma selfie, vê só as fotos onde aparece (com marca d'água), paga via **PIX** e recebe os originais por **email + WhatsApp + download in-app**.

PWA, mobile-first, fricção zero — sem app store, sem cadastro pesado, sem busca manual.

---

## Sumário

- [Visão do produto](#visão-do-produto)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Setup local (Docker)](#setup-local-docker)
- [Como rodar](#como-rodar)
- [Stubs locais](#stubs-locais-zero-custo-em-dev)
- [Seed](#seed-fotógrafo--evento--12-fotos)
- [Fluxos](#fluxos)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Banco de dados](#banco-de-dados)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Login do fotógrafo](#login-do-fotógrafo)
- [Pagamento PIX](#pagamento-pix)
- [Observabilidade](#observabilidade)
- [Segurança e LGPD](#segurança-e-lgpd)
- [Deploy](#deploy)
- [Roadmap](#roadmap)
- [Troubleshooting](#troubleshooting)

---

## Visão do produto

Não é uma galeria de fotos — é um **mecanismo de busca pessoal**. O cliente não procura, as fotos o encontram.

| | Tradicional | Íris |
|---|---|---|
| Acesso | Site/app do fotógrafo | QR Code no evento |
| Busca | Scroll por milhares de fotos | Selfie → match facial |
| Pagamento | Boleto / cartão / link | PIX em segundos |
| Entrega | "Aguarde 24h" | WhatsApp + email + download imediato |
| Atrito | Alto | Zero |

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router, RSC), TypeScript, Tailwind 4, shadcn-style components |
| PWA | `@serwist/next` (service worker em produção, ícones, manifest) |
| Auth | Supabase Auth — Google OAuth + magic link |
| DB | Supabase Postgres + extensões `pgvector` e `pg_cron` |
| Storage | Supabase Storage (buckets `originals` privado e `watermarked` público) |
| Background jobs | Tabela `jobs` + worker via Vercel Cron (HTTP) |
| Face match | AWS Rekognition Collections (IndexFaces + SearchFacesByImage) |
| Pagamento | Mercado Pago — Checkout Transparente, API de Pagamentos PIX |
| Email | Resend |
| WhatsApp | Cloud API (Meta) — alternativa Z-API |
| Observabilidade | Sentry + logger estruturado JSON + endpoint `/api/health` |
| Hospedagem | Vercel (web) + Supabase Cloud (infra) |

---

## Arquitetura

### Fluxo de upload (fotógrafo)

```
Fotógrafo → /dashboard/eventos/[id]/upload
         → POST /api/upload/presign  (signed URL Supabase Storage)
         → PUT direto p/ bucket `originals` (sem passar pelo backend)
         → POST /api/upload/complete (insere row em `photos`, enfileira `jobs`)
         ↓
Vercel Cron (a cada 1min) → GET /api/jobs/process
         → para cada job `process_photo`:
            • baixa original
            • gera watermark (sharp)
            • upload `watermarked/`
            • Rekognition.IndexFaces → guarda face_ids
            • marca processed_at
```

### Fluxo do cliente

```
QR Code → /e/[qrToken]                     consentimento LGPD + selfie
       → POST /api/search                  Rekognition.SearchFacesByImage
       → /e/[qrToken]/resultados?s=…       vitrine com watermark
       → POST /api/orders                  cria order + chama MP PIX
       → /e/[qrToken]/checkout/[orderId]   QR PIX + Copia e Cola + polling
       ↓
MP webhook → POST /api/webhooks/mercadopago
       → valida assinatura HMAC
       → marca order.paid
       → gera signed URLs (7 dias)
       → dispara email (Resend) + WhatsApp (Cloud API)
       ↓
Polling do checkout → GET /api/orders/[id]/status
       → tela vira "Pagamento confirmado" + botões de download
```

---

## Setup local (Docker)

Pré-requisitos:
- Node 20+
- pnpm (`npm i -g pnpm`)
- Docker Desktop
- Supabase CLI (`brew install supabase/tap/supabase`)

```bash
# 1. clone + deps
git clone https://github.com/bhmtecnologia/iris.git
cd iris
pnpm install

# 2. sobe Postgres + Auth + Storage + Studio em Docker
supabase start

# 3. aplica migrations + cria buckets
supabase db reset

# (rode uma vez para criar os buckets — quando o seed roda, ele cria sozinho)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" <<EOF
insert into storage.buckets (id, name, public) values ('originals','originals',false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('watermarked','watermarked',true) on conflict (id) do nothing;
EOF

# 4. env vars (placeholders já bastam pra dev — stubs ativam sozinhos)
cp .env.example .env.local

# 5. seed (cria fotógrafo + evento + 12 fotos do picsum.photos)
pnpm seed

# 6. dev server
pnpm dev
```

URLs:
- App: http://localhost:8000
- Supabase Studio: http://localhost:54323
- Mailpit (recebe magic links): http://localhost:54324
- Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

---

## Como rodar

```bash
pnpm dev          # Next dev na porta 8000
pnpm seed         # popula banco com evento demo + 12 fotos
pnpm lint
pnpm build
pnpm exec tsc --noEmit
```

Acesse http://localhost:8000.

**Login do fotógrafo demo:** `demo@iris.local` / `iris-demo-2025` em http://localhost:8000/login-dev.

**Jornada do cliente:** após `pnpm seed`, o terminal imprime a URL `/e/{qrToken}` do evento criado.

---

## Stubs locais (zero custo em dev)

Para o desenvolvimento ser **100% offline e gratuito**, [`src/lib/dev-stubs.ts`](src/lib/dev-stubs.ts) detecta env vars com valor placeholder e ativa stubs:

| Stub | Ativa quando | Comportamento |
|---|---|---|
| `STUB_REKOGNITION` | `AWS_ACCESS_KEY_ID === "dev-placeholder"` | Toda selfie casa com **todas** as fotos processadas do evento. Indexação retorna face_id falso. |
| `STUB_MERCADOPAGO` | `MERCADO_PAGO_ACCESS_TOKEN === "dev-placeholder"` | Cria PIX falso, **auto-aprova em 8s**, dispara o webhook local. |
| `STUB_RESEND` | `RESEND_API_KEY` começa com `re_dev_` | `console.log` em vez de enviar email. |
| `STUB_WHATSAPP` | `ZAPI_INSTANCE_ID` vazio | `console.log` em vez de chamar Z-API. |

Quando você troca o placeholder por uma credencial real, o stub se desativa **sozinho**, sem mexer em código.

---

## Seed (fotógrafo + evento + 12 fotos)

```bash
pnpm seed
```

Cria:
- Usuário `demo@iris.local` (senha `iris-demo-2025`)
- Photographer row + Event "Corrida da Lapa · Demo" (R$ 15,00 por foto)
- 12 fotos baixadas de picsum.photos com original + watermark gerado por `sharp`
- Todos os `processed_at` setados → fluxo de busca funciona imediatamente

Variáveis opcionais:
```bash
SEED_PHOTOS=30 pnpm seed     # quantas fotos
SEED_EMAIL=outro@x.com pnpm seed
```

---

## Fluxos

### Portal do fotógrafo

```
/login                            Google OAuth + magic link (Mailpit em dev)
  ↓
/dashboard                        lista de eventos + criar novo
  ↓
/dashboard/eventos/[id]           QR Code, status (rascunho/ativo/arquivado), galeria
  ├── /upload                     drag-drop massivo (4 workers paralelos)
  └── /vendas                     receita, número de pedidos, histórico
/dashboard/perfil                 nome, CPF/CNPJ, chave PIX
```

### Jornada do cliente (PWA-first)

```
/e/[qrToken]                      consentimento LGPD + tirar selfie
  ↓
/e/[qrToken]/resultados?s=…       vitrine personalizada (watermark)
  ↓ (selecionar fotos + email + WhatsApp)
/e/[qrToken]/checkout/[orderId]   QR PIX + Copia e Cola + polling de status
  ↓ (após pagamento)
mesma tela vira → botões de download (signed URLs 7 dias)
                + email enviado
                + WhatsApp enviado
```

---

## Estrutura de pastas

```
.
├── docs/
│   └── google-auth.md                              # passo-a-passo do Google Cloud Console
├── instrumentation.ts                              # Sentry server/edge
├── instrumentation-client.ts                       # Sentry browser + Replay
├── next.config.ts                                  # Sentry + serwist (PWA em prod)
├── public/
│   ├── manifest.json                               # PWA manifest
│   └── icon-{192,512}.png, apple-icon.png
├── scripts/
│   └── seed.ts                                     # pnpm seed
├── src/
│   ├── app/
│   │   ├── page.tsx                                # landing
│   │   ├── privacidade/page.tsx                    # LGPD
│   │   ├── login/page.tsx                          # Google + magic link
│   │   ├── login-dev/page.tsx                      # atalho password (dev)
│   │   ├── auth/{callback,signout}/route.ts        # OAuth callback + logout
│   │   ├── dashboard/                              # portal fotógrafo
│   │   │   ├── layout.tsx                          # auth + ensure photographer row
│   │   │   ├── page.tsx                            # eventos
│   │   │   ├── actions.ts                          # createEventAction
│   │   │   ├── perfil/{page,actions}.tsx
│   │   │   └── eventos/[id]/
│   │   │       ├── page.tsx                        # detalhe + galeria + status
│   │   │       ├── actions.ts                      # status/delete
│   │   │       ├── upload/                         # drag-drop massivo
│   │   │       └── vendas/page.tsx
│   │   ├── e/[qrToken]/                            # jornada cliente
│   │   │   ├── page.tsx                            # landing + selfie
│   │   │   ├── resultados/                         # vitrine
│   │   │   └── checkout/[orderId]/                 # PIX
│   │   ├── api/
│   │   │   ├── upload/{presign,complete}/          # signed URLs
│   │   │   ├── search/                             # face match (rate limit)
│   │   │   ├── orders/                             # criar pedido + PIX
│   │   │   ├── orders/[id]/status/                 # polling
│   │   │   ├── webhooks/mercadopago/               # libera download
│   │   │   ├── jobs/process/                       # worker Vercel Cron
│   │   │   └── health/                             # health check
│   │   ├── sw.ts                                   # service worker (serwist)
│   │   └── global-error.tsx                        # captura erros pra Sentry
│   ├── lib/
│   │   ├── rekognition.ts                          # AWS wrapper + stub
│   │   ├── mercadopago.ts                          # MP wrapper + HMAC + stub
│   │   ├── watermark.ts                            # sharp
│   │   ├── notifications/
│   │   │   ├── email.ts                            # Resend + stub
│   │   │   └── whatsapp.ts                         # Z-API + stub
│   │   ├── rate-limit.ts                           # token bucket in-memory
│   │   ├── logger.ts                               # JSON estruturado + Sentry
│   │   ├── dev-stubs.ts                            # detecção de modo dev
│   │   └── supabase/{client,server,admin}.ts
│   └── proxy.ts                                    # auth middleware (Next 16)
├── supabase/
│   ├── config.toml                                 # provider Google habilitado
│   ├── .env.example                                # creds Google OAuth
│   └── migrations/0001_initial.sql                 # schema completo + RLS + pg_cron
└── vercel.json                                     # Vercel Cron
```

---

## Banco de dados

Schema completo em [`supabase/migrations/0001_initial.sql`](supabase/migrations/0001_initial.sql).

```
photographers (id, user_id FK auth.users, name, doc, pix_key, mp_access_token_enc)
events       (id, photographer_id, name, location, date, price_cents,
              status[draft|active|archived], rekognition_collection_id,
              qr_token unique, retention_days)
photos       (id, event_id, original_path, watermarked_path,
              rekognition_face_ids[], embedding vector(512), processed_at)
buyers       (id, phone, email, lgpd_consent_at, selfie_hash)
searches     (id, buyer_id, event_id, photo_ids[], expires_at)
orders       (id, buyer_id, event_id, photo_ids[], total_cents,
              status[pending|paid|expired|failed|refunded],
              mp_payment_id, mp_qr_code, mp_qr_code_base64, paid_at)
deliveries   (id, order_id, channel[email|whatsapp], sent_at, error)
jobs         (id, type, payload jsonb, status, attempts, error, run_after)
audit_log    (id, actor, action, target, metadata)
```

### Row-Level Security

- `photographers`, `events`, `photos` → acesso só pelo dono via `auth.uid()`.
- `buyers`, `searches`, `orders`, `deliveries` → acesso só via service role no backend (não há policy pública).

### Retenção (LGPD)

`pg_cron` agendado em `supabase/migrations/0001_initial.sql`:

```sql
select cron.schedule('iris-expire-searches', '0 * * * *',
  $$ delete from searches where expires_at < now(); $$);
```

Selfies de busca expiram automaticamente em 24h. `events.retention_days` (default 60) controla quando o evento + fotos são purgados (job futuro).

---

## Variáveis de ambiente

`.env.local` (use `cp .env.example .env.local`):

```bash
# Supabase local (já preenchidas pra dev)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# AWS Rekognition — placeholders ativam o stub
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=dev-placeholder
AWS_SECRET_ACCESS_KEY=dev-placeholder

# Mercado Pago — placeholder ativa o stub (auto-paga em 8s)
MERCADO_PAGO_ACCESS_TOKEN=dev-placeholder
MERCADO_PAGO_PUBLIC_KEY=
MERCADO_PAGO_WEBHOOK_SECRET=

# Resend — placeholder loga em vez de enviar
RESEND_API_KEY=re_dev_placeholder
RESEND_FROM_EMAIL=Iris <noreply@iris.local>

# Z-API (WhatsApp) — vazio ativa o stub
ZAPI_INSTANCE_ID=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:8000
CRON_SECRET=dev-cron-secret

# Sentry (opcional, deixa vazio em dev)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

`supabase/.env` (gitignored, para Google OAuth no stack local):

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=GOCSPX-...
```

---

## Login do fotógrafo

Duas opções:

1. **Google OAuth** (recomendado, requer setup do Google Cloud — ver [docs/google-auth.md](docs/google-auth.md))
2. **Magic link** (sempre funciona, vai para Mailpit em dev)
3. **`/login-dev`** (atalho com password, só dev — útil pro `demo@iris.local`)

---

## Pagamento PIX

Usa Mercado Pago **Checkout Transparente + API de Pagamentos** (não Bricks, não Pro).

### Em desenvolvimento

Stub auto-aprova em 8 segundos sem custo nenhum.

### Em produção

1. Conta Mercado Pago com **PIX habilitado** (chave PIX cadastrada).
   - Verifique: `curl "https://api.mercadopago.com/v1/payment_methods?access_token=$TOKEN" | grep '"id":"pix"'` → tem que retornar.
2. Application criada em https://www.mercadopago.com.br/developers/panel/app
3. Pega `Access Token` (TEST ou APP_USR para produção) → `MERCADO_PAGO_ACCESS_TOKEN`.
4. Configura webhook na app:
   - URL: `https://seu-dominio.com/api/webhooks/mercadopago`
   - Eventos: **Pagamentos**
   - Pega o `Webhook Secret` → `MERCADO_PAGO_WEBHOOK_SECRET`.

O webhook valida assinatura HMAC (`x-signature` + `x-request-id`) automaticamente quando o secret está setado.

---

## Observabilidade

### Logs estruturados

[`src/lib/logger.ts`](src/lib/logger.ts) emite JSON em uma linha:

```json
{"ts":"2026-05-03T22:21:35.845Z","level":"info","service":"iris","msg":"search.success","eventId":"...","photoCount":12,"searchId":"..."}
```

Eventos importantes instrumentados:
- `search.success` / `search.no_face_or_failure`
- `order.created` / `order.paid`
- `mp_webhook.received` / `mp_webhook.invalid_signature`
- `delivery.email_failed` / `delivery.whatsapp_failed`
- `job.process_photo_failed`

### Sentry

- Sem `SENTRY_DSN` → SDK fica inerte, zero overhead.
- Com DSN → erros + breadcrumbs enviados, source maps automáticos no build.
- `[src/app/global-error.tsx]` captura erros do React.
- Replay habilitado on-error (com `maskAllText` + `blockAllMedia` por privacidade).

### Health check

```bash
curl http://localhost:8000/api/health
# {"ok":true,"checks":{"db":"ok"},"ts":"..."}
```

Use em uptime monitor (UptimeRobot, BetterUptime, etc).

---

## Segurança e LGPD

- **Consentimento explícito** em `/e/[qrToken]` antes de capturar selfie (checkbox + texto).
- **Selfies expiram em 24h** via `pg_cron` (`searches.expires_at`).
- **Originais privados**, entregues via signed URLs com expiração de 7 dias.
- **Watermarks públicas**, baixa resolução.
- **RLS** em todas as tabelas multi-tenant; service role só no backend.
- **Rate limiting** in-memory (token bucket) em `/api/search` (10/min/IP) e `/api/orders` (5/min/IP).
- **Webhook MP** valida assinatura HMAC.
- **Sentry Replay** com `maskAllText: true`.

---

## Deploy

### Vercel + Supabase Cloud

1. **Supabase Cloud** → criar projeto.
   - SQL Editor: rodar `supabase/migrations/0001_initial.sql`.
   - Storage: criar buckets `originals` (privado) e `watermarked` (público).
   - Authentication → Providers → Google: colar Client ID + Secret.
   - Authentication → URL Configuration: Site URL = `https://seu-dominio.com`.

2. **Google Cloud** → atualizar redirect URIs do OAuth client:
   - Adicionar `https://<projeto>.supabase.co/auth/v1/callback`.

3. **Mercado Pago** → app `Webhooks`:
   - URL: `https://seu-dominio.com/api/webhooks/mercadopago`.

4. **Vercel** → import do repo.
   - Env vars: copiar de `.env.local` substituindo placeholders por credenciais reais.
   - `vercel.json` já configura cron `/api/jobs/process` a cada minuto.

5. **Sentry** (opcional) → criar projeto Next.js → preencher `SENTRY_*` na Vercel.

### Custos esperados (estimativa)

Por evento de 5.000 fotos com 200 buscas:
- AWS Rekognition: ~$5 (indexação $5 + buscas $0,20)
- Supabase: free tier cobre até 1GB DB + 1GB storage / mês
- Vercel: free tier cobre projetos pequenos
- Mercado Pago: 0,99% por PIX recebido (vendedor)
- Resend: free tier 5k emails/mês
- WhatsApp Cloud API (Meta): grátis até 1k conversas/mês

---

## Roadmap

Ordem combinada de execução **antes** de ligar o AWS Rekognition (único componente com custo variável):

```
1. CI + E2E Playwright             ← protege regressão
2. Ativar PIX na conta MP          ← desbloqueia checkout real
3. Resend + Sentry                 ← email real + observabilidade
4. Deploy Vercel + Supabase prod   ← produto operacional sem face match
5. Marketplace MP (multi-tenant)   ← split entre fotógrafos
6. WhatsApp Cloud API (Meta)       ← canal oficial
7. AWS Rekognition                 ← liga o motor (último)
```

**Decisões de produto pendentes:**
- Modelo de cobrança (% por venda, mensalidade, freemium?)
- Preço da foto (fotógrafo define ou Íris sugere?)
- Política de retenção (30/60/90 dias após evento?)
- Termos sobre direitos de imagem

---

## Troubleshooting

### `next dev` falha com `EADDRINUSE: 8080`

Docker Desktop reserva a 8080. Usamos a 8000 (`next dev -p 8000`). Se outra coisa estiver na 8000, edite `package.json`.

### Magic link não chega

Em dev vai para Mailpit: http://localhost:54324.

### Google OAuth dá `redirect_uri_mismatch`

A redirect URI no Google Cloud tem que ser **exatamente** `http://127.0.0.1:54321/auth/v1/callback` (com `127.0.0.1`, não `localhost`).

### `supabase start` falha

`docker ps` precisa funcionar (Docker Desktop aberto). Se já tem outro projeto Supabase rodando, `supabase stop` antes.

### Erro `fill and validate error list: communication_error: 400` no MP

Sua conta MP não tem PIX habilitado. Cadastre uma chave em https://www.mercadopago.com.br/pix/manage-keys e verifique:
```bash
curl "https://api.mercadopago.com/v1/payment_methods?access_token=$TOKEN" | grep '"id":"pix"'
```

### Vendas não aparecem após pagamento PIX em sandbox

PIX em sandbox MP fica `pending` para sempre. Use o stub local (`MERCADO_PAGO_ACCESS_TOKEN=dev-placeholder`) que auto-aprova em 8s.

---

## Licença

Proprietário · BHM Tecnologia
