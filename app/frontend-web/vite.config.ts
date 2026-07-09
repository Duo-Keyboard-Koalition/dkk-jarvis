import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on LAN so mobile devices can connect
    proxy: {
      // REST endpoints
      "/mock": "http://localhost:8000",
      "/scene-state": "http://localhost:8000",
      "/execute-task": "http://localhost:8000",
      "/start-chrome": "http://localhost:8000",
      "/stop-chrome": "http://localhost:8000",
      // WebSocket — must use ws: target and enable ws:true
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
