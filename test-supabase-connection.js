// Script de prueba para verificar conexión con Supabase
import { createClient } from '@supabase/supabase-js';

// Cargar variables de entorno
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zfpvgaswrjdhmplqitbx.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vnho8oZPGYTDmRHATEcV5w_83LOBbhM';

console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('\n--- Prueba de conexión con Supabase ---\n');
  
  try {
    // Prueba 1: Verificar conexión
    console.log('1. Verificando conexión...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      console.error('❌ Error de conexión:', error.message);
      return;
    }
    
    console.log('✅ Conexión exitosa');
    
    // Prueba 2: Intentar iniciar sesión con usuario existente
    console.log('\n2. Intentando iniciar sesión con usuario existente...');
    const testEmail = 'davidjuniorortega@gmail.com';
    const testPassword = 'TestPassword123!';
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (signInError) {
      console.error('❌ Error al iniciar sesión:', signInError.message);
      console.log('   Esto probablemente significa que el email requiere confirmación o la contraseña es incorrecta.');
    } else {
      console.log('✅ Inicio de sesión exitoso');
      console.log('   Session:', signInData.session ? 'Active' : 'None');
      console.log('   User ID:', signInData.user?.id);
    }
    
    // Prueba 3: Verificar perfil en tabla profiles
    console.log('\n3. Verificando perfil en tabla profiles...');
    if (signInData.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signInData.user.id)
        .single();
      
      if (profileError) {
        console.error('❌ Error al obtener perfil:', profileError.message);
      } else {
        console.log('✅ Perfil encontrado en tabla profiles');
        console.log('   Role:', profile.role);
        console.log('   Email:', profile.email);
      }
    }
    
  } catch (error) {
    console.error('❌ Error inesperado:', error.message);
  }
  
  console.log('\n--- Fin de prueba ---\n');
}

testConnection();
