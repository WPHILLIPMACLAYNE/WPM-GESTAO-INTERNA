create or replace function public.bootstrap_unit_admin(
  p_user_id uuid,
  p_unit_name text,
  p_unit_slug text,
  p_display_name text,
  p_period_key text default to_char(timezone('America/Sao_Paulo', now()), 'YYYY-MM'),
  p_timezone text default 'America/Sao_Paulo',
  p_month_days integer default null
)
returns table (
  boot_unit_id uuid,
  boot_unit_member_id uuid,
  boot_period_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit_id uuid;
  v_unit_member_id uuid;
  v_period_id uuid;
  v_existing_admin_count integer := 0;
  v_month_days integer;
begin
  if auth.role() <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'bootstrap_unit_admin só pode ser executada por service_role ou SQL administrativo.'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'p_user_id é obrigatório.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_unit_name, '')), '') is null then
    raise exception 'p_unit_name é obrigatório.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_unit_slug, '')), '') is null then
    raise exception 'p_unit_slug é obrigatório.'
      using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_display_name, '')), '') is null then
    raise exception 'p_display_name é obrigatório.'
      using errcode = '22023';
  end if;

  if p_period_key !~ '^\d{4}-\d{2}$' then
    raise exception 'p_period_key deve seguir o formato YYYY-MM.'
      using errcode = '22007';
  end if;

  if not exists (
    select 1
    from public.users u
    where u.id = p_user_id
  ) then
    raise exception 'Usuário % não existe em public.users.', p_user_id
      using errcode = '23503';
  end if;

  if p_month_days is not null and (p_month_days < 28 or p_month_days > 31) then
    raise exception 'p_month_days deve estar entre 28 e 31.'
      using errcode = '22023';
  end if;

  v_month_days := coalesce(
    p_month_days,
    extract(
      day
      from (
        date_trunc('month', to_date(p_period_key || '-01', 'YYYY-MM-DD'))
        + interval '1 month'
        - interval '1 day'
      )
    )::integer
  );

  insert into public.units (name, slug, timezone, active)
  values (
    trim(p_unit_name),
    lower(trim(p_unit_slug)),
    coalesce(nullif(trim(coalesce(p_timezone, '')), ''), 'America/Sao_Paulo'),
    true
  )
  on conflict (slug) do update
    set name = excluded.name,
        timezone = excluded.timezone,
        active = true,
        updated_at = timezone('utc', now())
  returning id into v_unit_id;

  select count(*)
    into v_existing_admin_count
  from public.unit_members um
  where um.unit_id = v_unit_id
    and um.active = true
    and um.role = 'admin'
    and um.user_id <> p_user_id;

  if v_existing_admin_count > 0 then
    raise exception 'A unidade % já possui outro admin ativo; bootstrap inicial recusado.', v_unit_id
      using errcode = '23505';
  end if;

  insert into public.unit_members (
    unit_id,
    user_id,
    display_name,
    role,
    active
  )
  values (
    v_unit_id,
    p_user_id,
    trim(p_display_name),
    'admin',
    true
  )
  on conflict (unit_id, user_id) do update
    set display_name = excluded.display_name,
        role = 'admin',
        active = true,
        updated_at = timezone('utc', now())
  returning id into v_unit_member_id;

  insert into public.periods (
    unit_id,
    period_key,
    label,
    status
  )
  values (
    v_unit_id,
    p_period_key,
    public.period_label_from_key(p_period_key),
    'open'
  )
  on conflict (unit_id, period_key) do update
    set label = excluded.label,
        updated_at = timezone('utc', now())
  returning id into v_period_id;

  insert into public.period_settings (
    period_id,
    month_days,
    created_by_member_id,
    updated_by_member_id
  )
  values (
    v_period_id,
    v_month_days,
    v_unit_member_id,
    v_unit_member_id
  )
  on conflict (period_id) do nothing;

  return query
  select v_unit_id, v_unit_member_id, v_period_id;
end;
$$;

revoke all on function public.bootstrap_unit_admin(uuid, text, text, text, text, text, integer) from public;
grant execute on function public.bootstrap_unit_admin(uuid, text, text, text, text, text, integer) to service_role;

comment on function public.bootstrap_unit_admin(uuid, text, text, text, text, text, integer)
is 'Bootstrap inicial de uma unidade e do vínculo admin. Uso exclusivo de service_role/SQL administrativo.';
