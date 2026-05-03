do $$
declare
  v_periods_id_type text;
begin
  select data_type
    into v_periods_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'periods'
    and column_name = 'id';

  if v_periods_id_type = 'bigint' then
    if to_regclass('public.legacy_periods') is null then
      alter table public.periods rename to legacy_periods;
    else
      raise exception 'Tabela legada public.periods existe, mas public.legacy_periods ja existe. Revise antes de aplicar a baseline canonica.';
    end if;
  end if;

  if to_regclass('public.archives') is not null
     and to_regclass('public.legacy_archives') is null then
    alter table public.archives rename to legacy_archives;
  end if;

  if to_regclass('public.profiles') is not null
     and to_regclass('public.legacy_profiles') is null then
    alter table public.profiles rename to legacy_profiles;
  end if;
end $$;
