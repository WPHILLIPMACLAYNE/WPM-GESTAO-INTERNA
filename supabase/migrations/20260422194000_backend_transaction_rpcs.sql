create or replace function public.period_label_from_key(p_period_key text)
returns text
language sql
immutable
as $$
  select case split_part(p_period_key, '-', 2)
    when '01' then 'Janeiro'
    when '02' then 'Fevereiro'
    when '03' then 'Março'
    when '04' then 'Abril'
    when '05' then 'Maio'
    when '06' then 'Junho'
    when '07' then 'Julho'
    when '08' then 'Agosto'
    when '09' then 'Setembro'
    when '10' then 'Outubro'
    when '11' then 'Novembro'
    when '12' then 'Dezembro'
    else p_period_key
  end || '/' || split_part(p_period_key, '-', 1)
$$;

create or replace function public.next_period_key(p_period_key text)
returns text
language plpgsql
immutable
as $$
declare
  v_year integer;
  v_month integer;
begin
  v_year := split_part(p_period_key, '-', 1)::integer;
  v_month := split_part(p_period_key, '-', 2)::integer;
  if v_month = 12 then
    return format('%s-01', v_year + 1);
  end if;
  return format('%s-%s', v_year, lpad((v_month + 1)::text, 2, '0'));
end;
$$;

create or replace function public.require_unit_role(p_unit_id uuid, p_roles text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  if auth.role() = 'service_role' then
    return null;
  end if;

  if auth.uid() is null then
    raise exception 'Usuário não autenticado.'
      using errcode = '42501';
  end if;

  select um.id
    into v_member_id
  from public.unit_members um
  where um.unit_id = p_unit_id
    and um.user_id = auth.uid()
    and um.active = true
    and um.role = any (p_roles)
  order by case um.role
    when 'admin' then 1
    when 'gestor' then 2
    when 'recepcao' then 3
    when 'professor' then 4
    when 'leitura' then 5
    else 99
  end
  limit 1;

  if v_member_id is null then
    raise exception 'Permissão insuficiente para a unidade %.', p_unit_id
      using errcode = '42501';
  end if;

  return v_member_id;
end;
$$;

create or replace function public.resolve_member_id(p_unit_id uuid, p_display_name text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select um.id
  from public.unit_members um
  where um.unit_id = p_unit_id
    and um.active = true
    and nullif(trim(lower(um.display_name)), '') = nullif(trim(lower(coalesce(p_display_name, ''))), '')
  limit 1
$$;

create or replace function public.resolve_addon_type_id(p_period_id uuid, p_name text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select at.id
  from public.addon_types at
  where at.period_id = p_period_id
    and nullif(trim(lower(at.name)), '') = nullif(trim(lower(coalesce(p_name, ''))), '')
  order by at.sort_order asc, at.created_at asc
  limit 1
$$;

create or replace function public.log_audit_event(
  p_unit_id uuid,
  p_period_id uuid,
  p_actor_member_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_id uuid;
begin
  insert into public.audit_events (
    unit_id,
    period_id,
    actor_member_id,
    event_type,
    entity_type,
    entity_id,
    payload
  )
  values (
    p_unit_id,
    p_period_id,
    p_actor_member_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$$;

create or replace function public.clear_period_operational_data(p_period_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.addon_sales where period_id = p_period_id;
  delete from public.student_attendances where period_id = p_period_id;
  delete from public.pending_items where period_id = p_period_id;
  delete from public.shift_notes where period_id = p_period_id;
  delete from public.nps_mentions where period_id = p_period_id;
  delete from public.nps_period_metrics where period_id = p_period_id;
  delete from public.scale_days where period_id = p_period_id;
  delete from public.events where period_id = p_period_id;
end;
$$;

create or replace function public.apply_clean_period_template(
  p_target_period_id uuid,
  p_source_period_id uuid,
  p_actor_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period record;
  v_source_settings public.period_settings%rowtype;
  v_target_month_days integer := 31;
  v_source_monthly_goal numeric(5, 2) := 75;
  v_source_semester_goal numeric(5, 2) := 80;
  v_addon record;
begin
  select p.*
    into v_period
  from public.periods p
  where p.id = p_target_period_id;

  if v_period.id is null then
    raise exception 'Período alvo % não encontrado.', p_target_period_id;
  end if;

  perform public.clear_period_operational_data(p_target_period_id);

  select ps.*
    into v_source_settings
  from public.period_settings ps
  where ps.period_id = p_source_period_id;

  if v_source_settings.id is not null then
    v_target_month_days := v_source_settings.month_days;
  end if;

  insert into public.period_settings (
    period_id,
    team_snapshot,
    reception_snapshot,
    professor_snapshot,
    month_days,
    created_by_member_id,
    updated_by_member_id
  )
  values (
    p_target_period_id,
    coalesce(v_source_settings.team_snapshot, '[]'::jsonb),
    coalesce(v_source_settings.reception_snapshot, '[]'::jsonb),
    coalesce(v_source_settings.professor_snapshot, '[]'::jsonb),
    v_target_month_days,
    p_actor_member_id,
    p_actor_member_id
  )
  on conflict (period_id) do update
    set team_snapshot = excluded.team_snapshot,
        reception_snapshot = excluded.reception_snapshot,
        professor_snapshot = excluded.professor_snapshot,
        month_days = excluded.month_days,
        updated_by_member_id = excluded.updated_by_member_id;

  delete from public.addon_types where period_id = p_target_period_id;

  for v_addon in
    select name, sort_order, active
    from public.addon_types
    where period_id = p_source_period_id
    order by sort_order asc, created_at asc
  loop
    insert into public.addon_types (period_id, name, sort_order, active)
    values (p_target_period_id, v_addon.name, v_addon.sort_order, v_addon.active);
  end loop;

  select npm.monthly_goal, npm.semester_goal
    into v_source_monthly_goal, v_source_semester_goal
  from public.nps_period_metrics npm
  where npm.period_id = p_source_period_id;

  insert into public.nps_period_metrics (
    period_id,
    score,
    monthly_goal,
    semester_goal,
    observations,
    updated_by_member_id
  )
  values (
    p_target_period_id,
    0,
    coalesce(v_source_monthly_goal, 75),
    coalesce(v_source_semester_goal, 80),
    '',
    p_actor_member_id
  );
end;
$$;

create or replace function public.upsert_period_from_import(
  p_unit_id uuid,
  p_period_key text,
  p_label text,
  p_status text,
  p_closed_at timestamptz,
  p_actor_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_id uuid;
begin
  insert into public.periods (
    unit_id,
    period_key,
    label,
    status,
    closed_at,
    closed_by_member_id
  )
  values (
    p_unit_id,
    p_period_key,
    coalesce(nullif(trim(p_label), ''), public.period_label_from_key(p_period_key)),
    p_status,
    p_closed_at,
    p_actor_member_id
  )
  on conflict (unit_id, period_key) do update
    set label = excluded.label,
        status = excluded.status,
        closed_at = excluded.closed_at,
        closed_by_member_id = excluded.closed_by_member_id
  returning id into v_period_id;

  return v_period_id;
end;
$$;

create or replace function public.replace_period_from_payload(
  p_unit_id uuid,
  p_period_id uuid,
  p_period_data jsonb,
  p_actor_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb := coalesce(p_period_data -> 'settings', '{}'::jsonb);
  v_students jsonb := coalesce(p_period_data -> 'students', '[]'::jsonb);
  v_pending jsonb := coalesce(p_period_data -> 'pending', '[]'::jsonb);
  v_recados jsonb := coalesce(p_period_data -> 'recados', '[]'::jsonb);
  v_nps jsonb := coalesce(p_period_data -> 'nps', '{}'::jsonb);
  v_scale jsonb := coalesce(p_period_data -> 'scale', '[]'::jsonb);
  v_events jsonb := coalesce(p_period_data -> 'events', '[]'::jsonb);
  v_addons jsonb := coalesce(p_period_data -> 'addons', '{}'::jsonb);
  v_month_days integer := greatest(28, least(31, coalesce((v_settings ->> 'monthDays')::integer, 31)));
  v_period_key text;
  v_period_year integer;
  v_period_month integer;
  v_student jsonb;
  v_pending_item jsonb;
  v_recado jsonb;
  v_mention jsonb;
  v_scale_day jsonb;
  v_shift jsonb;
  v_event jsonb;
  v_person_key text;
  v_person_value jsonb;
  v_type_key text;
  v_type_value jsonb;
  v_qty integer;
  v_index integer;
  v_scale_day_id uuid;
  v_receptionist_id uuid;
  v_assignee_id uuid;
  v_from_member_id uuid;
  v_to_member_id uuid;
  v_owner_member_id uuid;
  v_employee_member_id uuid;
  v_addon_type_id uuid;
begin
  select p.period_key
    into v_period_key
  from public.periods p
  where p.id = p_period_id;

  v_period_year := split_part(v_period_key, '-', 1)::integer;
  v_period_month := split_part(v_period_key, '-', 2)::integer;

  perform public.clear_period_operational_data(p_period_id);

  insert into public.period_settings (
    period_id,
    team_snapshot,
    reception_snapshot,
    professor_snapshot,
    month_days,
    created_by_member_id,
    updated_by_member_id
  )
  values (
    p_period_id,
    coalesce(v_settings -> 'team', '[]'::jsonb),
    coalesce(v_settings -> 'receptionists', coalesce(v_settings -> 'team', '[]'::jsonb)),
    coalesce(v_settings -> 'professors', '[]'::jsonb),
    v_month_days,
    p_actor_member_id,
    p_actor_member_id
  )
  on conflict (period_id) do update
    set team_snapshot = excluded.team_snapshot,
        reception_snapshot = excluded.reception_snapshot,
        professor_snapshot = excluded.professor_snapshot,
        month_days = excluded.month_days,
        updated_by_member_id = excluded.updated_by_member_id;

  delete from public.addon_types where period_id = p_period_id;

  if jsonb_typeof(coalesce(v_settings -> 'addonTypes', '[]'::jsonb)) = 'array' then
    insert into public.addon_types (period_id, name, sort_order, active)
    select
      p_period_id,
      value::text,
      row_number() over (),
      true
    from jsonb_array_elements_text(v_settings -> 'addonTypes');
  end if;

  insert into public.nps_period_metrics (
    period_id,
    score,
    monthly_goal,
    semester_goal,
    observations,
    updated_by_member_id
  )
  values (
    p_period_id,
    greatest(0, least(100, coalesce((v_nps ->> 'score')::numeric, 0))),
    greatest(0, least(100, coalesce((v_nps ->> 'monthlyGoal')::numeric, 75))),
    greatest(0, least(100, coalesce((v_nps ->> 'semesterGoal')::numeric, 80))),
    coalesce(v_nps ->> 'observations', ''),
    p_actor_member_id
  );

  if jsonb_typeof(coalesce(v_nps -> 'mentions', '[]'::jsonb)) = 'array' then
    for v_mention in
      select value from jsonb_array_elements(v_nps -> 'mentions')
    loop
      v_employee_member_id := public.resolve_member_id(p_unit_id, v_mention ->> 'name');
      insert into public.nps_mentions (
        period_id,
        employee_member_id,
        name_snapshot,
        count,
        rank_position,
        updated_by_member_id
      )
      values (
        p_period_id,
        v_employee_member_id,
        coalesce(v_mention ->> 'name', ''),
        greatest(0, coalesce((v_mention ->> 'count')::integer, 0)),
        case
          when jsonb_typeof(coalesce(v_nps -> 'rankSnapshot', '{}'::jsonb)) = 'object'
            then nullif(v_nps -> 'rankSnapshot' ->> coalesce(v_mention ->> 'id', ''), '')::integer
          else null
        end,
        p_actor_member_id
      );
    end loop;
  end if;

  if jsonb_typeof(v_students) = 'array' then
    for v_student in
      select value from jsonb_array_elements(v_students)
    loop
      v_receptionist_id := public.resolve_member_id(p_unit_id, v_student ->> 'atendimento');
      v_addon_type_id := public.resolve_addon_type_id(p_period_id, v_student ->> 'addon');

      insert into public.student_attendances (
        id,
        period_id,
        student_name,
        membership_number,
        last_visit_date,
        last_visit_time,
        started_at_date,
        nps_notice_status,
        receptionist_member_id,
        receptionist_name_snapshot,
        feedback_status,
        addon_type_id,
        addon_type_snapshot,
        notes,
        created_by_member_id,
        updated_by_member_id
      )
      values (
        coalesce(nullif(v_student ->> 'id', '')::uuid, gen_random_uuid()),
        p_period_id,
        coalesce(v_student ->> 'nome', ''),
        nullif(v_student ->> 'matricula', ''),
        nullif(v_student ->> 'ultimaVisita', '')::date,
        nullif(v_student ->> 'horaVisita', ''),
        coalesce(nullif(v_student ->> 'inicio', '')::date, current_date),
        coalesce(nullif(v_student ->> 'avisoNps', ''), 'Pendente'),
        v_receptionist_id,
        nullif(v_student ->> 'atendimento', ''),
        coalesce(nullif(v_student ->> 'feedback', ''), 'Pendente'),
        v_addon_type_id,
        nullif(v_student ->> 'addon', ''),
        coalesce(v_student ->> 'observacoes', ''),
        p_actor_member_id,
        p_actor_member_id
      );
    end loop;
  end if;

  if jsonb_typeof(v_pending) = 'array' then
    for v_pending_item in
      select value from jsonb_array_elements(v_pending)
    loop
      v_assignee_id := public.resolve_member_id(p_unit_id, v_pending_item ->> 'hostess');
      insert into public.pending_items (
        id,
        period_id,
        student_name,
        membership_number,
        description,
        requested_at_date,
        assignee_member_id,
        assignee_name_snapshot,
        response,
        status,
        created_by_member_id,
        updated_by_member_id
      )
      values (
        coalesce(nullif(v_pending_item ->> 'id', '')::uuid, gen_random_uuid()),
        p_period_id,
        coalesce(v_pending_item ->> 'nome', ''),
        nullif(v_pending_item ->> 'matricula', ''),
        coalesce(v_pending_item ->> 'pendencia', ''),
        coalesce(nullif(v_pending_item ->> 'data', '')::date, current_date),
        v_assignee_id,
        nullif(v_pending_item ->> 'hostess', ''),
        coalesce(v_pending_item ->> 'resposta', ''),
        coalesce(nullif(v_pending_item ->> 'status', ''), 'aberto'),
        p_actor_member_id,
        p_actor_member_id
      );
    end loop;
  end if;

  if jsonb_typeof(v_recados) = 'array' then
    for v_recado in
      select value from jsonb_array_elements(v_recados)
    loop
      v_from_member_id := public.resolve_member_id(p_unit_id, v_recado ->> 'from');
      v_to_member_id := public.resolve_member_id(p_unit_id, v_recado ->> 'to');
      insert into public.shift_notes (
        id,
        period_id,
        from_member_id,
        from_name_snapshot,
        to_member_id,
        to_audience,
        message,
        created_by_member_id,
        created_at
      )
      values (
        coalesce(nullif(v_recado ->> 'id', '')::uuid, gen_random_uuid()),
        p_period_id,
        v_from_member_id,
        coalesce(v_recado ->> 'from', ''),
        v_to_member_id,
        coalesce(nullif(v_recado ->> 'to', ''), 'Todos'),
        coalesce(v_recado ->> 'text', v_recado ->> 'message', ''),
        p_actor_member_id,
        coalesce(nullif(v_recado ->> 'createdAt', '')::timestamptz, timezone('utc', now()))
      );
    end loop;
  end if;

  if jsonb_typeof(v_scale) = 'array' then
    for v_scale_day in
      select value from jsonb_array_elements(v_scale)
    loop
      v_receptionist_id := public.resolve_member_id(p_unit_id, v_scale_day ->> 'receptionist');
      insert into public.scale_days (
        id,
        period_id,
        scale_date,
        row_tone,
        reception_time,
        receptionist_member_id,
        receptionist_name_snapshot,
        reception_swap,
        note,
        created_by_member_id,
        updated_by_member_id
      )
      values (
        coalesce(nullif(v_scale_day ->> 'id', '')::uuid, gen_random_uuid()),
        p_period_id,
        coalesce(nullif(v_scale_day ->> 'date', '')::date, current_date),
        coalesce(nullif(v_scale_day ->> 'rowTone', ''), 'neutral'),
        nullif(v_scale_day ->> 'receptionTime', ''),
        v_receptionist_id,
        nullif(v_scale_day ->> 'receptionist', ''),
        nullif(v_scale_day ->> 'receptionSwap', ''),
        coalesce(v_scale_day ->> 'note', ''),
        p_actor_member_id,
        p_actor_member_id
      )
      returning id into v_scale_day_id;

      if jsonb_typeof(coalesce(v_scale_day -> 'professorShifts', '[]'::jsonb)) = 'array' then
        for v_shift in
          select value from jsonb_array_elements(v_scale_day -> 'professorShifts')
        loop
          insert into public.scale_professor_shifts (
            id,
            scale_day_id,
            time_label,
            professor_member_id,
            professor_name_snapshot,
            swap_name_snapshot,
            sort_order
          )
          values (
            coalesce(nullif(v_shift ->> 'id', '')::uuid, gen_random_uuid()),
            v_scale_day_id,
            coalesce(v_shift ->> 'time', ''),
            public.resolve_member_id(p_unit_id, v_shift ->> 'name'),
            nullif(v_shift ->> 'name', ''),
            nullif(v_shift ->> 'swap', ''),
            coalesce((v_shift ->> 'sortOrder')::integer, 0)
          );
        end loop;
      end if;
    end loop;
  end if;

  if jsonb_typeof(v_events) = 'array' then
    for v_event in
      select value from jsonb_array_elements(v_events)
    loop
      v_owner_member_id := public.resolve_member_id(p_unit_id, v_event ->> 'owner');
      insert into public.events (
        id,
        period_id,
        event_date,
        event_time,
        type,
        title,
        place,
        owner_member_id,
        owner_name_snapshot,
        status,
        description,
        created_by_member_id,
        updated_by_member_id
      )
      values (
        coalesce(nullif(v_event ->> 'id', '')::uuid, gen_random_uuid()),
        p_period_id,
        coalesce(nullif(v_event ->> 'date', '')::date, current_date),
        nullif(v_event ->> 'time', ''),
        coalesce(nullif(v_event ->> 'type', ''), 'Evento'),
        coalesce(v_event ->> 'title', ''),
        coalesce(v_event ->> 'place', ''),
        v_owner_member_id,
        nullif(v_event ->> 'owner', ''),
        coalesce(nullif(v_event ->> 'status', ''), 'Programado'),
        coalesce(v_event ->> 'description', ''),
        p_actor_member_id,
        p_actor_member_id
      );
    end loop;
  end if;

  if jsonb_typeof(v_addons) = 'object' then
    for v_person_key, v_person_value in
      select key, value
      from jsonb_each(v_addons)
    loop
      if jsonb_typeof(v_person_value) <> 'object' then
        continue;
      end if;

      for v_type_key, v_type_value in
        select key, value
        from jsonb_each(v_person_value)
      loop
        if jsonb_typeof(v_type_value) <> 'array' then
          continue;
        end if;

        v_receptionist_id := public.resolve_member_id(p_unit_id, v_person_key);
        v_addon_type_id := public.resolve_addon_type_id(p_period_id, v_type_key);

        for v_index in 0 .. greatest(jsonb_array_length(v_type_value) - 1, 0) loop
          if v_index + 1 > v_month_days then
            continue;
          end if;
          v_qty := greatest(0, coalesce((v_type_value ->> v_index)::integer, 0));
          if v_qty = 0 then
            continue;
          end if;

          insert into public.addon_sales (
            period_id,
            sale_date,
            receptionist_member_id,
            receptionist_name_snapshot,
            addon_type_id,
            addon_type_snapshot,
            quantity,
            source,
            student_attendance_id,
            created_by_member_id,
            updated_by_member_id
          )
          values (
            p_period_id,
            make_date(v_period_year, v_period_month, v_index + 1),
            v_receptionist_id,
            v_person_key,
            v_addon_type_id,
            v_type_key,
            v_qty,
            'manual',
            null,
            p_actor_member_id,
            p_actor_member_id
          );
        end loop;
      end loop;
    end loop;
  end if;
end;
$$;

create or replace function public.close_period_transaction(
  p_period_id uuid,
  p_archive_payload jsonb default '{}'::jsonb,
  p_next_period_key text default null,
  p_next_period_label text default null,
  p_reset_next_period boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.periods%rowtype;
  v_actor_member_id uuid;
  v_next_period_id uuid;
  v_next_period_key text;
  v_next_period_label text;
  v_next_exists boolean;
begin
  select *
    into v_period
  from public.periods
  where id = p_period_id
  for update;

  if v_period.id is null then
    raise exception 'Período % não encontrado.', p_period_id;
  end if;

  v_actor_member_id := public.require_unit_role(v_period.unit_id, array['admin', 'gestor']);

  if v_period.status = 'closed' then
    raise exception 'Período % já está fechado.', v_period.period_key;
  end if;

  update public.periods
     set status = 'closed',
         closed_at = timezone('utc', now()),
         closed_by_member_id = v_actor_member_id
   where id = v_period.id;

  perform public.log_audit_event(
    v_period.unit_id,
    v_period.id,
    v_actor_member_id,
    'close-month',
    'period',
    v_period.id,
    jsonb_build_object(
      'periodKey', v_period.period_key,
      'label', v_period.label,
      'archivePayload', coalesce(p_archive_payload, '{}'::jsonb)
    )
  );

  v_next_period_key := coalesce(nullif(trim(p_next_period_key), ''), public.next_period_key(v_period.period_key));
  v_next_period_label := coalesce(nullif(trim(p_next_period_label), ''), public.period_label_from_key(v_next_period_key));

  select p.id is not null, p.id
    into v_next_exists, v_next_period_id
  from public.periods p
  where p.unit_id = v_period.unit_id
    and p.period_key = v_next_period_key;

  if not coalesce(v_next_exists, false) then
    insert into public.periods (
      unit_id,
      period_key,
      label,
      status
    )
    values (
      v_period.unit_id,
      v_next_period_key,
      v_next_period_label,
      'open'
    )
    returning id into v_next_period_id;

    perform public.apply_clean_period_template(v_next_period_id, v_period.id, v_actor_member_id);
  elsif p_reset_next_period then
    update public.periods
       set status = 'open',
           closed_at = null,
           closed_by_member_id = null,
           label = v_next_period_label
     where id = v_next_period_id;

    perform public.apply_clean_period_template(v_next_period_id, v_period.id, v_actor_member_id);
  end if;

  return jsonb_build_object(
    'closedPeriodId', v_period.id,
    'closedPeriodKey', v_period.period_key,
    'nextPeriodId', v_next_period_id,
    'nextPeriodKey', v_next_period_key,
    'nextPeriodReset', case when not coalesce(v_next_exists, false) then true else p_reset_next_period end
  );
end;
$$;

create or replace function public.reset_period_transaction(
  p_period_id uuid,
  p_backup_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.periods%rowtype;
  v_actor_member_id uuid;
  v_existing_goal record;
begin
  select *
    into v_period
  from public.periods
  where id = p_period_id
  for update;

  if v_period.id is null then
    raise exception 'Período % não encontrado.', p_period_id;
  end if;

  v_actor_member_id := public.require_unit_role(v_period.unit_id, array['admin', 'gestor']);

  if v_period.status = 'closed' then
    raise exception 'Período % está fechado e não pode ser resetado.', v_period.period_key;
  end if;

  select monthly_goal, semester_goal
    into v_existing_goal
  from public.nps_period_metrics
  where period_id = v_period.id;

  perform public.clear_period_operational_data(v_period.id);

  insert into public.nps_period_metrics (
    period_id,
    score,
    monthly_goal,
    semester_goal,
    observations,
    updated_by_member_id
  )
  values (
    v_period.id,
    0,
    coalesce(v_existing_goal.monthly_goal, 75),
    coalesce(v_existing_goal.semester_goal, 80),
    '',
    v_actor_member_id
  );

  perform public.log_audit_event(
    v_period.unit_id,
    v_period.id,
    v_actor_member_id,
    'reset-month',
    'period',
    v_period.id,
    jsonb_build_object(
      'periodKey', v_period.period_key,
      'label', v_period.label,
      'backupPayload', coalesce(p_backup_payload, '{}'::jsonb)
    )
  );

  return jsonb_build_object(
    'periodId', v_period.id,
    'periodKey', v_period.period_key,
    'status', 'reset'
  );
end;
$$;

create or replace function public.import_backup_transaction(
  p_unit_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_member_id uuid;
  v_kind text;
  v_period_key text;
  v_period_id uuid;
  v_period_data jsonb;
  v_deleted_periods integer := 0;
  v_processed_periods integer := 0;
  v_archive jsonb := coalesce(p_payload -> 'archives', '{}'::jsonb);
  v_entry record;
  v_existing record;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload de importação inválido.';
  end if;

  v_actor_member_id := public.require_unit_role(p_unit_id, array['admin', 'gestor']);
  v_kind := coalesce(p_payload -> 'meta' ->> 'kind', '');

  if v_kind = 'month-archive' then
    v_period_key := p_payload ->> 'periodKey';
    if v_period_key is null or v_period_key !~ '^\d{4}-\d{2}$' then
      raise exception 'periodKey inválido para month-archive.';
    end if;

    v_period_id := public.upsert_period_from_import(
      p_unit_id,
      v_period_key,
      coalesce(p_payload ->> 'periodLabel', public.period_label_from_key(v_period_key)),
      'closed',
      coalesce(nullif(p_payload -> 'meta' ->> 'exportedAt', '')::timestamptz, timezone('utc', now())),
      v_actor_member_id
    );

    perform public.replace_period_from_payload(
      p_unit_id,
      v_period_id,
      coalesce(p_payload -> 'data', '{}'::jsonb),
      v_actor_member_id
    );

    perform public.log_audit_event(
      p_unit_id,
      v_period_id,
      v_actor_member_id,
      'backup-import',
      'month-archive',
      v_period_id,
      jsonb_build_object(
        'kind', 'month-archive',
        'periodKey', v_period_key
      )
    );

    return jsonb_build_object(
      'kind', 'month-archive',
      'processedPeriods', 1,
      'deletedPeriods', 0
    );
  end if;

  if v_kind <> 'app-backup' and v_kind <> 'full-backup' then
    raise exception 'kind de backup não suportado: %', v_kind;
  end if;

  if jsonb_typeof(coalesce(p_payload -> 'periods', '{}'::jsonb)) <> 'object' then
    raise exception 'Backup completo sem periods válido.';
  end if;

  for v_existing in
    select p.id, p.period_key
    from public.periods p
    where p.unit_id = p_unit_id
      and not ((p_payload -> 'periods') ? p.period_key)
  loop
    delete from public.periods where id = v_existing.id;
    v_deleted_periods := v_deleted_periods + 1;
  end loop;

  for v_entry in
    select key, value
    from jsonb_each(p_payload -> 'periods')
  loop
    v_period_key := v_entry.key;
    v_period_data := coalesce(v_entry.value, '{}'::jsonb);

    v_period_id := public.upsert_period_from_import(
      p_unit_id,
      v_period_key,
      public.period_label_from_key(v_period_key),
      case when coalesce(v_archive ? v_period_key, false) then 'closed' else 'open' end,
      case
        when coalesce(v_archive ? v_period_key, false)
          then coalesce(nullif(v_archive -> v_period_key ->> 'closedAt', '')::timestamptz, timezone('utc', now()))
        else null
      end,
      v_actor_member_id
    );

    perform public.replace_period_from_payload(
      p_unit_id,
      v_period_id,
      v_period_data,
      v_actor_member_id
    );

    v_processed_periods := v_processed_periods + 1;
  end loop;

  perform public.log_audit_event(
    p_unit_id,
    null,
    v_actor_member_id,
    'backup-import',
    'full-backup',
    null,
    jsonb_build_object(
      'kind', coalesce(v_kind, 'app-backup'),
      'processedPeriods', v_processed_periods,
      'deletedPeriods', v_deleted_periods
    )
  );

  return jsonb_build_object(
    'kind', coalesce(v_kind, 'app-backup'),
    'processedPeriods', v_processed_periods,
    'deletedPeriods', v_deleted_periods
  );
end;
$$;

create or replace function public.link_student_attendance_addon_transaction(
  p_student_attendance_id uuid,
  p_sale_date date default null,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendance public.student_attendances%rowtype;
  v_period public.periods%rowtype;
  v_actor_member_id uuid;
  v_sale_id uuid;
  v_effective_sale_date date;
begin
  select sa.*
    into v_attendance
  from public.student_attendances sa
  where sa.id = p_student_attendance_id
  for update;

  if v_attendance.id is null then
    raise exception 'Atendimento % não encontrado.', p_student_attendance_id;
  end if;

  select *
    into v_period
  from public.periods p
  where p.id = v_attendance.period_id;

  if v_period.id is null then
    raise exception 'Período do atendimento % não encontrado.', p_student_attendance_id;
  end if;

  v_actor_member_id := public.require_unit_role(v_period.unit_id, array['admin', 'gestor', 'recepcao']);
  v_effective_sale_date := coalesce(p_sale_date, v_attendance.started_at_date, current_date);

  if v_attendance.addon_type_id is null and coalesce(v_attendance.addon_type_snapshot, '') = '' then
    delete from public.addon_sales
    where student_attendance_id = v_attendance.id
      and source = 'student_attendance';

    perform public.log_audit_event(
      v_period.unit_id,
      v_period.id,
      v_actor_member_id,
      'attendance-addon-link',
      'student_attendance',
      v_attendance.id,
      jsonb_build_object(
        'action', 'delete-linked-addon-sale',
        'studentAttendanceId', v_attendance.id
      )
    );

    return jsonb_build_object(
      'studentAttendanceId', v_attendance.id,
      'saleAction', 'deleted'
    );
  end if;

  select ads.id
    into v_sale_id
  from public.addon_sales ads
  where ads.student_attendance_id = v_attendance.id
    and ads.source = 'student_attendance'
  limit 1
  for update;

  if v_sale_id is null then
    insert into public.addon_sales (
      period_id,
      sale_date,
      receptionist_member_id,
      receptionist_name_snapshot,
      addon_type_id,
      addon_type_snapshot,
      quantity,
      source,
      student_attendance_id,
      created_by_member_id,
      updated_by_member_id
    )
    values (
      v_attendance.period_id,
      v_effective_sale_date,
      v_attendance.receptionist_member_id,
      v_attendance.receptionist_name_snapshot,
      v_attendance.addon_type_id,
      v_attendance.addon_type_snapshot,
      greatest(0, coalesce(p_quantity, 1)),
      'student_attendance',
      v_attendance.id,
      v_actor_member_id,
      v_actor_member_id
    )
    returning id into v_sale_id;
  else
    update public.addon_sales
       set sale_date = v_effective_sale_date,
           receptionist_member_id = v_attendance.receptionist_member_id,
           receptionist_name_snapshot = v_attendance.receptionist_name_snapshot,
           addon_type_id = v_attendance.addon_type_id,
           addon_type_snapshot = v_attendance.addon_type_snapshot,
           quantity = greatest(0, coalesce(p_quantity, 1)),
           updated_by_member_id = v_actor_member_id
     where id = v_sale_id;
  end if;

  perform public.log_audit_event(
    v_period.unit_id,
    v_period.id,
    v_actor_member_id,
    'attendance-addon-link',
    'student_attendance',
    v_attendance.id,
    jsonb_build_object(
      'saleId', v_sale_id,
      'saleDate', v_effective_sale_date,
      'quantity', greatest(0, coalesce(p_quantity, 1))
    )
  );

  return jsonb_build_object(
    'studentAttendanceId', v_attendance.id,
    'saleId', v_sale_id,
    'saleAction', 'upserted'
  );
end;
$$;

grant execute on function public.close_period_transaction(uuid, jsonb, text, text, boolean) to authenticated, service_role;
grant execute on function public.reset_period_transaction(uuid, jsonb) to authenticated, service_role;
grant execute on function public.import_backup_transaction(uuid, jsonb) to authenticated, service_role;
grant execute on function public.link_student_attendance_addon_transaction(uuid, date, integer) to authenticated, service_role;
