-- Seed inicial de desenvolvimento para a Fase 1.
-- Intencionalmente não cria registros em auth.users ainda.
-- O bootstrap de usuários/autenticação entra na sequência da fase.

insert into public.units (
  id,
  name,
  slug,
  timezone,
  active
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Smart Fit Pampulha',
  'smart-fit-pampulha',
  'America/Sao_Paulo',
  true
)
on conflict (slug) do update
set
  name = excluded.name,
  timezone = excluded.timezone,
  active = excluded.active;

insert into public.periods (
  id,
  unit_id,
  period_key,
  label,
  status,
  closed_at,
  closed_by
)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  '2026-04',
  'Abril/2026',
  'open',
  null,
  null
)
on conflict (unit_id, period_key) do update
set
  label = excluded.label,
  status = excluded.status,
  closed_at = excluded.closed_at,
  closed_by = excluded.closed_by;

insert into public.period_settings (
  id,
  period_id,
  team_snapshot,
  receptionists_snapshot,
  professors_snapshot,
  addon_types_snapshot,
  month_days,
  created_by,
  updated_by
)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '["Wallace", "Charles"]'::jsonb,
  '["Wallace"]'::jsonb,
  '["Charles"]'::jsonb,
  '["Energy", "Body", "Coach"]'::jsonb,
  30,
  null,
  null
)
on conflict (period_id) do update
set
  team_snapshot = excluded.team_snapshot,
  receptionists_snapshot = excluded.receptionists_snapshot,
  professors_snapshot = excluded.professors_snapshot,
  addon_types_snapshot = excluded.addon_types_snapshot,
  month_days = excluded.month_days,
  updated_by = excluded.updated_by;

insert into public.addon_types (
  id,
  period_id,
  name,
  active,
  created_by,
  updated_by
)
values
  (
    '44444444-4444-4444-4444-444444444441',
    '22222222-2222-2222-2222-222222222222',
    'Energy',
    true,
    null,
    null
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '22222222-2222-2222-2222-222222222222',
    'Body',
    true,
    null,
    null
  ),
  (
    '44444444-4444-4444-4444-444444444443',
    '22222222-2222-2222-2222-222222222222',
    'Coach',
    true,
    null,
    null
  )
on conflict (period_id, name) do update
set
  active = excluded.active,
  updated_by = excluded.updated_by;

insert into public.nps_period_metrics (
  id,
  period_id,
  score,
  monthly_goal,
  semester_goal,
  observations,
  updated_by
)
values (
  '55555555-5555-5555-5555-555555555555',
  '22222222-2222-2222-2222-222222222222',
  75,
  75,
  80,
  'Seed inicial da Fase 1 para validar estrutura e consultas.',
  null
)
on conflict (period_id) do update
set
  score = excluded.score,
  monthly_goal = excluded.monthly_goal,
  semester_goal = excluded.semester_goal,
  observations = excluded.observations,
  updated_by = excluded.updated_by;
