-- ====== Onboarding state per organization ======
-- Marca quando a org completou o wizard inicial.
-- Dashboard redireciona pra /dashboard/onboarding enquanto NULL.

alter table organizations
  add column if not exists onboarded_at timestamptz;
