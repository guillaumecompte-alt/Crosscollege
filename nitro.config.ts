import { defineConfig } from "nitro";

export default defineConfig({
  preset: "cloudflare-module",
  cloudflare: {
    nodeCompat: true,
    deployConfig: true,
    wrangler: {
      // Must match the Cloudflare Worker serving crosscollege.outilotheque.fr.
      name: "crosscollege",
      // Keep dashboard-configured runtime variables when deploying.
      keep_vars: true,
    },
  },
});
