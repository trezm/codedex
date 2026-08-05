import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Overridable so several checkouts (e.g. git worktrees) can run side by side.
// SYL_SERVER_PORT must match the port the API is started on.
const apiTarget = `http://localhost:${process.env.SYL_SERVER_PORT ?? "3000"}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.SYL_WEB_PORT ?? 5173),
    proxy: {
      "/api": apiTarget,
      "/wasm": apiTarget,
    },
  },
});
