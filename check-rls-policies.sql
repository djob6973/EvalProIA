-- Script para verificar políticas RLS actuales en Supabase
-- Ejecutar esto en el SQL Editor de Supabase

-- Ver políticas RLS para profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Ver si RLS está habilitado para profiles
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';

-- Ver políticas RLS para todas las tablas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
ORDER BY tablename, policyname;
