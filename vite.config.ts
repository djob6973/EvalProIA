// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { config as dotenvConfig } from "dotenv";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Load .env before validating — vite.config runs before Vite's own .env loading
dotenvConfig();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) throw new Error('Falta la variable de entorno VITE_SUPABASE_URL o SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Falta la variable de entorno VITE_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY');

// Configure for Dokku deployment with SSR
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    server: {
      allowedHosts: ['evalpro.apps.dataico.world', 'localhost', '127.0.0.1'],
    },
  },
  // Disable Cloudflare plugin for Dokku
  cloudflare: false,
});
