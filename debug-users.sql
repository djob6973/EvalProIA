-- Script para diagnosticar por qué los usuarios no aparecen en el Directorio
-- Ejecutar esto en el SQL Editor de Supabase

-- Ver usuarios en auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC;

-- Ver usuarios en public.profiles
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- Ver usuarios que están en auth.users pero NO en public.profiles
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  'Missing in profiles' as issue
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;

-- Ver usuarios que están en public.profiles pero NO en auth.users
SELECT 
  p.id,
  p.email,
  p.created_at as profile_created,
  'Missing in auth.users' as issue
FROM public.profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;
