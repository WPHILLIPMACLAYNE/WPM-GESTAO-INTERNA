create or replace function public.get_unit_sync_checkpoint(
  p_unit_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_member_id uuid;
  v_max_updated_at timestamptz;
  v_period_count integer := 0;
  v_row_count integer := 0;
  v_audit_count integer := 0;
  v_revision text;
begin
  v_actor_member_id := public.require_unit_role(
    p_unit_id,
    array['admin', 'gestor', 'recepcao', 'professor', 'leitura']
  );

  with unit_periods as (
    select p.id
    from public.periods p
    where p.unit_id = p_unit_id
  ),
  touched as (
    select p.updated_at from public.periods p where p.unit_id = p_unit_id
    union all
    select ps.updated_at from public.period_settings ps join unit_periods up on up.id = ps.period_id
    union all
    select at.updated_at from public.addon_types at join unit_periods up on up.id = at.period_id
    union all
    select sa.updated_at from public.student_attendances sa join unit_periods up on up.id = sa.period_id
    union all
    select ads.updated_at from public.addon_sales ads join unit_periods up on up.id = ads.period_id
    union all
    select pi.updated_at from public.pending_items pi join unit_periods up on up.id = pi.period_id
    union all
    select sn.created_at as updated_at from public.shift_notes sn join unit_periods up on up.id = sn.period_id
    union all
    select npm.updated_at from public.nps_period_metrics npm join unit_periods up on up.id = npm.period_id
    union all
    select nm.updated_at from public.nps_mentions nm join unit_periods up on up.id = nm.period_id
    union all
    select sd.updated_at from public.scale_days sd join unit_periods up on up.id = sd.period_id
    union all
    select sps.updated_at
    from public.scale_professor_shifts sps
    join public.scale_days sd on sd.id = sps.scale_day_id
    join unit_periods up on up.id = sd.period_id
    union all
    select e.updated_at from public.events e join unit_periods up on up.id = e.period_id
    union all
    select ae.created_at as updated_at from public.audit_events ae where ae.unit_id = p_unit_id
  )
  select max(updated_at), count(*)
    into v_max_updated_at, v_row_count
  from touched;

  select count(*)
    into v_period_count
  from public.periods p
  where p.unit_id = p_unit_id;

  select count(*)
    into v_audit_count
  from public.audit_events ae
  where ae.unit_id = p_unit_id;

  v_revision := case
    when v_row_count = 0 and v_period_count = 0 and v_audit_count = 0 then ''
    else concat_ws(
      ':',
      coalesce(v_max_updated_at::text, ''),
      coalesce(v_period_count, 0)::text,
      coalesce(v_row_count, 0)::text,
      coalesce(v_audit_count, 0)::text
    )
  end;

  return jsonb_build_object(
    'revision', v_revision,
    'maxUpdatedAt', coalesce(v_max_updated_at::text, ''),
    'periodCount', coalesce(v_period_count, 0),
    'auditCount', coalesce(v_audit_count, 0)
  );
end;
$$;

create or replace function public.import_backup_transaction_guarded(
  p_unit_id uuid,
  p_payload jsonb,
  p_expected_checkpoint jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_checkpoint jsonb;
  v_result jsonb;
begin
  perform public.require_unit_role(p_unit_id, array['admin', 'gestor']);
  perform pg_advisory_xact_lock(hashtextextended(p_unit_id::text, 0));

  v_current_checkpoint := public.get_unit_sync_checkpoint(p_unit_id);

  if p_expected_checkpoint is null then
    if coalesce((v_current_checkpoint ->> 'periodCount')::integer, 0) > 0
      or coalesce((v_current_checkpoint ->> 'auditCount')::integer, 0) > 0 then
      raise exception 'WPM_SYNC_CONFLICT: backend possui dados sem checkpoint local conhecido; recarregue do backend antes de sincronizar.';
    end if;
  elsif v_current_checkpoint is distinct from p_expected_checkpoint then
    raise exception 'WPM_SYNC_CONFLICT: checkpoint remoto divergente; recarregue do backend antes de sincronizar.';
  end if;

  v_result := public.import_backup_transaction(p_unit_id, p_payload);

  return v_result || jsonb_build_object(
    'previousCheckpoint', v_current_checkpoint,
    'nextCheckpoint', public.get_unit_sync_checkpoint(p_unit_id)
  );
end;
$$;

grant execute on function public.get_unit_sync_checkpoint(uuid) to authenticated, service_role;
grant execute on function public.import_backup_transaction_guarded(uuid, jsonb, jsonb) to authenticated, service_role;
