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
    select '{' || string_agg(to_jsonb(key)::text || ':' || public.backup_integrity_canonical_json(value), ',' order by key collate "C") || '}'
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

create or replace function public.calculate_backup_payload_integrity_hash(
  p_payload jsonb,
  p_algorithm text default 'canonical-sha256-v1'
)
returns text
language plpgsql
stable
as $$
declare
  v_payload_without_integrity jsonb;
  v_canonical_payload text;
  v_algorithm text := coalesce(p_algorithm, 'canonical-sha256-v1');
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return '';
  end if;

  v_payload_without_integrity := case
    when jsonb_typeof(p_payload -> 'meta') = 'object'
      then jsonb_set(p_payload, '{meta}', (p_payload -> 'meta') - 'integrity', false)
    else p_payload
  end;
  v_canonical_payload := public.backup_integrity_canonical_json(v_payload_without_integrity);

  if v_algorithm = 'canonical-sha256-v1' then
    return encode(extensions.digest(v_canonical_payload, 'sha256'), 'hex');
  end if;

  if v_algorithm = 'canonical-fnv1a32-v1' then
    return public.backup_integrity_fnv1a32(v_canonical_payload);
  end if;

  return '';
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
  v_algorithm text;
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

  v_algorithm := coalesce(v_integrity ->> 'algorithm', '');
  if v_algorithm not in ('canonical-sha256-v1', 'canonical-fnv1a32-v1') then
    return jsonb_build_object('ok', false, 'reason', 'unsupported-algorithm');
  end if;

  v_expected_hash := public.calculate_backup_payload_integrity_hash(p_payload, v_algorithm);
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
