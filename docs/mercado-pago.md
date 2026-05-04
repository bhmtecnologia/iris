# Mercado Pago — guia de integração

Tudo que aprendemos integrando PIX no Íris. Foca no que **realmente funciona** em sandbox e produção, com as armadilhas que custaram horas de debug.

> **TL;DR**: usar a nova API `/v1/orders` (não a legacy `/v1/payments`), criar test users via API, no sandbox o payer email **precisa** terminar em `@testuser.com`. Stub local cobre o desenvolvimento sem credenciais.

---

## Sumário

- [Por que `/v1/orders` e não `/v1/payments`](#por-que-v1orders-e-não-v1payments)
- [Setup da aplicação no painel](#setup-da-aplicação-no-painel)
- [Test users — o caminho oficial pra sandbox](#test-users--o-caminho-oficial-pra-sandbox)
- [Como pegar credenciais de um test user](#como-pegar-credenciais-de-um-test-user)
- [Criando um pagamento PIX](#criando-um-pagamento-pix)
- [Webhooks](#webhooks)
- [Simular pagamento aprovado em sandbox](#simular-pagamento-aprovado-em-sandbox)
- [Erros comuns e armadilhas](#erros-comuns-e-armadilhas)
- [Migração para produção](#migração-para-produção)
- [Stub local](#stub-local)

---

## Por que `/v1/orders` e não `/v1/payments`

A MP tem **duas APIs** que parecem fazer a mesma coisa:

| | `/v1/payments` (legacy) | `/v1/orders` (nova) |
|---|---|---|
| Status | Existente, ainda funciona em produção | Recomendada para integrações novas |
| Test sellers | ❌ Rejeita com erro genérico (`communication_error`, `Unauthorized use of live credentials`) | ✅ Aceita perfeitamente |
| Mensagens de erro | ❌ Genéricas, `cause: []` vazio | ✅ Específicas (`invalid_email_for_sandbox`, etc) |
| Suporte na SDK `mercadopago` | ✅ `new Payment(config)` | ❌ Ainda não tem wrapper, usa fetch direto |
| Permite múltiplas transações por order | ❌ | ✅ |
| Status mais granular | `approved`, `pending`, `rejected` | `processed`, `action_required`, `cancelled`, … |

**Decisão para o Íris:** usar `/v1/orders` via fetch direto. Documentado em [`src/lib/mercadopago.ts`](../src/lib/mercadopago.ts).

---

## Setup da aplicação no painel

Caminho que **funcionou** na nossa conta `iris-power`:

1. https://www.mercadopago.com.br/developers/panel/app → **Criar aplicação**
2. **Tipo de pagamento:** Pagamentos online
3. **Como criou a loja:** Com um desenvolvimento próprio
4. **Solução de pagamento:** **Checkout Transparente** (não Bricks, não Pro)
5. **Tipo de Checkout API:** **API de Pagamentos** (não Orders na seleção do painel)

> **Confuso, mas relevante:** o painel separa "API de Pagamentos" de "API de Orders" como produtos diferentes. Selecionamos o primeiro mas, internamente, o token gerado tem permissão para chamar **as duas APIs HTTP**. A escolha no painel é mais sobre como a MP vai te vender e suportar — não sobre quais endpoints o token consegue chamar.

Resultado:
- **App ID** (ex: `4104268730265436`)
- **Public Key** (`APP_USR-...-uuid`) — frontend
- **Access Token** (`APP_USR-...-userId`) — backend

---

## Test users — o caminho oficial pra sandbox

A conta MP normal de uma pessoa física **não consegue receber pagamentos via API em sandbox**, mesmo com TEST credentials. Isso porque a MP só libera o sandbox de recebimento depois de validações de KYC + histórico de vendas.

**Solução oficial da MP:** criar **test users**, que são contas isoladas e 100% sandbox.

### Por que confunde

O painel tem três contextos:
- **Sua conta real** + credenciais TEST → não funciona pra criar pagamentos
- **Sua conta real** + credenciais APP_USR → produção real (move dinheiro)
- **Test user** + credenciais (chamadas "produção" no painel dele) → sandbox que funciona

Dentro de um test user, as credenciais "de produção" **são** as credenciais de teste, porque o user inteiro é sandbox. Se você tentar criar "Credenciais de teste" dentro de um test user, MP avisa que não é possível.

### Criar test user via API

```bash
TOKEN="seu-TEST-token-da-conta-real"  # serve TEST ou APP_USR
curl -X POST 'https://api.mercadopago.com/users/test_user' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"site_id":"MLB","description":"seller"}'
```

Resposta:
```json
{
  "id": 3367737730,
  "email": "test_user_7139896666339835887@testuser.com",
  "nickname": "TESTUSER7139896666339835887",
  "site_status": "active",
  "password": "DtaukAA6Pw"
}
```

Crie **dois**: um vendedor (`seller`) e um comprador (`buyer`). Guarde os emails e senhas.

---

## Como pegar credenciais de um test user

A API **não** expõe endpoint para baixar tokens dos test users — proteção da MP. Você precisa logar manualmente:

1. Aba anônima
2. https://www.mercadopago.com.br/
3. Login com email/senha do test user **vendedor**
4. https://www.mercadopago.com.br/developers/panel/app
5. **Criar aplicação** (mesmo passo a passo da seção anterior, com qualquer nome — ex: `iris-test-seller`)
6. Vai em **Credenciais de produção** *(SIM, esse nome confuso — dentro de test user, "produção" é o sandbox dele)*
7. Copiar **Public Key** e **Access Token** (`APP_USR-…`)

Se tentar **Credenciais de teste**, a MP responde "não é possível criar credencial de teste em ambiente de teste" — **isso é esperado**.

---

## Criando um pagamento PIX

### Endpoint

```
POST https://api.mercadopago.com/v1/orders
```

### Headers obrigatórios

```
Content-Type: application/json
Authorization: Bearer {access_token}
X-Idempotency-Key: {uuid v4}
```

### Body mínimo que funciona

```json
{
  "type": "online",
  "total_amount": "15.00",
  "external_reference": "iris_order_001",
  "description": "Compra de fotos Iris",
  "transactions": {
    "payments": [{
      "amount": "15.00",
      "payment_method": { "id": "pix", "type": "bank_transfer" }
    }]
  },
  "payer": {
    "email": "buyer_xyz@testuser.com",
    "first_name": "Comprador",
    "last_name": "Iris",
    "identification": { "type": "CPF", "number": "19119119100" }
  }
}
```

### Sandbox: payer email obrigatoriamente `@testuser.com`

Se passar email comum (`comprador@gmail.com`) em sandbox, a API responde:
```json
{"errors": [{"code": "invalid_email_for_sandbox", "message": "Email format is invalid for sandbox environment, must contains '@testuser.com'."}]}
```

Em [`src/lib/mercadopago.ts`](../src/lib/mercadopago.ts) a gente força o override em sandbox:

```ts
const payerEmail = isSandboxToken || NODE_ENV !== "production"
  ? `buyer_${externalReference.slice(0, 8)}@testuser.com`
  : params.payerEmail;
```

Em produção, usa o email real do comprador.

### Resposta

```json
{
  "id": "ORDTST01KQR5FFYTM5YJ82ZHK6EBZVWD",
  "status": "action_required",
  "status_detail": "waiting_transfer",
  "transactions": {
    "payments": [{
      "id": "PAY01KQR5FFZ82AJXD2FJ2WFHA3T1",
      "status": "action_required",
      "payment_method": {
        "id": "pix",
        "type": "bank_transfer",
        "qr_code": "00020126…",
        "qr_code_base64": "iVBORw0KGgoAAAA…",
        "ticket_url": "https://www.mercadopago.com.br/sandbox/payments/.../ticket?…"
      }
    }]
  }
}
```

| Campo | Para |
|---|---|
| `id` | guarde como `mp_payment_id` na sua tabela `orders` |
| `qr_code` | string PIX Copia-e-Cola (mostrar pro cliente copiar) |
| `qr_code_base64` | PNG do QR (renderizar com `<img src="data:image/png;base64,…">`) |
| `ticket_url` | página de pagamento simulado (sandbox) ou de visualização (produção) |
| `status` | `action_required` = aguardando, `processed` = pago |

### Status — diferença entre as duas APIs

| `/v1/orders` | `/v1/payments` (legacy) | Significado |
|---|---|---|
| `action_required` | `pending` | Esperando pagamento |
| `processed` | `approved` | Pago |
| `cancelled` | `rejected` / `cancelled` | Cancelado |

Helper em [`src/lib/mercadopago.ts`](../src/lib/mercadopago.ts):

```ts
export function isApproved(order: OrderResource): boolean {
  if (order.status === "processed") return true;
  if (order.status === "approved") return true; // legacy
  return false;
}
```

---

## Webhooks

### Configuração no painel

App → **Webhooks**:
- **URL**: `https://seu-dominio.com/api/webhooks/mercadopago`
- **Eventos**: marque "Pagamentos"
- Copie o **Webhook Secret** que aparece (string longa) → `MERCADO_PAGO_WEBHOOK_SECRET`

> **Sandbox + localhost não funciona.** A MP precisa de URL pública HTTPS para validar e enviar webhooks. Em dev, o stub simula esse fluxo. Pra testar webhook real localmente: use `ngrok` ou faça deploy.

### Validação de assinatura HMAC

A MP envia 2 headers que você precisa cruzar:

```
x-signature: ts=1700000000,v1=abcdef...
x-request-id: 12345-abcde
```

Manifest a ser assinado com HMAC-SHA256 (chave = webhook secret):

```
id:{dataId};request-id:{requestId};ts:{ts};
```

Implementado em [`verifyWebhookSignature()`](../src/lib/mercadopago.ts) em `src/lib/mercadopago.ts`. Se `MERCADO_PAGO_WEBHOOK_SECRET` está vazio, o handler aceita sem validar (modo dev/stub).

### Payload do webhook

```json
{
  "action": "payment.updated",
  "type": "payment",
  "data": { "id": "ORDTST01..." }
}
```

`data.id` também vem na query string (`?data.id=...&type=payment`). O handler em [`src/app/api/webhooks/mercadopago/route.ts`](../src/app/api/webhooks/mercadopago/route.ts):

1. Valida assinatura
2. `GET /v1/orders/{data.id}` para confirmar status
3. Se `isApproved(order)` → marca `orders.status = paid`, dispara entregas

---

## Simular pagamento aprovado em sandbox

Test sellers não pagam de verdade. Para simular aprovação:

1. Crie a order via API (status volta `action_required`).
2. Pegue a `ticket_url` da resposta — algo como `https://www.mercadopago.com.br/sandbox/payments/{paymentId}/ticket?…`.
3. Abra essa URL **logado como test user buyer** (não o seller).
4. Tem um botão de "simular pagamento aprovado".
5. Webhook é disparado para sua URL configurada.

Como nosso webhook precisa de URL pública, em dev a gente usa o **stub local** que simula tudo internamente.

---

## Erros comuns e armadilhas

### `fill and validate error list: communication_error : 400` com `cause: []`

Causa: você está usando `/v1/payments` (legacy) com test sellers.

**Solução:** migrar para `/v1/orders`.

### `Unauthorized use of live credentials` (401)

Causa: você está usando `APP_USR-…` de um test user com `/v1/payments`. A API legacy detecta como "live" e bloqueia porque o seller é test.

**Solução:** usar `/v1/orders`, que aceita test seller credentials.

### `invalid_email_for_sandbox`

Causa: payer email não termina em `@testuser.com` em sandbox.

**Solução:** override automático em sandbox (já implementado em `lib/mercadopago.ts`).

### PIX não aparece em `/v1/payment_methods`

Causa: a conta MP não tem chave PIX cadastrada.

**Solução:** https://www.mercadopago.com.br/pix/manage-keys → cadastrar email/CPF/celular como chave.

### Webhook não chega em dev

Causa: a MP não consegue alcançar `localhost`.

**Solução:** use o stub (`MERCADO_PAGO_ACCESS_TOKEN=dev-placeholder`), ou use `ngrok` para expor sua porta local.

### Test sellers às vezes "deslogam" do panel

Tokens APP_USR não expiram, mas o login web do test user às vezes pede pra refazer. Não afeta a API — só te faz logar de novo se quiser ver o painel.

---

## Migração para produção

Quando o produto for ao ar:

1. **Conta MP de produção** (CNPJ recomendado) — verificada com PIX habilitado.
2. **Mesma app** `iris-power` no painel da conta real → **Credenciais de produção** → `APP_USR-...`.
3. Substitui no `.env.local` / Vercel env:
   ```
   MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...    # produção real
   MERCADO_PAGO_PUBLIC_KEY=APP_USR-...
   MERCADO_PAGO_WEBHOOK_SECRET=...          # vem do painel
   ```
4. Atualiza webhook URL no painel para domínio público.
5. Como o token de produção **não** começa com `TEST-`, a função `isSandboxToken` retorna false e o payer email do cliente real é usado de verdade.

> **Multi-tenant (Marketplace):** quando cada fotógrafo conectar a própria conta MP, vamos usar **OAuth** + `client_id` / `client_secret` da nossa app pra obter access tokens em nome de cada vendedor. Esse é o passo 5 do roadmap.

---

## Stub local

Quando `MERCADO_PAGO_ACCESS_TOKEN === "dev-placeholder"` (default em `.env.example`), [`src/lib/dev-stubs.ts`](../src/lib/dev-stubs.ts) ativa o `STUB_MERCADOPAGO`:

- `createPixPayment()` retorna QR fake + auto-marca aprovação em **8 segundos**
- Dispara o webhook local em `/api/webhooks/mercadopago`
- Fluxo cliente fica 100% testável sem credenciais reais

Comportamento desliga **automaticamente** quando você troca por um token real (`TEST-` ou `APP_USR-`).

---

## Smoke test

```bash
pnpm mp:smoke
```

Roda contra `.env.local` e reporta:
- Identidade do dono do token (test user vs produção)
- Métodos disponíveis (PIX + cartões)
- Tenta criar um PIX real

Saída:
- `⏸ stub ativo` — sem credencial real configurada
- `✅ Order criada!` — credencial OK, integração funcional
- `⚠️ PIX ainda bloqueado` — algo errado, ler mensagem de erro

---

## Referências

- [Documentação `/v1/orders` PIX](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix)
- [Test users](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/test-users)
- [Credenciais](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/credentials)
- [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
