-- Script para crear usuarios directamente en Supabase (bypass del rate limit de Auth)
-- Ejecutar esto en el SQL Editor de Supabase

-- Función para crear usuario con contraseña encriptada
CREATE OR REPLACE FUNCTION create_user_directly(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'participant'
)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Generar UUID para el usuario
  user_id := gen_random_uuid();
  
  -- Insertar en auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    last_sign_in_at,
    aud
  ) VALUES (
    user_id,
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(), -- Email confirmado automáticamente
    jsonb_build_object(
      'full_name', p_full_name,
      'role', p_role
    ),
    NOW(),
    NOW(),
    NOW(),
    'authenticated'
  );
  
  -- Insertar en public.profiles (el trigger no se ejecuta para inserciones directas)
  -- Usar ON CONFLICT para evitar duplicados
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    p_email,
    p_full_name,
    p_role,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejemplos de uso:
-- SELECT create_user_directly('participante1@gmail.com', 'Pass123!', 'Participante Uno', 'participant');
-- SELECT create_user_directly('admin2@gmail.com', 'Admin123!', 'Admin Dos', 'admin');

-- Crear usuarios de prueba
SELECT create_user_directly('participante1@gmail.com', 'Participante123!', 'Participante Uno', 'participant');
SELECT create_user_directly('participante2@gmail.com', 'Participante123!', 'Participante Dos', 'participant');
SELECT create_user_directly('participante3@gmail.com', 'Participante123!', 'Participante Tres', 'participant');
