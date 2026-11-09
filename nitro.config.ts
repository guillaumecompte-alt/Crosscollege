import { defineConfig } from "nitro";

export default defineConfig({
  cloudflare: {
    wrangler: {
      // Must match the Cloudflare Worker serving crosscollege.outilotheque.fr.
      name: "crosscollege",
      // Keep dashboard-configured runtime variables when deploying with Nitro/Wrangler.
      keep_vars: true,
    },
  },
});
