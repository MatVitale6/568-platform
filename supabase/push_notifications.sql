create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

with ranked_subscriptions as (
  select
    id,
    row_number() over (
      partition by profile_id
      order by updated_at desc, created_at desc, id desc
    ) as subscription_rank
  from public.push_subscriptions
  where active = true
)
update public.push_subscriptions as push_subscriptions
set active = false
from ranked_subscriptions
where push_subscriptions.id = ranked_subscriptions.id
  and ranked_subscriptions.subscription_rank > 1;

create unique index if not exists push_subscriptions_one_active_per_profile_idx
on public.push_subscriptions (profile_id)
where active = true;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_owner_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_select_owner_or_admin"
on public.push_subscriptions
for select
to authenticated
using (
  public.is_admin()
  or public.current_profile_id() = profile_id
);

drop policy if exists "push_subscriptions_insert_owner_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_insert_owner_or_admin"
on public.push_subscriptions
for insert
to authenticated
with check (
  public.is_admin()
  or public.current_profile_id() = profile_id
);

drop policy if exists "push_subscriptions_update_owner_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_update_owner_or_admin"
on public.push_subscriptions
for update
to authenticated
using (
  public.is_admin()
  or public.current_profile_id() = profile_id
)
with check (
  public.is_admin()
  or public.current_profile_id() = profile_id
);

drop policy if exists "push_subscriptions_delete_owner_or_admin" on public.push_subscriptions;
create policy "push_subscriptions_delete_owner_or_admin"
on public.push_subscriptions
for delete
to authenticated
using (
  public.is_admin()
  or public.current_profile_id() = profile_id
);

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.current_profile_id();

  if v_profile_id is null then
    raise exception 'Profilo non trovato per utente autenticato';
  end if;

  update public.push_subscriptions
  set active = false,
      updated_at = now()
  where profile_id = v_profile_id
    and endpoint <> p_endpoint
    and active = true;

  insert into public.push_subscriptions (
    profile_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    active
  )
  values (
    v_profile_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_agent,
    true
  )
  on conflict (endpoint)
  do update set
    profile_id = excluded.profile_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    active = true,
    updated_at = now();
end;
$$;

grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

create or replace function public.disable_push_subscription(
  p_endpoint text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := public.current_profile_id();

  if v_profile_id is null then
    raise exception 'Profilo non trovato per utente autenticato';
  end if;

  update public.push_subscriptions
  set active = false,
      updated_at = now()
  where profile_id = v_profile_id
    and (p_endpoint is null or endpoint = p_endpoint)
    and active = true;
end;
$$;

grant execute on function public.disable_push_subscription(text) to authenticated;