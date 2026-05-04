-- ====== Organizations replace standalone photographers ======
-- A "photographer" might be a solo professional (org with 1 member) OR a company
-- (event company with multiple internal photographers). One unified model.

create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  type text not null default 'individual' check (type in ('individual', 'company')),
  doc text,
  pix_key text,
  mp_access_token_enc text,
  -- Override do fee da plataforma (basis points; 1500 = 15%). Null = usa env default.
  platform_fee_bps int check (platform_fee_bps is null or platform_fee_bps between 0 and 5000),
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx on organization_members(user_id);

-- ====== Migrate photographers → organizations ======
insert into organizations (id, name, slug, doc, pix_key, mp_access_token_enc, created_at)
select
  id,
  name,
  -- slug a partir do nome + sufixo curto pra evitar colisão
  regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g') || '-' || substr(id::text, 1, 6),
  doc,
  pix_key,
  mp_access_token_enc,
  created_at
from photographers
on conflict (id) do nothing;

insert into organization_members (organization_id, user_id, role)
select id, user_id, 'owner' from photographers
on conflict do nothing;

-- ====== Renomear FK em events ======
alter table events drop constraint if exists events_photographer_id_fkey;
alter table events rename column photographer_id to organization_id;
alter table events
  add constraint events_organization_id_fkey
  foreign key (organization_id) references organizations(id) on delete cascade;

drop index if exists events_photographer_idx;
create index if not exists events_organization_idx on events(organization_id);

-- ====== Drop tabela antiga (precisa dropar policies dependentes antes) ======
drop policy if exists events_owner on events;
drop policy if exists photos_owner on photos;
drop policy if exists photographers_self on photographers;
drop table if exists photographers;

-- ====== RLS ======
alter table organizations enable row level security;
alter table organization_members enable row level security;

-- Owner/member vê e atualiza sua org
drop policy if exists organizations_member on organizations;
create policy organizations_member on organizations
  for all using (
    id in (select organization_id from organization_members where user_id = auth.uid())
  ) with check (
    id in (select organization_id from organization_members where user_id = auth.uid())
  );

-- Member vê outros membros da mesma org
drop policy if exists organization_members_self on organization_members;
create policy organization_members_self on organization_members
  for select using (
    user_id = auth.uid() or
    organization_id in (select organization_id from organization_members where user_id = auth.uid())
  );

-- Só owner gerencia membros
drop policy if exists organization_members_manage on organization_members;
create policy organization_members_manage on organization_members
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ====== Atualiza policies de events e photos pra novo modelo ======
drop policy if exists events_owner on events;
create policy events_owner on events
  for all using (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  ) with check (
    organization_id in (
      select organization_id from organization_members where user_id = auth.uid()
    )
  );

drop policy if exists photos_owner on photos;
create policy photos_owner on photos
  for all using (
    event_id in (
      select e.id from events e
      join organization_members om on om.organization_id = e.organization_id
      where om.user_id = auth.uid()
    )
  );
