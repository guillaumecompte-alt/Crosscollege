import { defineConfig } from "nitro";

export default defineConfig({
  cloudflare: {
    wrangler: {
      // Keep dashboard-configured runtime variables when deploying with Nitro/Wrangler.
      keep_vars: true,
    },
  },
});
