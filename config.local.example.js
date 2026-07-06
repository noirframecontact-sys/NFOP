"use strict";

/*
  Local dev: copy to config.local.js and fill in Supabase credentials.
  config.local.js must not be committed (.gitignore).

  Netlify production: set environment variables in Site settings:
    NF_SUPABASE_URL
    NF_SUPABASE_ANON_KEY
  Build generates config.local.js automatically (see scripts/generate-config-local.mjs).
*/
window.NF_CONFIG_LOCAL = {
  supabase: {
    url: "https://YOUR_PROJECT_REF.supabase.co",
    anonKey: "YOUR_SUPABASE_ANON_KEY"
  }
};
