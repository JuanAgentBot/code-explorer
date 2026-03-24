import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/code-explorer/",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "type-map": resolve(__dirname, "type-map/index.html"),
        "call-graph": resolve(__dirname, "call-graph/index.html"),
        "module-graph": resolve(__dirname, "module-graph/index.html"),
      },
    },
  },
});
