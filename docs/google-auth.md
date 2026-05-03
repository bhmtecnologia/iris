# Login com Google

Login social do **fotógrafo** via Supabase Auth + Google OAuth. Sem Firebase, sem SDK extra.

## 1. Google Cloud Console

1. Acesse https://console.cloud.google.com → crie um projeto (ou use um existente).
2. **APIs & Services → OAuth consent screen**
   - User type: **External** (publish em "Testing" enquanto valida).
   - App name: `Íris` · Support email: o seu.
   - Scopes: deixe os padrões (`email`, `profile`, `openid`).
   - Test users: adicione seu email e o `demo@iris.local`.
3. **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**.
   - Name: `Íris (local)`.
   - **Authorized redirect URIs** — adicione:
     ```
     http://127.0.0.1:54321/auth/v1/callback
     ```
     Para produção, adicione também `https://<seu-projeto>.supabase.co/auth/v1/callback`.
4. Copie **Client ID** e **Client secret**.

## 2. Configurar no Supabase local

Crie o arquivo `supabase/.env` (gitignored):

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<client-id-do-google>
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<client-secret-do-google>
```

Reinicie o stack para o Supabase reler o config:

```bash
supabase stop
supabase start
```

> O provider já está habilitado em [supabase/config.toml](../supabase/config.toml) (`[auth.external.google]`).

## 3. Configurar em produção (Supabase Cloud)

No dashboard do projeto Supabase em produção:

- **Authentication → Providers → Google**: habilitar, colar Client ID + Secret.
- **Authentication → URL Configuration**:
  - Site URL: `https://seu-dominio.com`
  - Redirect URLs: adicione `https://seu-dominio.com/auth/callback`.
- No Google Cloud, adicione `https://<projeto>.supabase.co/auth/v1/callback` aos redirect URIs.

## 4. Testar

1. Abra http://localhost:8000/login → clique **Continuar com Google**.
2. Faça o consentimento na tela do Google.
3. Você é redirecionado para `/auth/callback` → `/dashboard`.
4. O nome do perfil já vem preenchido com seu Google profile.

## Troubleshooting

- **"redirect_uri_mismatch"** → o redirect URI no Google Cloud não bate exatamente com o que o Supabase envia. Confira `http://127.0.0.1:54321/auth/v1/callback` (com `127.0.0.1`, não `localhost`).
- **"Provider not enabled"** → `supabase/.env` não foi lido. Confirme que rodou `supabase stop && supabase start` depois de criar o arquivo.
- **Tela travada após o redirect do Google** → verifique se `additional_redirect_urls` em `supabase/config.toml` inclui `http://localhost:8000/auth/callback`.
