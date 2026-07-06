#!/usr/bin/env node
/**
 * Netlify build: generate config.production.js from environment variables.
 * Not gitignored — deploy artifact only. Never commit this file manually.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "config.production.js");

const url =
  process.env.NF_SUPABASE_URL ||
  "https://mcppojmghmwwvubyrufo.supabase.co";
const anonKey = process.env.NF_SUPABASE_ANON_KEY || "";
const onNetlify = Boolean(process.env.NETLIFY);

if (!anonKey) {
  const msg = "[NFOP build] Missing NF_SUPABASE_ANON_KEY";
  console.error(msg);
  if (onNetlify) {
    process.exit(1);
  }
  console.log("[NFOP build] Local build — skipping config.production.js");
  process.exit(0);
}

const content = `"use strict";
/* Generated at Netlify deploy — do not edit. */
window.NF_CONFIG_LOCAL = window.NF_CONFIG_LOCAL || {};
window.NF_CONFIG_LOCAL.supabase = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
};
`;

fs.writeFileSync(out, content, "utf8");
console.log("[NFOP build] config.production.js generated");
