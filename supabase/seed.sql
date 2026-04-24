-- Seed local de desenvolvimento.
-- Credenciais do usuário seeded:
--   email: dev.admin@wpm.local
--   senha: Admin123!

do $$
declare
  v_user_id constant uuid := '11111111-1111-1111-1111-111111111111';
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'dev.admin@wpm.local',
    crypt('Admin123!', gen_salt('bf')),
    timezone('utc', now()),
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Local WPM"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
    set email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        email_confirmed_at = excluded.email_confirmed_at,
        confirmation_token = excluded.confirmation_token,
        recovery_token = excluded.recovery_token,
        email_change_token_new = excluded.email_change_token_new,
        email_change = excluded.email_change,
        email_change_token_current = excluded.email_change_token_current,
        reauthentication_token = excluded.reauthentication_token,
        raw_app_meta_data = excluded.raw_app_meta_data,
        raw_user_meta_data = excluded.raw_user_meta_data,
        updated_at = timezone('utc', now());

  insert into auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    'dev.admin@wpm.local',
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', 'dev.admin@wpm.local',
      'email_verified', true
    ),
    'email',
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (provider_id, provider) do update
    set identity_data = excluded.identity_data,
        last_sign_in_at = excluded.last_sign_in_at,
        updated_at = excluded.updated_at;

  perform public.bootstrap_unit_admin(
    p_user_id => v_user_id,
    p_unit_name => 'WPM Unidade Local',
    p_unit_slug => 'wpm-unidade-local',
    p_display_name => 'Admin Local WPM',
    p_period_key => to_char(timezone('America/Sao_Paulo', now()), 'YYYY-MM'),
    p_timezone => 'America/Sao_Paulo',
    p_month_days => null
  );
end;
$$;
