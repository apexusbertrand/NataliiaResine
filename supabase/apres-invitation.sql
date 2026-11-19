-- À coller dans Supabase > SQL Editor APRÈS avoir invité le compte (Authentication > Users > Invite user).
-- Donne l'accès à l'administration. Pour un autre compte, changer l'adresse.
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'apexus.bertrand@gmail.com'
on conflict (user_id) do nothing;

-- Vérification : doit afficher une ligne
select email, created_at from public.admins;
