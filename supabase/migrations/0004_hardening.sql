-- ====== Hardening (security + performance) ======
-- 1. RLS optimization: wrap auth.uid() in (select ...) so it's evaluated
--    once per query (not once per row). 5-10x speedup on large tables.
-- 2. user_org_ids() helper: security-definer function used by policies on
--    events/photos/organizations.
-- 3. claim_photo_jobs(): atomic SKIP LOCKED claim for the worker queue,
--    prevents double processing (and double Rekognition charges) when
--    Vercel Cron fires concurrent invocations.
-- 4. orders.search_id: binds an order to the search that produced it,
--    used as second token to gate /api/orders/[id]/status.

-- ====== Helper: user_org_ids ======
-- security definer to bypass RLS on organization_members (avoids policy recursion)
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id
  from public.organization_members
  where user_id = (select auth.uid())
$$;

revoke execute on function public.user_org_ids() from public;
grant execute on function public.user_org_ids() to authenticated, anon, service_role;

-- ====== Recreate policies with optimized auth.uid() ======
drop policy if exists organizations_member on organizations;
create policy organizations_member on organizations
  for all using (id in (select public.user_org_ids()))
  with check (id in (select public.user_org_ids()));

drop policy if exists organization_members_self on organization_members;
create policy organization_members_self on organization_members
  for select using (
    user_id = (select auth.uid()) or
    organization_id in (select public.user_org_ids())
  );

drop policy if exists organization_members_manage on organization_members;
create policy organization_members_manage on organization_members
  for all using (
    organization_id in (
      select organization_id from organization_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

drop policy if exists events_owner on events;
create policy events_owner on events
  for all using (organization_id in (select public.user_org_ids()))
  with check (organization_id in (select public.user_org_ids()));

drop policy if exists photos_owner on photos;
create policy photos_owner on photos
  for all using (
    event_id in (
      select id from events
      where organization_id in (select public.user_org_ids())
    )
  );

drop policy if exists rwe_public_read on real_world_events;
create policy rwe_public_read on real_world_events
  for select using (public_listing or created_by = (select auth.uid()));

drop policy if exists rwe_insert on real_world_events;
create policy rwe_insert on real_world_events
  for insert to authenticated
  with check ((select auth.uid()) = created_by);

drop policy if exists rwe_update_own on real_world_events;
create policy rwe_update_own on real_world_events
  for update using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

drop policy if exists rwe_delete_own on real_world_events;
create policy rwe_delete_own on real_world_events
  for delete using (created_by = (select auth.uid()));

-- ====== claim_photo_jobs: atomic SKIP LOCKED claim ======
create or replace function public.claim_photo_jobs(p_limit int default 5)
returns table (id uuid, payload jsonb, attempts int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.jobs as j
  set
    status = 'running',
    attempts = j.attempts + 1
  where j.id = any(
    array(
      select inner_j.id from public.jobs as inner_j
      where inner_j.type = 'process_photo'
        and inner_j.status = 'queued'
        and inner_j.run_after <= now()
      order by inner_j.created_at
      limit p_limit
      for update skip locked
    )
  )
  returning j.id, j.payload, j.attempts;
end;
$$;

revoke execute on function public.claim_photo_jobs(int) from public;
grant execute on function public.claim_photo_jobs(int) to service_role;

-- ====== orders.search_id (binding pra status endpoint) ======
alter table orders
  add column if not exists search_id uuid references searches(id) on delete set null;

create index if not exists orders_search_id_idx on orders(search_id);
