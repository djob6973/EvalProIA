-- Script para probar la función create_user_directly
-- Ejecutar esto en el SQL Editor de Supabase

-- Probar crear un usuario de prueba
SELECT create_user_directly(
  'test-user@example.com',
  'TestPassword123!',
  'Test User',
  'participant'
);

-- Verificar si el usuario fue creado
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'test-user@example.com';

-- Verificar si el perfil fue creado
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
WHERE email = 'test-user@example.com';
