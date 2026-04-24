import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8081,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
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
