import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: { "import.meta.env.VITE_FRONTEND_ONLY": JSON.stringify("true") },
  build: {
    rollupOptions: {
      input: {
        classic: "index.html",
        notebook: "notebook.html",
        compare: "compare.html",
        legacy: "legacy.html",
        legacyNotebook: "legacy-notebook.html",
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
