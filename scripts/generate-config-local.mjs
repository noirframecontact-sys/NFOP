#!/usr/bin/env node
/**
 * Netlify build: generate config.local.js from environment variables.
 * Secrets stay out of Git; anon key is injected at deploy time only.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "config.local.js");

const url = process.env.NF_SUPABASE_URL || "";
const anonKey = process.env.NF_SUPABASE_ANON_KEY || "";

if (!url || !anonKey) {
  console.log(
    "[NFOP build] NF_SUPABASE_URL / NF_SUPABASE_ANON_KEY not set — skipping config.local.js"
  );
  process.exit(0);
}

const content = `"use strict";
/* Generated at deploy time — do not edit. */
window.NF_CONFIG_LOCAL = {
  supabase: {
    url: ${JSON.stringify(url)},
    anonKey: ${JSON.stringify(anonKey)}
  }
};
`;

fs.writeFileSync(out, content, "utf8");
console.log("[NFOP build] config.local.js generated for deploy");
