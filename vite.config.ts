import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist/web",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
      },
    },
  },
});
