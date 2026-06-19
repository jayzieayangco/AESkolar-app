import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@ai-engine": path.resolve(__dirname, "./ai-engine"),
    },
  },
  // For GitHub Pages deployment - set base to project name for correct asset loading
  base: "/AESkolar-app/",
  server: {
    host: "0.0.0.0",
    // Must match Supabase Dashboard → Auth → URL Configuration → Site URL port
    port: 5176,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
