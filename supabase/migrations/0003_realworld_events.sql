-- ====== RealWorldEvent: agregador de coberturas de múltiplos fotógrafos ======
-- Um evento físico (Cruzeiro x Galo 2026) agrupa múltiplos Events (1 por
-- organização que cobriu). É a unidade de DESCOBERTA pública na busca /eventos.

create table if not exists real_world_events (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  name text not null,
  description text,
  date date,
  location text,
  cover_photo_url text,
  public_listing boolean not null default true,
  verified_by_iris boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists real_world_events_public_idx
  on real_world_events(public_listing, date desc nulls last)
  where public_listing;

create index if not exists real_world_events_slug_idx on real_world_events(slug);

-- Full-text search PT-BR (nome + local + descrição)
create index if not exists real_world_events_fts_idx on real_world_events using gin (
  to_tsvector('portuguese',
    coalesce(name, '') || ' ' ||
    coalesce(location, '') || ' ' ||
    coalesce(description, '')
  )
);

-- ====== Adiciona campos no events ======
alter table events
  add column if not exists real_world_event_id uuid references real_world_events(id) on delete set null,
  add column if not exists public_listing boolean not null default true;

create index if not exists events_rwe_idx on events(real_world_event_id);
create index if not exists events_public_listing_idx
  on events(public_listing, status)
  where public_listing;

-- ====== Admin role no organization_members (já existe, só documentando) ======
-- Admin global da Íris é flag separada — ver migration 0004 (futuro)

-- ====== RLS ======
alter table real_world_events enable row level security;

-- SELECT público quando listado, ou pelo criador
drop policy if exists rwe_public_read on real_world_events;
create policy rwe_public_read on real_world_events
  for select using (public_listing or created_by = auth.uid());

-- INSERT por qualquer usuário autenticado
drop policy if exists rwe_insert on real_world_events;
create policy rwe_insert on real_world_events
  for insert to authenticated
  with check (auth.uid() = created_by);

-- UPDATE/DELETE só pelo criador
drop policy if exists rwe_update_own on real_world_events;
create policy rwe_update_own on real_world_events
  for update using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists rwe_delete_own on real_world_events;
create policy rwe_delete_own on real_world_events
  for delete using (created_by = auth.uid());
