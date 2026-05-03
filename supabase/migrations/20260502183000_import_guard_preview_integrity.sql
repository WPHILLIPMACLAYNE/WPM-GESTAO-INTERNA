create or replace function public.backup_integrity_canonical_json(
  p_value jsonb
)
returns text
language plpgsql
stable
as $$
declare
  v_type text := jsonb_typeof(p_value);
  v_result text;
begin
  if p_value is null then
    return 'null';
  end if;

  if v_type = 'object' then
    select '{' || string_agg(to_jsonb(key)::text || ':' || public.backup_integrity_canonical_json(value), ',' order by key) || '}'
      into v_result
    from jsonb_each(p_value);
    return coalesce(v_result, '{}');
  end if;

  if v_type = 'array' then
    select '[' || string_agg(public.backup_integrity_canonical_json(value), ',' order by ordinality) || ']'
      into v_result
    from jsonb_array_elements(p_value) with ordinality;
    return coalesce(v_result, '[]');
  end if;

  return p_value::text;
end;
$$;

create or replace function public.backup_integrity_fnv1a32(
  p_text text
)
returns text
language plpgsql
immutable
as $$
declare
  v_hash bigint := 2166136261;
  v_code bigint;
begin
  for v_index in 1..char_length(coalesce(p_text, '')) loop
    v_code := ascii(substr(p_text, v_index, 1));
    v_hash := ((v_hash # v_code) * 16777619) & 4294967295;
  end loop;
  return lpad(to_hex(v_hash), 8, '0');
end;
$$;

create or replace function public.calculate_backup_payload_integrity_hash(
  p_payload jsonb
)
returns text
language plpgsql
stable
as $$
declare
  v_payload_without_integrity jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return '';
  end if;

  v_payload_without_integrity := case
    when jsonb_typeof(p_payload -> 'meta') = 'object'
      then jsonb_set(p_payload, '{meta}', (p_payload -> 'meta') - 'integrity', false)
    else p_payload
  end;

  return public.backup_integrity_fnv1a32(
    public.backup_integrity_canonical_json(v_payload_without_integrity)
  );
end;
$$;

create or replace function public.verify_backup_payload_integrity(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_integrity jsonb := p_payload -> 'meta' -> 'integrity';
  v_expected_hash text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'invalid-payload');
  end if;

  if coalesce(p_payload -> 'meta' ->> 'sourceAppId', '') <> 'wpm-gestao-interna' then
    return jsonb_build_object('ok', false, 'reason', 'untrusted-source');
  end if;

  if v_integrity is null or jsonb_typeof(v_integrity) <> 'object' then
    return jsonb_build_object('ok', false, 'reason', 'missing-integrity');
  end if;

  if coalesce(v_integrity ->> 'algorithm', '') <> 'canonical-fnv1a32-v1' then
    return jsonb_build_object('ok', false, 'reason', 'unsupported-algorithm');
  end if;

  v_expected_hash := public.calculate_backup_payload_integrity_hash(p_payload);
  if coalesce(v_integrity ->> 'hash', '') <> v_expected_hash then
    return jsonb_build_object(
      'ok', false,
      'reason', 'hash-mismatch',
      'expectedHash', v_expected_hash
    );
  end if;

  return jsonb_build_object('ok', true, 'reason', 'verified', 'hash', v_expected_hash);
end;
$$;

drop function if exists public.import_backup_transaction_guarded(uuid, jsonb, jsonb);

create or replace function public.import_backup_transaction_guarded(
  p_unit_id uuid,
  p_payload jsonb,
  p_expected_checkpoint jsonb default null,
  p_preview_accepted boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_checkpoint jsonb;
  v_integrity jsonb;
  v_result jsonb;
  v_kind text;
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

  v_kind := coalesce(p_payload -> 'meta' ->> 'kind', '');
  if v_kind = 'full-backup' or v_kind = 'app-backup' then
    if p_preview_accepted is not true then
      raise exception 'WPM_IMPORT_GUARD: importacao completa exige preview granular aceito.';
    end if;

    v_integrity := public.verify_backup_payload_integrity(p_payload);
    if coalesce((v_integrity ->> 'ok')::boolean, false) is not true then
      raise exception 'WPM_IMPORT_GUARD: integridade do backup invalida (%).', coalesce(v_integrity ->> 'reason', 'unknown');
    end if;
  end if;

  v_result := public.import_backup_transaction(p_unit_id, p_payload);

  return v_result || jsonb_build_object(
    'previousCheckpoint', v_current_checkpoint,
    'nextCheckpoint', public.get_unit_sync_checkpoint(p_unit_id)
  );
end;
$$;

grant execute on function public.get_unit_sync_checkpoint(uuid) to authenticated, service_role;
grant execute on function public.import_backup_transaction_guarded(uuid, jsonb, jsonb, boolean) to authenticated, service_role;
