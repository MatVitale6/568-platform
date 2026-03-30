create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

drop policy if exists "swap_requests_select_owner_or_admin" on public.swap_requests;
create policy "swap_requests_select_owner_or_admin"
on public.swap_requests
for select
to authenticated
using (
  public.is_admin()
  or public.current_profile_id() = requester_id
  or public.current_profile_id() = target_employee_id
);

drop policy if exists "swap_requests_insert_requester_or_admin" on public.swap_requests;
create policy "swap_requests_insert_requester_or_admin"
on public.swap_requests
for insert
to authenticated
with check (
  public.is_admin()
  or public.current_profile_id() = requester_id
);

drop policy if exists "swap_requests_update_owner_or_admin" on public.swap_requests;
create policy "swap_requests_update_owner_or_admin"
on public.swap_requests
for update
to authenticated
using (
  public.is_admin()
  or public.current_profile_id() = requester_id
  or public.current_profile_id() = target_employee_id
)
with check (
  public.is_admin()
  or public.current_profile_id() = requester_id
  or public.current_profile_id() = target_employee_id
);