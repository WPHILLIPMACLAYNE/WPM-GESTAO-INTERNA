-- Canonical Supabase schema reconstructed from Reversa Task 01.
-- Scope: tables, constraints, foreign keys, timestamps, and operational indexes.
-- Out of scope here: RLS, RPCs, audit functions, seed data, and import/sync behavior.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  auth_provider text not null default 'supabase',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.unit_members (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'gestor', 'recepcao', 'professor', 'leitura')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (unit_id, user_id)
);

create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  period_key text not null check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  label text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (unit_id, period_key)
);

create table if not exists public.period_settings (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null unique references public.periods(id) on delete cascade,
  team_snapshot jsonb not null default '[]'::jsonb,
  reception_snapshot jsonb not null default '[]'::jsonb,
  professor_snapshot jsonb not null default '[]'::jsonb,
  month_days integer not null check (month_days between 28 and 31),
  created_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.addon_types (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (period_id, name)
);

create table if not exists public.student_attendances (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  student_name text not null,
  membership_number text,
  last_visit_date date,
  last_visit_time text,
  started_at_date date not null,
  nps_notice_status text not null default 'Sim' check (nps_notice_status in ('Sim', 'Não', 'Pendente')),
  receptionist_member_id uuid references public.unit_members(id) on delete set null,
  receptionist_name_snapshot text,
  feedback_status text not null default 'Pendente' check (feedback_status in ('Respondeu', 'Não respondeu', 'Pendente')),
  addon_type_id uuid references public.addon_types(id) on delete set null,
  addon_type_snapshot text,
  notes text not null default '',
  created_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.addon_sales (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  sale_date date not null,
  receptionist_member_id uuid references public.unit_members(id) on delete set null,
  receptionist_name_snapshot text,
  addon_type_id uuid references public.addon_types(id) on delete set null,
  addon_type_snapshot text,
  quantity integer not null check (quantity >= 0),
  source text not null check (source in ('manual', 'student_attendance')),
  student_attendance_id uuid references public.student_attendances(id) on delete set null,
  created_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists addon_sales_unique_operational_source_idx
  on public.addon_sales (
    period_id,
    sale_date,
    coalesce(receptionist_member_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(receptionist_name_snapshot, ''),
    coalesce(addon_type_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(addon_type_snapshot, ''),
    source,
    coalesce(student_attendance_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create table if not exists public.pending_items (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  student_name text not null,
  membership_number text,
  description text not null,
  requested_at_date date not null,
  assignee_member_id uuid references public.unit_members(id) on delete set null,
  assignee_name_snapshot text,
  response text not null default '',
  status text not null default 'aberto' check (status in ('aberto', 'respondido', 'concluido')),
  created_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shift_notes (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  from_member_id uuid references public.unit_members(id) on delete set null,
  from_name_snapshot text not null,
  to_member_id uuid references public.unit_members(id) on delete set null,
  to_audience text not null,
  message text not null,
  created_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.nps_period_metrics (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null unique references public.periods(id) on delete cascade,
  score numeric(5,2) not null,
  monthly_goal numeric(5,2) not null,
  semester_goal numeric(5,2) not null,
  observations text not null default '',
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.nps_mentions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  employee_member_id uuid references public.unit_members(id) on delete set null,
  name_snapshot text not null,
  count integer not null check (count >= 0),
  rank_position integer check (rank_position is null or rank_position > 0),
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.scale_days (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  scale_date date not null,
  row_tone text not null default 'neutral' check (row_tone in ('green', 'red', 'neutral')),
  reception_time text,
  receptionist_member_id uuid references public.unit_members(id) on delete set null,
  receptionist_name_snapshot text,
  reception_swap text,
  note text not null default '',
  created_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (period_id, scale_date)
);

create table if not exists public.scale_professor_shifts (
  id uuid primary key default gen_random_uuid(),
  scale_day_id uuid not null references public.scale_days(id) on delete cascade,
  time_label text not null,
  professor_member_id uuid references public.unit_members(id) on delete set null,
  professor_name_snapshot text,
  swap_name_snapshot text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  event_date date not null,
  event_time text,
  type text not null,
  title text not null,
  place text not null default '',
  owner_member_id uuid references public.unit_members(id) on delete set null,
  owner_name_snapshot text,
  status text not null default 'Programado' check (status in ('Programado', 'Confirmado', 'Concluído', 'Cancelado')),
  description text not null default '',
  created_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  period_id uuid references public.periods(id) on delete set null,
  actor_member_id uuid references public.unit_members(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists unit_members_unit_id_idx on public.unit_members(unit_id);
create index if not exists unit_members_user_id_idx on public.unit_members(user_id);
create index if not exists periods_unit_id_idx on public.periods(unit_id);
create index if not exists periods_unit_period_key_idx on public.periods(unit_id, period_key);
create index if not exists addon_types_period_id_idx on public.addon_types(period_id);
create index if not exists student_attendances_period_id_idx on public.student_attendances(period_id);
create index if not exists student_attendances_membership_idx on public.student_attendances(period_id, membership_number);
create index if not exists addon_sales_period_id_idx on public.addon_sales(period_id);
create index if not exists pending_items_period_id_idx on public.pending_items(period_id);
create index if not exists pending_items_status_date_idx on public.pending_items(period_id, status, requested_at_date);
create index if not exists shift_notes_period_id_idx on public.shift_notes(period_id);
create index if not exists nps_mentions_period_rank_idx on public.nps_mentions(period_id, rank_position);
create index if not exists scale_days_period_date_idx on public.scale_days(period_id, scale_date);
create index if not exists scale_professor_shifts_day_idx on public.scale_professor_shifts(scale_day_id);
create index if not exists events_period_date_idx on public.events(period_id, event_date);
create index if not exists events_period_status_type_idx on public.events(period_id, status, type);
create index if not exists audit_events_unit_idx on public.audit_events(unit_id, created_at desc);
create index if not exists audit_events_period_idx on public.audit_events(period_id, created_at desc);

create trigger set_units_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

create trigger set_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger set_unit_members_updated_at
  before update on public.unit_members
  for each row execute function public.set_updated_at();

create trigger set_periods_updated_at
  before update on public.periods
  for each row execute function public.set_updated_at();

create trigger set_period_settings_updated_at
  before update on public.period_settings
  for each row execute function public.set_updated_at();

create trigger set_addon_types_updated_at
  before update on public.addon_types
  for each row execute function public.set_updated_at();

create trigger set_student_attendances_updated_at
  before update on public.student_attendances
  for each row execute function public.set_updated_at();

create trigger set_addon_sales_updated_at
  before update on public.addon_sales
  for each row execute function public.set_updated_at();

create trigger set_pending_items_updated_at
  before update on public.pending_items
  for each row execute function public.set_updated_at();

create trigger set_nps_period_metrics_updated_at
  before update on public.nps_period_metrics
  for each row execute function public.set_updated_at();

create trigger set_nps_mentions_updated_at
  before update on public.nps_mentions
  for each row execute function public.set_updated_at();

create trigger set_scale_days_updated_at
  before update on public.scale_days
  for each row execute function public.set_updated_at();

create trigger set_scale_professor_shifts_updated_at
  before update on public.scale_professor_shifts
  for each row execute function public.set_updated_at();

create trigger set_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
