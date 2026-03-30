create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'employee')),
  color text,
  first_login_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  fiscal_code text not null unique,
  phone text not null,
  contract_end date,
  invited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  work_date date not null unique,
  is_closed boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  is_partial boolean not null default false,
  created_at timestamptz not null default now(),
  unique (shift_id, employee_id)
);

create table if not exists public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_employee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

drop trigger if exists shifts_set_updated_at on public.shifts;
create trigger shifts_set_updated_at
before update on public.shifts
for each row
execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where auth_user_id = auth.uid() and role = 'admin'
  );
$$;

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

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.swap_requests enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
on public.profiles
for update
to authenticated
using (auth.uid() = auth_user_id or public.is_admin())
with check (auth.uid() = auth_user_id or public.is_admin());

drop policy if exists "profiles_insert_admin_only" on public.profiles;
create policy "profiles_insert_admin_only"
on public.profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "employees_select_authenticated" on public.employees;
create policy "employees_select_authenticated"
on public.employees
for select
to authenticated
using (true);

drop policy if exists "employees_write_admin_only" on public.employees;
create policy "employees_write_admin_only"
on public.employees
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "shifts_select_authenticated" on public.shifts;
create policy "shifts_select_authenticated"
on public.shifts
for select
to authenticated
using (true);

drop policy if exists "shifts_write_admin_only" on public.shifts;
create policy "shifts_write_admin_only"
on public.shifts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "shift_assignments_select_authenticated" on public.shift_assignments;
create policy "shift_assignments_select_authenticated"
on public.shift_assignments
for select
to authenticated
using (true);

drop policy if exists "shift_assignments_write_admin_only" on public.shift_assignments;
create policy "shift_assignments_write_admin_only"
on public.shift_assignments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

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
