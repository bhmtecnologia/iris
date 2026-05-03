-- ====== Extensions ======
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_cron;

-- ====== Enums ======
do $$ begin
  create type event_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('pending', 'paid', 'expired', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_channel as enum ('email', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('queued', 'running', 'done', 'failed');
exception when duplicate_object then null; end $$;

-- ====== Tables ======
create table if not exists photographers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  doc text,
  pix_key text,
  mp_access_token_enc text,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  photographer_id uuid not null references photographers(id) on delete cascade,
  name text not null,
  location text,
  date date,
  price_cents int not null check (price_cents >= 0),
  status event_status not null default 'draft',
  rekognition_collection_id text,
  qr_token text not null unique default encode(gen_random_bytes(8), 'hex'),
  retention_days int not null default 60,
  created_at timestamptz not null default now()
);
create index if not exists events_photographer_idx on events(photographer_id);

create table if not exists photos (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  original_path text not null,
  watermarked_path text,
  taken_at timestamptz,
  rekognition_face_ids text[] default '{}',
  embedding vector(512),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists photos_event_idx on photos(event_id);
create index if not exists photos_face_ids_idx on photos using gin (rekognition_face_ids);

create table if not exists buyers (
  id uuid primary key default uuid_generate_v4(),
  phone text,
  email text,
  lgpd_consent_at timestamptz,
  selfie_hash text,
  created_at timestamptz not null default now()
);

create table if not exists searches (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references buyers(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  photo_ids uuid[] not null default '{}',
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);
create index if not exists searches_buyer_idx on searches(buyer_id);
create index if not exists searches_expires_idx on searches(expires_at);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references buyers(id) on delete restrict,
  event_id uuid not null references events(id) on delete restrict,
  photo_ids uuid[] not null check (array_length(photo_ids, 1) > 0),
  total_cents int not null check (total_cents >= 0),
  status order_status not null default 'pending',
  mp_payment_id text unique,
  mp_qr_code text,
  mp_qr_code_base64 text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists orders_event_idx on orders(event_id);
create index if not exists orders_buyer_idx on orders(buyer_id);

create table if not exists deliveries (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  channel delivery_channel not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status job_status not null default 'queued',
  attempts int not null default 0,
  error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists jobs_status_idx on jobs(status, run_after);

create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor text,
  action text not null,
  target text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ====== Row Level Security ======
alter table photographers enable row level security;
alter table events        enable row level security;
alter table photos        enable row level security;
alter table buyers        enable row level security;
alter table searches      enable row level security;
alter table orders        enable row level security;
alter table deliveries    enable row level security;

-- Photographer can read/write their own profile
create policy photographers_self on photographers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Photographer manages only their events/photos
create policy events_owner on events
  for all using (
    photographer_id in (select id from photographers where user_id = auth.uid())
  ) with check (
    photographer_id in (select id from photographers where user_id = auth.uid())
  );

create policy photos_owner on photos
  for all using (
    event_id in (
      select e.id from events e
      join photographers p on p.id = e.photographer_id
      where p.user_id = auth.uid()
    )
  );

-- Buyers/searches/orders accessed only via service role on backend.
-- (No client-facing select policy by design.)

-- ====== Retention (LGPD) ======
-- Cron jobs are scheduled on the database to expire sensitive data.
-- Deletes searches > 24h and selfie data referenced by buyers older than retention window.
select cron.schedule(
  'iris-expire-searches',
  '0 * * * *',
  $$ delete from searches where expires_at < now(); $$
);
