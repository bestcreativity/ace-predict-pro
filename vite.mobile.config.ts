import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_MOBILE_BUILD": "true",
  },
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  build: {
    outDir: "dist-mobile",
    emptyOutDir: true,
  },
});
