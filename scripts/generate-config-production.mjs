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

const DEFAULT_SUPABASE_URL =
  "https://mcppojmghmwwvubyrufo.supabase.co";

function nfReadEnv(primary, fallbacks = []) {
  const names = [primary, ...fallbacks];

  for (const name of names) {
    const value = process.env[name];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  const wanted = new Set(names.map(name => name.toUpperCase()));

  for (const key of Object.keys(process.env)) {
    if (!wanted.has(key.toUpperCase())) {
      continue;
    }

    const value = process.env[key];
    if (value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function nfIsNetlifyBuild() {
  return Boolean(
    process.env.NETLIFY ||
    process.env.BUILD_ID ||
    process.env.DEPLOY_ID ||
    process.env.CONTEXT
  );
}

function nfRelatedEnvKeys() {
  return Object.keys(process.env)
    .filter(key => /^(NF_|SUPABASE_)/i.test(key))
    .sort();
}

const url = nfReadEnv("NF_SUPABASE_URL", ["SUPABASE_URL"]) || DEFAULT_SUPABASE_URL;
const anonKey = nfReadEnv("NF_SUPABASE_ANON_KEY", [
  "SUPABASE_ANON_KEY",
  "SUPABASE_KEY"
]);
const onNetlify = nfIsNetlifyBuild();

if (!anonKey) {
  console.error("[NFOP build] Missing NF_SUPABASE_ANON_KEY");
  console.error(
    "[NFOP build] Related env keys visible to build:",
    nfRelatedEnvKeys().join(", ") || "(none)"
  );
  console.error(
    "[NFOP build] In Netlify UI, ensure NF_SUPABASE_ANON_KEY has the Builds scope enabled."
  );

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
