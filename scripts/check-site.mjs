#!/usr/bin/env node
// Static checks for the Pazmoonak site. No dependencies; needs Node 18+ and bash.
// Run from the repo root:  node scripts/check-site.mjs
// CI runs this before every deploy (.github/workflows/pages.yml and check.yml).
// It catches what has broken the site before: JS syntax errors, broken shell installers,
// invalid JSON-LD, FAQ schema that no longer matches the visible FAQ, sitemap/page drift,
// files that pz-front (front-sync.sh) expects but are missing, and committed secrets.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const read = (f) => readFileSync(f, "utf8");
const ls = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => join(dir, f)) : []);
const SITE = "https://pazmoonak.com";

// ---------- 1. JavaScript syntax ----------
const jsFiles = ["app.js", "config.js", "books-batch.js", "crawl-books.js"].filter(existsSync);
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    fail(f, "JavaScript syntax error\n" + String(e.stderr || e.message).trim());
  }
}

// ---------- 2. Shell syntax (installers are run as root on the server) ----------
const shFiles = [...ls(".", ".sh"), ...ls("scripts", ".sh")];
for (const f of shFiles) {
  try {
    execFileSync("bash", ["-n", f], { stdio: "pipe" });
  } catch (e) {
    fail(f, "bash syntax error\n" + String(e.stderr || e.message).trim());
  }
}

// ---------- 3. HTML pages: head tags, JSON-LD, FAQ parity, internal links ----------
const strip = (t) =>
  t
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const pageFiles = ls("pages", ".html");
const pageSlugs = new Set(pageFiles.map((f) => "/" + f.replace(/^pages[\\/]/, "").replace(/\.html$/, "")));
// Paths served by the app (SPA routes), read from the router in app.js so this check follows it:
// top-level `parts[0] === "x"` routes, plus /create/<mode> for "ai", "files" and ACTIVE_MODES.
const appRoutes = new Set(["/"]);
{
  const app = read("app.js");
  for (const m of app.matchAll(/parts\[0\] === "([a-z]+)"/g)) appRoutes.add("/" + m[1]);
  const modes = (app.match(/const ACTIVE_MODES = \[([^\]]*)\]/) || [, ""])[1].match(/"([a-z]+)"/g) || [];
  for (const sub of ["ai", "files", ...modes.map((x) => x.slice(1, -1))]) appRoutes.add("/create/" + sub);
  if (appRoutes.size < 10) fail("app.js", "could not read the router's routes (route() changed; update this check)");
}

function checkHtml(file, { indexable }) {
  const s = read(file);
  const count = (re) => (s.match(re) || []).length;
  if (count(/<title>/g) !== 1) fail(file, `expected exactly 1 <title>, found ${count(/<title>/g)}`);
  if (count(/<h1[\s>]/g) !== 1) fail(file, `expected exactly 1 <h1>, found ${count(/<h1[\s>]/g)}`);
  if (!/<html[^>]*lang="fa"[^>]*dir="rtl"|<html[^>]*dir="rtl"[^>]*lang="fa"/.test(s)) fail(file, '<html> must have lang="fa" dir="rtl"');
  if (indexable) {
    if (!/<meta name="description" content="[^"]{50,}"/.test(s)) fail(file, "missing or very short meta description");
    if (!/<link rel="canonical" href="https:\/\/pazmoonak\.com[^"]*">/.test(s)) fail(file, "missing canonical link to https://pazmoonak.com");
  }

  // JSON-LD must parse, and FAQPage must match the visible FAQ word for word (Google requires it).
  let ldFaq = null;
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try {
      data = JSON.parse(m[1]);
    } catch (e) {
      fail(file, "invalid JSON-LD: " + e.message);
      continue;
    }
    for (const node of data["@graph"] || [data]) {
      if (node["@type"] === "FAQPage") ldFaq = (node.mainEntity || []).map((q) => [strip(q.name), strip(q.acceptedAnswer?.text || "")]);
    }
  }
  const visibleFaq = [...s.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map((m) => [strip(m[1]), strip(m[2])]);
  if (ldFaq) {
    if (ldFaq.length !== visibleFaq.length) {
      fail(file, `FAQPage JSON-LD has ${ldFaq.length} questions but the page shows ${visibleFaq.length}`);
    } else {
      ldFaq.forEach(([q, a], i) => {
        if (q !== visibleFaq[i][0]) fail(file, `FAQ #${i + 1} question differs between JSON-LD and page`);
        if (a !== visibleFaq[i][1]) fail(file, `FAQ #${i + 1} answer differs between JSON-LD and page`);
      });
    }
  }

  // Internal links must point at something that exists.
  for (const m of s.matchAll(/href="(\/[^"#?]*)/g)) {
    const p = m[1].replace(/\/$/, "") || "/";
    if (appRoutes.has(p) || pageSlugs.has(p)) continue;
    if (existsSync("." + p) && statSync("." + p).isFile()) continue;
    fail(file, `internal link to ${m[1]} has no matching page or file`);
  }
  // Local assets referenced by src= must exist (cache-busting ?v= is ignored).
  for (const m of s.matchAll(/src="(\/[^"?#]+)/g)) {
    if (!existsSync("." + m[1])) fail(file, `src ${m[1]} does not exist in the repo`);
  }
}

checkHtml("index.html", { indexable: true });
for (const f of pageFiles) checkHtml(f, { indexable: true });
if (existsSync("404.html")) checkHtml("404.html", { indexable: false });

// ---------- 4. Sitemap matches the pages ----------
{
  const s = read("sitemap.xml");
  if (!s.startsWith("<?xml") || !/<urlset[^>]*>[\s\S]*<\/urlset>\s*$/.test(s)) fail("sitemap.xml", "not a well-formed <urlset>");
  const locs = [...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const seen = new Set();
  for (const loc of locs) {
    if (seen.has(loc)) fail("sitemap.xml", `duplicate <loc> ${loc}`);
    seen.add(loc);
    if (!loc.startsWith(SITE + "/")) {
      fail("sitemap.xml", `${loc} is not on ${SITE}`);
      continue;
    }
    const path = loc.slice(SITE.length);
    if (path !== "/" && !pageSlugs.has(path)) fail("sitemap.xml", `${loc} has no pages/${path.slice(1)}.html`);
  }
  for (const slug of pageSlugs) if (!seen.has(SITE + slug)) fail("sitemap.xml", `pages${slug}.html is missing from the sitemap`);
  for (const m of s.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m[1])) fail("sitemap.xml", `bad <lastmod> ${m[1]}`);
  }
}

// ---------- 5. Files that pz-front (front-sync.sh) copies to the live server ----------
if (existsSync("front-sync.sh")) {
  const s = read("front-sync.sh");
  const list = s.match(/for f in (katex-bundle\.js[^;]*); do \[ -f/);
  if (!list) {
    fail("front-sync.sh", "could not find the file list (the copy loop changed; update this check)");
  } else {
    for (const f of list[1].trim().split(/\s+/)) {
      if (!existsSync(f)) fail("front-sync.sh", `${f} is in the deploy list but missing from the repo (the live site would keep a stale copy)`);
    }
  }
}

// ---------- 6. Committed secrets (simple patterns; not a replacement for gitleaks) ----------
const SECRET_PATTERNS = [
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/\bsk-[A-Za-z0-9]{32,}\b/, "API key (sk-...)"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, "Google API key"],
  [/\bpplx-[A-Za-z0-9]{32,}\b/, "Perplexity API key"],
  [/\bghp_[A-Za-z0-9]{36}\b/, "GitHub token"],
  [/\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "JWT"],
];
let tracked = [];
try {
  tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
} catch {
  warn("git", "git ls-files failed; secret scan skipped");
}
for (const f of tracked) {
  if (!/\.(js|mjs|sh|html|css|json|yml|yaml|md|txt|sql|conf|env)$/i.test(f) || f === "katex-bundle.js" || f.startsWith("logo/pdf")) continue;
  let s;
  try {
    s = read(f);
  } catch {
    continue;
  }
  for (const [re, what] of SECRET_PATTERNS) if (re.test(s)) fail(f, `looks like a committed ${what}; remove it and rotate the key`);
}

// ---------- 7. Size budget for the first page load (warnings only) ----------
const KB = (f) => Math.round(statSync(f).size / 1024);
for (const [f, limit] of [["app.js", 500], ["index.html", 200]]) {
  if (existsSync(f) && KB(f) > limit) warn(f, `${KB(f)} KB is over the ${limit} KB budget (slow on mobile data)`);
}

// ---------- Report ----------
for (const w of warnings) console.log("WARN  " + w);
for (const e of errors) console.log("FAIL  " + e);
const checked = `${jsFiles.length} JS, ${shFiles.length} shell, ${pageFiles.length + 2} HTML, sitemap, deploy list, ${tracked.length} tracked files for secrets`;
if (errors.length) {
  console.log(`\n${errors.length} problem(s). Checked: ${checked}.`);
  process.exit(1);
}
console.log(`OK. Checked: ${checked}.${warnings.length ? ` ${warnings.length} warning(s).` : ""}`);
