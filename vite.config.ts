// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Configure for Dokku deployment with SSR
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    base: "/",
    server: {
      allowedHosts: ["evalpro.apps.dataico.world", "evalproia.apps.dataico.world", "localhost", "127.0.0.1"],
    },
    build: {
      assetsDir: "assets",
    },
  },
  // Disable Cloudflare plugin for Dokku
  cloudflare: false,
});
