import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';

type CreateUserInput = {
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'participant' | 'both';
  areaId: string | null;
  _token: string;
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

    // Verify caller identity and role server-side
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(data._token);
    if (authError || !caller) {
      throw new Error('No autorizado');
    }

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || !['admin', 'both'].includes(callerProfile.role)) {
      throw new Error('No autorizado: se requiere rol de administrador');
    }

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

    // Upsert the profile explicitly in case the trigger didn't include area_id
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: result.user.id,
        email: data.email,
        full_name: data.fullName,
        role: data.role,
        area_id: data.areaId ?? null,
      });

    if (profileError) throw new Error(profileError.message);

    return { id: result.user.id, email: result.user.email };
  });
