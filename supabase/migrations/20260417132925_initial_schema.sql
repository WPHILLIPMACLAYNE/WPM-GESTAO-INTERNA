create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'admin',
      'regional',
      'gestor',
      'recepcao',
      'professor',
      'leitura'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'period_status') then
    create type public.period_status as enum ('open', 'closed');
  end if;

  if not exists (select 1 from pg_type where typname = 'nps_notice_status') then
    create type public.nps_notice_status as enum ('sim', 'nao', 'pendente');
  end if;

  if not exists (select 1 from pg_type where typname = 'feedback_status') then
    create type public.feedback_status as enum ('respondeu', 'nao_respondeu', 'pendente');
  end if;

  if not exists (select 1 from pg_type where typname = 'pending_status') then
    create type public.pending_status as enum ('aberto', 'respondido', 'concluido');
  end if;

  if not exists (select 1 from pg_type where typname = 'event_type') then
    create type public.event_type as enum (
      'evento',
      'acao',
      'campanha',
      'treinamento',
      'feriado',
      'outro'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'event_status') then
    create type public.event_status as enum (
      'programado',
      'confirmado',
      'concluido',
      'cancelado'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'addon_sale_source') then
    create type public.addon_sale_source as enum ('manual', 'student_attendance');
  end if;
end
$$;

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
  slug text unique,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text unique,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.unit_members (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (unit_id, user_id)
);

create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  period_key text not null,
  label text not null,
  status public.period_status not null default 'open',
  closed_at timestamptz,
  closed_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint periods_period_key_format check (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
  unique (unit_id, period_key)
);

create table if not exists public.period_settings (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null unique references public.periods (id) on delete cascade,
  team_snapshot jsonb not null default '[]'::jsonb,
  receptionists_snapshot jsonb not null default '[]'::jsonb,
  professors_snapshot jsonb not null default '[]'::jsonb,
  addon_types_snapshot jsonb not null default '[]'::jsonb,
  month_days integer not null,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint period_settings_month_days_check check (month_days between 28 and 31)
);

create table if not exists public.addon_types (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (period_id, name)
);

create table if not exists public.student_attendances (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  student_name text not null,
  membership_number text,
  last_visit_date date,
  last_visit_time time,
  started_at_date date not null,
  nps_notice_status public.nps_notice_status not null default 'pendente',
  receptionist_id uuid references public.users (id) on delete set null,
  receptionist_name_snapshot text,
  feedback_status public.feedback_status not null default 'pendente',
  addon_type_id uuid references public.addon_types (id) on delete set null,
  addon_type_snapshot text,
  notes text,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.addon_sales (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  sale_date date not null,
  receptionist_id uuid references public.users (id) on delete set null,
  receptionist_name_snapshot text not null,
  addon_type_id uuid references public.addon_types (id) on delete set null,
  addon_type_snapshot text not null,
  quantity integer not null default 0,
  source public.addon_sale_source not null default 'manual',
  student_attendance_id uuid references public.student_attendances (id) on delete set null,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint addon_sales_quantity_check check (quantity >= 0)
);

create table if not exists public.pending_items (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  student_name text not null,
  membership_number text,
  description text not null,
  requested_at_date date not null,
  assignee_id uuid references public.users (id) on delete set null,
  assignee_name_snapshot text,
  response text,
  status public.pending_status not null default 'aberto',
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shift_notes (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  from_user_id uuid references public.users (id) on delete set null,
  from_name_snapshot text not null,
  to_user_id uuid references public.users (id) on delete set null,
  to_audience text,
  message text not null,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.nps_period_metrics (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null unique references public.periods (id) on delete cascade,
  score numeric(5,2),
  monthly_goal numeric(5,2),
  semester_goal numeric(5,2),
  observations text,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.nps_mentions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  employee_id uuid references public.users (id) on delete set null,
  name_snapshot text not null,
  count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint nps_mentions_count_check check (count >= 0)
);

create table if not exists public.scale_days (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  scale_date date not null,
  row_tone text not null default 'neutral',
  reception_time text,
  receptionist_id uuid references public.users (id) on delete set null,
  receptionist_name_snapshot text,
  reception_swap text,
  note text,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (period_id, scale_date)
);

create table if not exists public.scale_professor_shifts (
  id uuid primary key default gen_random_uuid(),
  scale_day_id uuid not null references public.scale_days (id) on delete cascade,
  shift_order integer not null default 0,
  time_label text not null,
  professor_id uuid references public.users (id) on delete set null,
  professor_name_snapshot text not null,
  swap_name_snapshot text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (scale_day_id, shift_order)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods (id) on delete cascade,
  event_date date not null,
  event_time time,
  type public.event_type not null default 'outro',
  title text not null,
  place text,
  owner_user_id uuid references public.users (id) on delete set null,
  owner_name_snapshot text,
  status public.event_status not null default 'programado',
  description text,
  created_by uuid references public.users (id) on delete set null,
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references public.units (id) on delete cascade,
  period_id uuid references public.periods (id) on delete cascade,
  actor_user_id uuid references public.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.unit_members membership
    where membership.user_id = auth.uid()
      and membership.role = 'admin'
      and membership.active = true
  );
$$;

create or replace function public.has_unit_access(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.unit_members membership
      where membership.user_id = auth.uid()
        and membership.unit_id = target_unit_id
        and membership.active = true
    );
$$;

create or replace function public.can_operate_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.unit_members membership
      where membership.user_id = auth.uid()
        and membership.unit_id = target_unit_id
        and membership.active = true
        and membership.role in ('regional', 'gestor', 'recepcao', 'professor')
    );
$$;

create or replace function public.can_manage_unit(target_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.unit_members membership
      where membership.user_id = auth.uid()
        and membership.unit_id = target_unit_id
        and membership.active = true
        and membership.role in ('regional', 'gestor')
    );
$$;

create or replace function public.has_period_access(target_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.periods period
    where period.id = target_period_id
      and public.has_unit_access(period.unit_id)
  );
$$;

create or replace function public.can_operate_period(target_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.periods period
    where period.id = target_period_id
      and public.can_operate_unit(period.unit_id)
  );
$$;

create or replace function public.can_manage_period(target_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.periods period
    where period.id = target_period_id
      and public.can_manage_unit(period.unit_id)
  );
$$;

create index if not exists idx_unit_members_user_id on public.unit_members (user_id);
create index if not exists idx_periods_unit_status on public.periods (unit_id, status);
create index if not exists idx_addon_types_period_id on public.addon_types (period_id);
create index if not exists idx_student_attendances_period_id on public.student_attendances (period_id);
create index if not exists idx_student_attendances_membership_number on public.student_attendances (membership_number);
create index if not exists idx_student_attendances_receptionist_id on public.student_attendances (receptionist_id);
create index if not exists idx_student_attendances_started_at_date on public.student_attendances (started_at_date);
create index if not exists idx_student_attendances_feedback_status on public.student_attendances (feedback_status);
create index if not exists idx_addon_sales_period_id on public.addon_sales (period_id);
create index if not exists idx_addon_sales_sale_date on public.addon_sales (sale_date);
create index if not exists idx_pending_items_period_id on public.pending_items (period_id);
create index if not exists idx_pending_items_status on public.pending_items (status);
create index if not exists idx_pending_items_requested_at_date on public.pending_items (requested_at_date);
create index if not exists idx_pending_items_assignee_id on public.pending_items (assignee_id);
create index if not exists idx_shift_notes_period_id on public.shift_notes (period_id);
create index if not exists idx_nps_mentions_period_id on public.nps_mentions (period_id);
create index if not exists idx_scale_days_period_id on public.scale_days (period_id);
create index if not exists idx_scale_days_scale_date on public.scale_days (scale_date);
create index if not exists idx_scale_professor_shifts_scale_day_id on public.scale_professor_shifts (scale_day_id);
create index if not exists idx_events_period_id on public.events (period_id);
create index if not exists idx_events_event_date on public.events (event_date);
create index if not exists idx_events_type on public.events (type);
create index if not exists idx_events_status on public.events (status);
create index if not exists idx_audit_events_unit_id_created_at on public.audit_events (unit_id, created_at desc);
create index if not exists idx_audit_events_period_id_created_at on public.audit_events (period_id, created_at desc);

drop trigger if exists trg_units_set_updated_at on public.units;
create trigger trg_units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists trg_unit_members_set_updated_at on public.unit_members;
create trigger trg_unit_members_set_updated_at
before update on public.unit_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_periods_set_updated_at on public.periods;
create trigger trg_periods_set_updated_at
before update on public.periods
for each row execute function public.set_updated_at();

drop trigger if exists trg_period_settings_set_updated_at on public.period_settings;
create trigger trg_period_settings_set_updated_at
before update on public.period_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_addon_types_set_updated_at on public.addon_types;
create trigger trg_addon_types_set_updated_at
before update on public.addon_types
for each row execute function public.set_updated_at();

drop trigger if exists trg_student_attendances_set_updated_at on public.student_attendances;
create trigger trg_student_attendances_set_updated_at
before update on public.student_attendances
for each row execute function public.set_updated_at();

drop trigger if exists trg_addon_sales_set_updated_at on public.addon_sales;
create trigger trg_addon_sales_set_updated_at
before update on public.addon_sales
for each row execute function public.set_updated_at();

drop trigger if exists trg_pending_items_set_updated_at on public.pending_items;
create trigger trg_pending_items_set_updated_at
before update on public.pending_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_nps_period_metrics_set_updated_at on public.nps_period_metrics;
create trigger trg_nps_period_metrics_set_updated_at
before update on public.nps_period_metrics
for each row execute function public.set_updated_at();

drop trigger if exists trg_nps_mentions_set_updated_at on public.nps_mentions;
create trigger trg_nps_mentions_set_updated_at
before update on public.nps_mentions
for each row execute function public.set_updated_at();

drop trigger if exists trg_scale_days_set_updated_at on public.scale_days;
create trigger trg_scale_days_set_updated_at
before update on public.scale_days
for each row execute function public.set_updated_at();

drop trigger if exists trg_scale_professor_shifts_set_updated_at on public.scale_professor_shifts;
create trigger trg_scale_professor_shifts_set_updated_at
before update on public.scale_professor_shifts
for each row execute function public.set_updated_at();

drop trigger if exists trg_events_set_updated_at on public.events;
create trigger trg_events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.units enable row level security;
alter table public.users enable row level security;
alter table public.unit_members enable row level security;
alter table public.periods enable row level security;
alter table public.period_settings enable row level security;
alter table public.addon_types enable row level security;
alter table public.student_attendances enable row level security;
alter table public.addon_sales enable row level security;
alter table public.pending_items enable row level security;
alter table public.shift_notes enable row level security;
alter table public.nps_period_metrics enable row level security;
alter table public.nps_mentions enable row level security;
alter table public.scale_days enable row level security;
alter table public.scale_professor_shifts enable row level security;
alter table public.events enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists units_select on public.units;
create policy units_select
on public.units
for select
using (public.has_unit_access(id));

drop policy if exists units_insert on public.units;
create policy units_insert
on public.units
for insert
with check (public.is_platform_admin());

drop policy if exists units_update on public.units;
create policy units_update
on public.units
for update
using (public.can_manage_unit(id))
with check (public.can_manage_unit(id));

drop policy if exists users_select on public.users;
create policy users_select
on public.users
for select
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.unit_members viewer
    join public.unit_members colleague
      on colleague.unit_id = viewer.unit_id
    where viewer.user_id = auth.uid()
      and viewer.active = true
      and colleague.user_id = users.id
      and colleague.active = true
  )
);

drop policy if exists users_insert on public.users;
create policy users_insert
on public.users
for insert
with check (id = auth.uid() or public.is_platform_admin());

drop policy if exists users_update on public.users;
create policy users_update
on public.users
for update
using (id = auth.uid() or public.is_platform_admin())
with check (id = auth.uid() or public.is_platform_admin());

drop policy if exists unit_members_select on public.unit_members;
create policy unit_members_select
on public.unit_members
for select
using (public.has_unit_access(unit_id));

drop policy if exists unit_members_insert on public.unit_members;
create policy unit_members_insert
on public.unit_members
for insert
with check (public.can_manage_unit(unit_id));

drop policy if exists unit_members_update on public.unit_members;
create policy unit_members_update
on public.unit_members
for update
using (public.can_manage_unit(unit_id))
with check (public.can_manage_unit(unit_id));

drop policy if exists periods_select on public.periods;
create policy periods_select
on public.periods
for select
using (public.has_unit_access(unit_id));

drop policy if exists periods_insert on public.periods;
create policy periods_insert
on public.periods
for insert
with check (public.can_operate_unit(unit_id));

drop policy if exists periods_update on public.periods;
create policy periods_update
on public.periods
for update
using (public.can_manage_unit(unit_id))
with check (public.can_manage_unit(unit_id));

drop policy if exists period_settings_select on public.period_settings;
create policy period_settings_select
on public.period_settings
for select
using (public.has_period_access(period_id));

drop policy if exists period_settings_write on public.period_settings;
create policy period_settings_write
on public.period_settings
for all
using (public.can_manage_period(period_id))
with check (public.can_manage_period(period_id));

drop policy if exists addon_types_select on public.addon_types;
create policy addon_types_select
on public.addon_types
for select
using (public.has_period_access(period_id));

drop policy if exists addon_types_write on public.addon_types;
create policy addon_types_write
on public.addon_types
for all
using (public.can_manage_period(period_id))
with check (public.can_manage_period(period_id));

drop policy if exists student_attendances_select on public.student_attendances;
create policy student_attendances_select
on public.student_attendances
for select
using (public.has_period_access(period_id));

drop policy if exists student_attendances_insert on public.student_attendances;
create policy student_attendances_insert
on public.student_attendances
for insert
with check (public.can_operate_period(period_id));

drop policy if exists student_attendances_update on public.student_attendances;
create policy student_attendances_update
on public.student_attendances
for update
using (public.can_operate_period(period_id))
with check (public.can_operate_period(period_id));

drop policy if exists student_attendances_delete on public.student_attendances;
create policy student_attendances_delete
on public.student_attendances
for delete
using (public.can_manage_period(period_id));

drop policy if exists addon_sales_select on public.addon_sales;
create policy addon_sales_select
on public.addon_sales
for select
using (public.has_period_access(period_id));

drop policy if exists addon_sales_write on public.addon_sales;
create policy addon_sales_write
on public.addon_sales
for all
using (public.can_operate_period(period_id))
with check (public.can_operate_period(period_id));

drop policy if exists pending_items_select on public.pending_items;
create policy pending_items_select
on public.pending_items
for select
using (public.has_period_access(period_id));

drop policy if exists pending_items_insert on public.pending_items;
create policy pending_items_insert
on public.pending_items
for insert
with check (public.can_operate_period(period_id));

drop policy if exists pending_items_update on public.pending_items;
create policy pending_items_update
on public.pending_items
for update
using (public.can_operate_period(period_id))
with check (public.can_operate_period(period_id));

drop policy if exists pending_items_delete on public.pending_items;
create policy pending_items_delete
on public.pending_items
for delete
using (public.can_manage_period(period_id));

drop policy if exists shift_notes_select on public.shift_notes;
create policy shift_notes_select
on public.shift_notes
for select
using (public.has_period_access(period_id));

drop policy if exists shift_notes_insert on public.shift_notes;
create policy shift_notes_insert
on public.shift_notes
for insert
with check (public.can_operate_period(period_id));

drop policy if exists shift_notes_delete on public.shift_notes;
create policy shift_notes_delete
on public.shift_notes
for delete
using (
  public.can_manage_period(period_id)
  or from_user_id = auth.uid()
);

drop policy if exists nps_period_metrics_select on public.nps_period_metrics;
create policy nps_period_metrics_select
on public.nps_period_metrics
for select
using (public.has_period_access(period_id));

drop policy if exists nps_period_metrics_write on public.nps_period_metrics;
create policy nps_period_metrics_write
on public.nps_period_metrics
for all
using (public.can_manage_period(period_id))
with check (public.can_manage_period(period_id));

drop policy if exists nps_mentions_select on public.nps_mentions;
create policy nps_mentions_select
on public.nps_mentions
for select
using (public.has_period_access(period_id));

drop policy if exists nps_mentions_write on public.nps_mentions;
create policy nps_mentions_write
on public.nps_mentions
for all
using (public.can_manage_period(period_id))
with check (public.can_manage_period(period_id));

drop policy if exists scale_days_select on public.scale_days;
create policy scale_days_select
on public.scale_days
for select
using (public.has_period_access(period_id));

drop policy if exists scale_days_write on public.scale_days;
create policy scale_days_write
on public.scale_days
for all
using (public.can_manage_period(period_id))
with check (public.can_manage_period(period_id));

drop policy if exists scale_professor_shifts_select on public.scale_professor_shifts;
create policy scale_professor_shifts_select
on public.scale_professor_shifts
for select
using (
  exists (
    select 1
    from public.scale_days scale_day
    where scale_day.id = scale_professor_shifts.scale_day_id
      and public.has_period_access(scale_day.period_id)
  )
);

drop policy if exists scale_professor_shifts_write on public.scale_professor_shifts;
create policy scale_professor_shifts_write
on public.scale_professor_shifts
for all
using (
  exists (
    select 1
    from public.scale_days scale_day
    where scale_day.id = scale_professor_shifts.scale_day_id
      and public.can_manage_period(scale_day.period_id)
  )
)
with check (
  exists (
    select 1
    from public.scale_days scale_day
    where scale_day.id = scale_professor_shifts.scale_day_id
      and public.can_manage_period(scale_day.period_id)
  )
);

drop policy if exists events_select on public.events;
create policy events_select
on public.events
for select
using (public.has_period_access(period_id));

drop policy if exists events_insert on public.events;
create policy events_insert
on public.events
for insert
with check (public.can_operate_period(period_id));

drop policy if exists events_update on public.events;
create policy events_update
on public.events
for update
using (public.can_operate_period(period_id))
with check (public.can_operate_period(period_id));

drop policy if exists events_delete on public.events;
create policy events_delete
on public.events
for delete
using (public.can_manage_period(period_id));

drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select
on public.audit_events
for select
using (
  public.has_unit_access(unit_id)
  or (unit_id is null and period_id is not null and public.has_period_access(period_id))
);

drop policy if exists audit_events_insert on public.audit_events;
create policy audit_events_insert
on public.audit_events
for insert
with check (
  public.can_manage_unit(unit_id)
  or (unit_id is null and period_id is not null and public.can_manage_period(period_id))
);
