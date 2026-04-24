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
  period_key text not null,
  label text not null,
  status text not null check (status in ('open', 'closed')),
  closed_at timestamptz,
  closed_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (unit_id, period_key)
);

create table if not exists public.period_settings (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  team_snapshot jsonb not null default '[]'::jsonb,
  reception_snapshot jsonb not null default '[]'::jsonb,
  professor_snapshot jsonb not null default '[]'::jsonb,
  month_days integer not null check (month_days between 28 and 31),
  created_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (period_id)
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
  nps_notice_status text not null check (nps_notice_status in ('Sim', 'Não', 'Pendente')),
  receptionist_member_id uuid references public.unit_members(id) on delete set null,
  receptionist_name_snapshot text,
  feedback_status text not null check (feedback_status in ('Respondeu', 'Não respondeu', 'Pendente')),
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

create unique index if not exists addon_sales_unique_entry_idx
on public.addon_sales (
  period_id,
  sale_date,
  coalesce(receptionist_member_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(nullif(trim(lower(receptionist_name_snapshot)), ''), '__sem_recepcionista__'),
  coalesce(addon_type_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(nullif(trim(lower(addon_type_snapshot)), ''), '__sem_addon__'),
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
  status text not null check (status in ('aberto', 'respondido', 'concluido')),
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
  period_id uuid not null references public.periods(id) on delete cascade,
  score numeric(5, 2) not null,
  monthly_goal numeric(5, 2) not null,
  semester_goal numeric(5, 2) not null,
  observations text not null default '',
  updated_by_member_id uuid references public.unit_members(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (period_id)
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
  row_tone text not null check (row_tone in ('green', 'red', 'neutral')),
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
  status text not null check (status in ('Programado', 'Confirmado', 'Concluído', 'Cancelado')),
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

create index if not exists unit_members_unit_id_idx on public.unit_members (unit_id);
create index if not exists unit_members_user_id_idx on public.unit_members (user_id);
create index if not exists periods_unit_id_idx on public.periods (unit_id);
create index if not exists student_attendances_period_id_idx on public.student_attendances (period_id);
create index if not exists student_attendances_membership_number_idx on public.student_attendances (membership_number);
create index if not exists student_attendances_receptionist_member_id_idx on public.student_attendances (receptionist_member_id);
create index if not exists student_attendances_started_at_date_idx on public.student_attendances (started_at_date);
create index if not exists student_attendances_feedback_status_idx on public.student_attendances (feedback_status);
create index if not exists addon_sales_period_id_idx on public.addon_sales (period_id);
create index if not exists pending_items_period_id_idx on public.pending_items (period_id);
create index if not exists pending_items_status_idx on public.pending_items (status);
create index if not exists pending_items_requested_at_date_idx on public.pending_items (requested_at_date);
create index if not exists pending_items_assignee_member_id_idx on public.pending_items (assignee_member_id);
create index if not exists pending_items_membership_number_idx on public.pending_items (membership_number);
create index if not exists shift_notes_period_id_idx on public.shift_notes (period_id);
create index if not exists nps_mentions_period_id_idx on public.nps_mentions (period_id);
create index if not exists nps_mentions_employee_member_id_idx on public.nps_mentions (employee_member_id);
create index if not exists nps_mentions_rank_position_idx on public.nps_mentions (rank_position);
create index if not exists scale_days_period_id_idx on public.scale_days (period_id);
create index if not exists events_period_id_idx on public.events (period_id);
create index if not exists events_event_date_idx on public.events (event_date);
create index if not exists events_type_idx on public.events (type);
create index if not exists events_status_idx on public.events (status);
create index if not exists audit_events_unit_id_idx on public.audit_events (unit_id);
create index if not exists audit_events_period_id_idx on public.audit_events (period_id);
create index if not exists audit_events_event_type_idx on public.audit_events (event_type);

create trigger set_updated_at_units
before update on public.units
for each row execute function public.set_updated_at();

create trigger set_updated_at_users
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_updated_at_unit_members
before update on public.unit_members
for each row execute function public.set_updated_at();

create trigger set_updated_at_periods
before update on public.periods
for each row execute function public.set_updated_at();

create trigger set_updated_at_period_settings
before update on public.period_settings
for each row execute function public.set_updated_at();

create trigger set_updated_at_addon_types
before update on public.addon_types
for each row execute function public.set_updated_at();

create trigger set_updated_at_student_attendances
before update on public.student_attendances
for each row execute function public.set_updated_at();

create trigger set_updated_at_addon_sales
before update on public.addon_sales
for each row execute function public.set_updated_at();

create trigger set_updated_at_pending_items
before update on public.pending_items
for each row execute function public.set_updated_at();

create trigger set_updated_at_nps_period_metrics
before update on public.nps_period_metrics
for each row execute function public.set_updated_at();

create trigger set_updated_at_nps_mentions
before update on public.nps_mentions
for each row execute function public.set_updated_at();

create trigger set_updated_at_scale_days
before update on public.scale_days
for each row execute function public.set_updated_at();

create trigger set_updated_at_scale_professor_shifts
before update on public.scale_professor_shifts
for each row execute function public.set_updated_at();

create trigger set_updated_at_events
before update on public.events
for each row execute function public.set_updated_at();

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, auth_provider)
  values (
    new.id,
    coalesce(new.email, concat(new.id::text, '@placeholder.local')),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1), 'Usuário'),
    coalesce(new.raw_app_meta_data ->> 'provider', 'supabase')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        auth_provider = excluded.auth_provider,
        updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_auth_user_created();

create or replace function public.current_unit_role(p_unit_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select um.role
  from public.unit_members um
  where um.unit_id = p_unit_id
    and um.user_id = auth.uid()
    and um.active = true
  order by case um.role
    when 'admin' then 1
    when 'gestor' then 2
    when 'recepcao' then 3
    when 'professor' then 4
    when 'leitura' then 5
    else 99
  end
  limit 1
$$;

create or replace function public.current_unit_member_id(p_unit_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select um.id
  from public.unit_members um
  where um.unit_id = p_unit_id
    and um.user_id = auth.uid()
    and um.active = true
  limit 1
$$;

create or replace function public.has_unit_role(p_unit_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_unit_role(p_unit_id) = any (p_roles), false)
$$;

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

create policy "users read own profile"
on public.users
for select
using (id = auth.uid());

create policy "users update own profile"
on public.users
for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "unit members read own unit memberships"
on public.unit_members
for select
using (user_id = auth.uid());

create policy "admins manage unit memberships"
on public.unit_members
for all
using (public.has_unit_role(unit_id, array['admin']))
with check (public.has_unit_role(unit_id, array['admin']));

create policy "unit members read units"
on public.units
for select
using (exists (
  select 1
  from public.unit_members um
  where um.unit_id = units.id
    and um.user_id = auth.uid()
    and um.active = true
));

create policy "admins update units"
on public.units
for update
using (public.has_unit_role(id, array['admin']))
with check (public.has_unit_role(id, array['admin']));

create policy "admins insert units"
on public.units
for insert
with check (auth.role() = 'service_role');

create policy "admins delete units"
on public.units
for delete
using (public.has_unit_role(id, array['admin']));

create policy "unit members read periods"
on public.periods
for select
using (public.has_unit_role(unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura']));

create policy "admins and gestores manage periods"
on public.periods
for all
using (public.has_unit_role(unit_id, array['admin', 'gestor']))
with check (public.has_unit_role(unit_id, array['admin', 'gestor']));

create policy "unit members read period settings"
on public.period_settings
for select
using (exists (
  select 1
  from public.periods p
  where p.id = period_settings.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins and gestores manage period settings"
on public.period_settings
for all
using (exists (
  select 1
  from public.periods p
  where p.id = period_settings.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = period_settings.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
));

create policy "unit members read addon types"
on public.addon_types
for select
using (exists (
  select 1
  from public.periods p
  where p.id = addon_types.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins and gestores manage addon types"
on public.addon_types
for all
using (exists (
  select 1
  from public.periods p
  where p.id = addon_types.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = addon_types.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
));

create policy "unit members read student attendances"
on public.student_attendances
for select
using (exists (
  select 1
  from public.periods p
  where p.id = student_attendances.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins gestores recepcao manage student attendances"
on public.student_attendances
for all
using (exists (
  select 1
  from public.periods p
  where p.id = student_attendances.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = student_attendances.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao'])
));

create policy "unit members read addon sales"
on public.addon_sales
for select
using (exists (
  select 1
  from public.periods p
  where p.id = addon_sales.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins gestores recepcao manage addon sales"
on public.addon_sales
for all
using (exists (
  select 1
  from public.periods p
  where p.id = addon_sales.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = addon_sales.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao'])
));

create policy "unit members read pending items"
on public.pending_items
for select
using (exists (
  select 1
  from public.periods p
  where p.id = pending_items.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins gestores recepcao manage pending items"
on public.pending_items
for all
using (exists (
  select 1
  from public.periods p
  where p.id = pending_items.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = pending_items.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao'])
));

create policy "unit members read shift notes"
on public.shift_notes
for select
using (exists (
  select 1
  from public.periods p
  where p.id = shift_notes.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "team manages shift notes"
on public.shift_notes
for all
using (exists (
  select 1
  from public.periods p
  where p.id = shift_notes.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = shift_notes.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor'])
));

create policy "unit members read nps metrics"
on public.nps_period_metrics
for select
using (exists (
  select 1
  from public.periods p
  where p.id = nps_period_metrics.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins and gestores manage nps metrics"
on public.nps_period_metrics
for all
using (exists (
  select 1
  from public.periods p
  where p.id = nps_period_metrics.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = nps_period_metrics.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
));

create policy "unit members read nps mentions"
on public.nps_mentions
for select
using (exists (
  select 1
  from public.periods p
  where p.id = nps_mentions.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins and gestores manage nps mentions"
on public.nps_mentions
for all
using (exists (
  select 1
  from public.periods p
  where p.id = nps_mentions.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = nps_mentions.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
));

create policy "unit members read scale days"
on public.scale_days
for select
using (exists (
  select 1
  from public.periods p
  where p.id = scale_days.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins and gestores manage scale days"
on public.scale_days
for all
using (exists (
  select 1
  from public.periods p
  where p.id = scale_days.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = scale_days.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
));

create policy "unit members read scale professor shifts"
on public.scale_professor_shifts
for select
using (exists (
  select 1
  from public.scale_days sd
  join public.periods p on p.id = sd.period_id
  where sd.id = scale_professor_shifts.scale_day_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins and gestores manage scale professor shifts"
on public.scale_professor_shifts
for all
using (exists (
  select 1
  from public.scale_days sd
  join public.periods p on p.id = sd.period_id
  where sd.id = scale_professor_shifts.scale_day_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
))
with check (exists (
  select 1
  from public.scale_days sd
  join public.periods p on p.id = sd.period_id
  where sd.id = scale_professor_shifts.scale_day_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
));

create policy "unit members read events"
on public.events
for select
using (exists (
  select 1
  from public.periods p
  where p.id = events.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor', 'recepcao', 'professor', 'leitura'])
));

create policy "admins and gestores manage events"
on public.events
for all
using (exists (
  select 1
  from public.periods p
  where p.id = events.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
))
with check (exists (
  select 1
  from public.periods p
  where p.id = events.period_id
    and public.has_unit_role(p.unit_id, array['admin', 'gestor'])
));

create policy "admins and gestores read audit events"
on public.audit_events
for select
using (public.has_unit_role(unit_id, array['admin', 'gestor']));

create policy "system can insert audit events for allowed roles"
on public.audit_events
for insert
with check (public.has_unit_role(unit_id, array['admin', 'gestor', 'recepcao', 'professor']));

comment on table public.units is 'Unidades operacionais do WPM Gestão Interna.';
comment on table public.users is 'Perfis públicos espelhados de auth.users.';
comment on table public.unit_members is 'Vínculo entre usuário autenticado e unidade com papel local.';
comment on table public.periods is 'Agregado mensal por unidade.';
comment on table public.period_settings is 'Configuração efetiva do período, com snapshots de equipe.';
comment on table public.addon_types is 'Catálogo de addons por período.';
comment on table public.student_attendances is 'Atendimentos/alunos novos registrados no período.';
comment on table public.addon_sales is 'Linhas normalizadas de venda de addon, manuais ou derivadas de atendimento.';
comment on table public.pending_items is 'Pendências operacionais abertas no período.';
comment on table public.shift_notes is 'Recados operacionais; leitura por usuário será tratada em etapa posterior.';
comment on table public.nps_period_metrics is 'Métricas agregadas de NPS por período.';
comment on table public.nps_mentions is 'Menções e ranking de NPS por período.';
comment on table public.scale_days is 'Cabeçalho diário da escala.';
comment on table public.scale_professor_shifts is 'Turnos de professor vinculados ao dia de escala.';
comment on table public.events is 'Agenda de eventos, ações, campanhas e treinamentos.';
comment on table public.audit_events is 'Trilha de auditoria para operações críticas e destrutivas.';
