// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  vite: {
    server: {
      proxy: {
        "/controlsight-api": {
          target: "http://127.0.0.1:8765",
          changeOrigin: true,
          rewrite: (path) =>
            path.replace(/^\/controlsight-api/, ""),
        },
      },
    },
  },
});
