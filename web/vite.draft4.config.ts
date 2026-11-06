import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Draft 4: the one-page Overview (planning/DRAFT4.md). A second Vite root beside drafts 2 and 3.
// Dev: http://127.0.0.1:5174 with /api proxied to the FastAPI server (python -m server, port 8501).
// Build: web/dist-draft4, served by python -m server --draft4.
export default defineConfig({
  root: fileURLToPath(new URL("./draft4", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8501", changeOrigin: false } },
  },
  build: {
    outDir: "../dist-draft4",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
