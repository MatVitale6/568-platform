-- Eseguire dopo aver creato manualmente il primo utente in Authentication -> Users.
-- Questo script collega l'utente auth al profilo applicativo e crea anche la riga employees.

-- Sostituisci i valori tra apici con quelli reali.

with upserted_profile as (
  insert into public.profiles (
    auth_user_id,
    full_name,
    email,
    role,
    color,
    first_login_completed
  )
  values (
    'USER_UUID_HERE',
    'Admin User',
    'admin@example.com',
    'admin',
    '#6366f1',
    true
  )
  on conflict (auth_user_id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    color = excluded.color,
    first_login_completed = excluded.first_login_completed
  returning id
)
insert into public.employees (
  profile_id,
  fiscal_code,
  phone,
  contract_end,
  invited
)
select
  id,
  'CODICEFISCALE123456',
  '3331234567',
  null,
  true
from upserted_profile
on conflict (profile_id) do update set
  fiscal_code = excluded.fiscal_code,
  phone = excluded.phone,
  contract_end = excluded.contract_end,
  invited = excluded.invited;