drop index if exists public.addon_sales_unique_entry_idx;

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
