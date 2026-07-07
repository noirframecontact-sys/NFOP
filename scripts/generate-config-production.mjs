#!/usr/bin/env node
/**
 * CI build: generate config.production.js from environment variables.
 * Supports Netlify and Cloudflare Pages. Not gitignored — deploy artifact only.
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

function nfDetectBuildPlatform() {

  if (
    process.env.CF_PAGES === "1" ||
    process.env.CF_PAGES === "true" ||
    process.env.CF_PAGES_BRANCH ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.CF_PAGES_URL
  ) {
    return "cloudflare-pages";
  }

  if (
    process.env.NETLIFY === "true" ||
    process.env.NETLIFY === "1" ||
    process.env.NETLIFY_BUILD_BASE ||
    process.env.NETLIFY_LOCAL ||
    (process.env.CONTEXT &&
      process.env.BUILD_ID &&
      process.env.DEPLOY_ID)
  ) {
    return "netlify";
  }

  return "local";

}

function nfIsCiBuild(platform) {
  return platform !== "local";
}

function nfMissingKeyHint(platform) {

  switch (platform) {

    case "cloudflare-pages":
      return (
        "In Cloudflare Pages → Settings → Environment variables, " +
        "set NF_SUPABASE_ANON_KEY for Production (and Preview if needed), " +
        "then redeploy."
      );

    case "netlify":
      return (
        "In Netlify → Site settings → Environment variables, " +
        "set NF_SUPABASE_ANON_KEY with Builds scope enabled."
      );

    default:
      return "Set NF_SUPABASE_ANON_KEY in the build environment.";

  }

}

function nfRelatedEnvKeys() {
  return Object.keys(process.env)
    .filter(key => /^(NF_|SUPABASE_)/i.test(key))
    .sort();
}

const platform = nfDetectBuildPlatform();
const onCi = nfIsCiBuild(platform);

const url = nfReadEnv("NF_SUPABASE_URL", ["SUPABASE_URL"]) || DEFAULT_SUPABASE_URL;
const anonKey = nfReadEnv("NF_SUPABASE_ANON_KEY", [
  "SUPABASE_ANON_KEY",
  "SUPABASE_KEY"
]);

if (!anonKey) {

  console.error("[NFOP build] Missing NF_SUPABASE_ANON_KEY");
  console.error("[NFOP build] Platform:", platform);

  if (onCi) {
    console.error(
      "[NFOP build] Related env keys visible to build:",
      nfRelatedEnvKeys().join(", ") || "(none)"
    );
    console.error("[NFOP build]", nfMissingKeyHint(platform));
    process.exit(1);
  }

  console.log("[NFOP build] Local build — skipping config.production.js");
  process.exit(0);

}

const content = `"use strict";
/* Generated at deploy (${platform}) — do not edit. */
window.NF_CONFIG_LOCAL = window.NF_CONFIG_LOCAL || {};
window.NF_CONFIG_LOCAL.supabase = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
};
`;

fs.writeFileSync(out, content, "utf8");
console.log(
  "[NFOP build] config.production.js generated (" + platform + ")"
);
