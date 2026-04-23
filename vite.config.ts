import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2020",
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        legacy: resolve(__dirname, "legacy.html"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === "legacy" ? "legacy-[hash].js" : "[name]-[hash].js";
        },
        chunkFileNames: (chunkInfo) => {
          return chunkInfo.name === "legacy" || chunkInfo.name?.startsWith("legacy-")
            ? "legacy-chunks-[hash].js"
            : "[name]-[hash].js";
        },
      },
    },
  },
});
