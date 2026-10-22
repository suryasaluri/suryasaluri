// Standalone static build config for the prospect-facing demo of SAN Connect.
// Produces a pure client-rendered SPA (no Nitro/SSR server) deployable to any
// static host (GitHub Pages, S3, Netlify static, etc). Talks to the same live
// Supabase project as the normal app — nothing here is mocked.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const base = process.env.DEMO_BASE_PATH || "/";
const outDir = process.env.DEMO_OUT_DIR || ".output-demo";

export default defineConfig({
  nitro: false,
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: { enabled: true, outputPath: "/index.html" },
    },
  },
  vite: {
    base,
    build: {
      outDir,
    },
    preview: {
      host: "127.0.0.1",
    },
  },
});
