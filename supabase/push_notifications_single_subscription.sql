-- Keeps only the latest active push subscription for each profile.
-- Run once in Supabase SQL Editor on projects that already enabled push notifications.

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
