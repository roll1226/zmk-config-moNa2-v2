import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  base: "/zmk-config-moNa2-v2/",
  optimizeDeps: {
    include: ["async-mutex"],
  },
});
