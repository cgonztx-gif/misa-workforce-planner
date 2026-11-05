import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev: http://127.0.0.1:5173 with /api proxied to the FastAPI server (python -m server, port 8501).
// Build: web/dist, which FastAPI serves at http://localhost:8501. Relative base, hash router: no server routes needed.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:8501", changeOrigin: false } },
  },
  preview: { host: "127.0.0.1", port: 4173 },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
