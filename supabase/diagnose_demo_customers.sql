-- ============================================================================
-- Docufy PSMS — DIAGNOSE demo customer logins
-- Run in Supabase SQL Editor and paste the result grid back.
-- ============================================================================

-- A. Did the auth users + identities + profiles + orders land?
select
  u.email,
  (u.encrypted_password is not null and u.encrypted_password <> '') as has_password,
  u.encrypted_password like '$2%'                                   as bcrypt_hash,
  (u.email_confirmed_at is not null)                                as confirmed,
  (u.confirmation_token is null)                                    as confirmation_token_null,
  (u.recovery_token is null)                                        as recovery_token_null,
  (u.email_change is null)                                          as email_change_null,
  (u.email_change_token_new is null)                                as email_change_token_new_null,
  (select count(*) from auth.identities i where i.user_id = u.id)   as identities,
  (select count(*) from public.profiles p where p.id = u.id)        as profiles,
  (select count(*) from public.orders o where o.customer_id = u.id) as orders
from auth.users u
where u.email like '%@docufy.demo'
order by u.email;

-- B. What does the identities table look like for a demo user?
select i.id, i.user_id, i.provider, i.provider_id, i.email, i.identity_data
from auth.identities i
where i.user_id in (
  select id from auth.users where email like '%@docufy.demo'
);

-- C. Password check: does 'DocufyDemo123!' verify against the stored hash?
--    (should return true for every account)
select u.email,
       (u.encrypted_password = crypt('DocufyDemo123!', u.encrypted_password)) as password_ok
from auth.users u
where u.email like '%@docufy.demo'
order by u.email;
