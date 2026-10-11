import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
