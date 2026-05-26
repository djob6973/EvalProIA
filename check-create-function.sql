-- Script para verificar si la función create_user_directly existe
-- Ejecutar esto en el SQL Editor de Supabase

-- Verificar si la función existe
SELECT 
  routine_name,
  routine_type,
  data_type,
  is_deterministic,
  external_name,
  external_language
FROM information_schema.routines
WHERE routine_name = 'create_user_directly'
AND routine_schema = 'public';

-- Si no existe, crear la función
-- (El código de la función está en create-user-sql.sql)
