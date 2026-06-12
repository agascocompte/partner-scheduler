import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deployed at https://agascocompte.github.io/partner-scheduler/
export default defineConfig({
  base: "/partner-scheduler/",
  plugins: [react()],
});
