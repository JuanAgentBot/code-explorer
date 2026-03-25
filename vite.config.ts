import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/code-explorer/",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
});
