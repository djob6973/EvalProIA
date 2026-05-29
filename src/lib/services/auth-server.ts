import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';

type CreateUserInput = {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'participant' | 'both';
  areaId: string | null;
};

export const createUserFn = createServerFn({ method: 'POST' })
  .inputValidator((data: CreateUserInput) => data)
  .handler(async ({ data }) => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error(
        'Configuración del servidor incompleta: faltan SUPABASE_SERVICE_ROLE_KEY o SUPABASE_URL'
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: result, error } = await adminClient.auth.admin.createUser({
      email: data.email,
      password: data.password,
      user_metadata: {
        full_name: data.fullName,
        role: data.role,
        area_id: data.areaId,
      },
      email_confirm: true,
    });

    if (error) throw new Error(error.message);

    return { id: result.user.id, email: result.user.email };
  });
