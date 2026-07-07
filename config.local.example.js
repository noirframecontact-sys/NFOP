"use strict";

/*
  Local dev: copy to config.local.js and fill in Supabase credentials.
  config.local.js must not be committed (.gitignore).

  Netlify production: set in Site settings → Environment variables:
    NF_SUPABASE_ANON_KEY  (required; scope must include Builds)
    NF_SUPABASE_URL       (optional — defaults to project URL in config.js)
  Build generates config.production.js (see scripts/generate-config-production.mjs).
*/
window.NF_CONFIG_LOCAL = {
  supabase: {
    url: "https://mcppojmghmwwvubyrufo.supabase.co",
    anonKey: "sb_publishable_qsyn5QofnR1G9J2-hLHshg_xxTObp9v"
  }
};
