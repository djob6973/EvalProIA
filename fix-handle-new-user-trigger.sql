-- =============================================================================
-- FIX: Actualizar trigger handle_new_user() para incluir area_id
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, area_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'participant'),
    NULLIF(NEW.raw_user_meta_data->>'area_id', '')::UUID
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role      = EXCLUDED.role,
    area_id   = EXCLUDED.area_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
