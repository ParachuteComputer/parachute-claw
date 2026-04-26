import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Mount path /claw/ — matches parachute-notes.
export default defineConfig({
  base: "/claw/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_PARACLAW_SERVER_URL ?? "http://127.0.0.1:1944",
        changeOrigin: true,
      },
    },
  },
});
