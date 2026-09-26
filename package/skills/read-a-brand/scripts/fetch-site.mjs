// Fetch the site a person named and keep exactly what came back. Nothing is
// read out of it here: this step takes the home page, the pages it links to ON
// THE SAME HOST, the web app manifest and every stylesheet those pages name,
// and keeps each one with the address it came from, the moment it was fetched
// and a digest, so the step after this one can say exactly where a value was
// seen.
//
// THE HOST, NOT THE DOMAIN. A person who asks for the brand at
// www.acme.example means that site. Another host under the same domain is
// another site: its ground, its ink and its mark are its own, and following a
// link into it puts two brands in one reading, which ends with every field
// contested and the profile carrying none of them. This step once followed the
// registrable domain and langchain.com is what showed the cost, so a link to
// another host is now named in the record and not followed. `www.` is the site
// itself by a convention older than the web, so it is not another host.
//   needs: node >= 22, the network to the domain the person named
//   DOMAIN=<address> [PAGES=<n in total, the home page included, default 5>]
//   OUT=records/<job>/fetched.json
//   [DIR=records/<job>/fetched] node fetch-site.mjs
// OUT is the record the next step reads, carrying every resource and its text.
// DIR, when it is given, is a folder the same bodies are written into one file
// each, which is the record a person opens later.
// Exit: 0 fetched; 1 refused, and the one sentence saying why is printed; 2 the
// settings are not right.
//
// WHAT IT WILL NOT DO. Only https is opened. A redirect off https, a file or
// data address, an address carrying a sign-in, a link to another host, and any
// link off the registrable domain are refused rather than tried. A stylesheet
// is the one thing read from another host under the same domain, because a
// stylesheet on assets.acme.example is how the page that named it is painted
// and it states nothing of its own.
//
// WHY THERE ARE TWO CLOCKS. Every request has its own timeout AND there is one
// deadline over all of them together. A site that answers one byte a second
// costs this step its deadline and not the whole task, and the home page that
// did arrive is still kept.
//
// No local file path is ever written into the record. A resource carries its
// web address and, when DIR was given, the bare name of the file its body was
// written to, because this record travels to the person and to every step
// after this one.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const FETCHED = "v1";

// One request is never allowed to hang the step, and neither is the step as a
// whole. The deadline covers the home page, the manifest, the pages and the
// stylesheets together.
export const PER_FETCH_MS = 8_000;
export const TOTAL_MS = 60_000;

// A ceiling on each resource. A page past this is an application and not a
// page that states a brand, and a stylesheet past it is a bundle.
export const MAX_PAGE_BYTES = 2 * 1024 * 1024;
export const MAX_STYLESHEET_BYTES = 1024 * 1024;
export const MAX_MANIFEST_BYTES = 256 * 1024;

// Five pages IN TOTAL, counting the home page, which is the default: a site
// that disagrees with itself does so on its first five, and a sixth costs a
// fetch to learn nothing. PAGES=1 is the home page on its own.
export const DEFAULT_PAGES = 5;
export const MAX_PAGES = 20;
export const MAX_STYLESHEETS = 12;

export const USER_AGENT = "AgentMesh brand-reader (reads what a site states about its own brand)";

const PAGE_ACCEPT = "text/html,application/xhtml+xml";
const STYLESHEET_ACCEPT = "text/css,*/*;q=0.1";
const MANIFEST_ACCEPT = "application/manifest+json,application/json";

/** What this step will not fetch, in one plain sentence. The caller prints it
 *  as `refused: <sentence>` and stops. `settings` marks the ones that are the
 *  caller's to fix rather than the site's, which is the only thing the exit
 *  code tells apart. */
export class Refusal extends Error {
  constructor(why, { settings = false } = {}) { super(why); this.name = "Refusal"; this.settings = settings; }
}
const refuse = (why) => { throw new Refusal(why); };
const refuseSettings = (why) => { throw new Refusal(why, { settings: true }); };

const trim = (text) => String(text ?? "").trim();
const squash = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const many = (n, one, more = `${one}s`) => `${n} ${n === 1 ? one : more}`;

/** A file name with no folders in front of it, whichever kind of separator the
 *  path came with. This is the only part of a path that is ever printed. */
export const bareName = (path) => trim(path).split(/[\\/]/).pop() || "";

// ── the address ─────────────────────────────────────────────────────────────

/** The domain as a URL. People write "acme.example" as often as they write the
 *  whole thing, so a missing scheme is not an error and becomes https. A
 *  scheme that is there and is not https is refused rather than upgraded,
 *  because a person who typed http asked for something this step will not do. */
export function siteUrl(text) {
  const raw = trim(text);
  if (!raw) refuse("no domain was given, so there was nothing to fetch");
  const whole = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url;
  try { url = new URL(whole); } catch { refuse(`the domain ${raw} could not be read as a web address`); }
  if (url.protocol === "file:" || url.protocol === "data:") {
    refuse(`the domain is a ${url.protocol.replace(":", "")} address, which is never opened; a domain is fetched over https`);
  }
  if (url.protocol !== "https:") refuse(`the domain ${url.href} is not https, and only https is fetched`);
  if (url.username || url.password) refuse(`the domain ${url.host} carries a sign-in, and a credential is never accepted`);
  const why = notPublic(url.hostname);
  if (why) refuse(`the domain ${url.href} was not fetched, because ${why}`);
  return url;
}

/** Why an address is not a public web page, or null when it is one.
 *
 *  The domain arrives in a message and this step runs on the host the agent
 *  lives on, so an address naming that host, or a numbered address, would have
 *  the agent fetch something on its own network for whoever asked. A brand's
 *  own address has a public domain name in it, so anything else is refused by
 *  name rather than tried. */
const PRIVATE_NAME = /^(localhost|.+\.localhost|.+\.local|.+\.internal|.+\.home\.arpa)$/i;
export function notPublic(host) {
  const h = trim(host).toLowerCase();
  if (!h) return "it names no host";
  if (PRIVATE_NAME.test(h)) return "it names a machine on this network rather than a public web page";
  if (h.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return "it is a numbered address rather than a public web page";
  if (!h.includes(".")) return "it names no public domain";
  return null;
}

// The second labels that are a public suffix rather than somebody's name, so
// that example.co.uk and other.co.uk are two domains and not one. This is a
// short list and not the whole public suffix list: the list is a dependency
// and this package has none. A label missing from it makes this step stricter
// and never looser, because the fallback is to take the last two labels, and
// a link it then refuses to follow is a page missing from a report rather
// than a page fetched off somebody else's domain.
const PUBLIC_SECOND_LABEL = new Set([
  "co", "com", "net", "org", "edu", "gov", "mil", "ac", "sch", "gob", "gouv",
  "or", "ne", "go", "ltd", "plc", "me", "asn", "id", "in", "nic", "govt", "nom", "web", "art",
]);

/** The domain a person would say they own: the last two labels, or the last
 *  three when the middle one is a public suffix under a country code. */
export function registrableDomain(hostname) {
  const labels = trim(hostname).toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  if (tld.length === 2 && PUBLIC_SECOND_LABEL.has(second)) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

/** The host a person means when they name a site. `www.` is the site itself by
 *  a convention older than the web, so www.acme.example and acme.example are
 *  one host here, and a site that redirects one to the other is not thereby
 *  refusing to be read. Any other label in front is another site. */
export const siteHost = (host) => trim(host).toLowerCase().replace(/\.$/, "").replace(/^www\./, "");

/** An address resolved against the page it was written on, or null when it is
 *  not an address at all. */
export function absolute(href, base) {
  const raw = trim(href);
  if (!raw) return null;
  try { return new URL(raw, base); } catch { return null; }
}

/** The same page under two spellings is one page: the fragment is dropped and
 *  a trailing slash does not make a second address. */
export const pageKey = (url) => {
  const u = url instanceof URL ? url : new URL(url);
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return `${u.origin}${path}${u.search}`;
};

// ── what a page names ───────────────────────────────────────────────────────

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " " };
const unesc = (s) => String(s ?? "").replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
  if (body[0] === "#") {
    const n = /^#[xX]/.test(body) ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
    return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  }
  return ENTITIES[body.toLowerCase()] ?? whole;
});

/** The attributes of one tag, by their lower case names. */
export function attrsOf(text) {
  const out = {};
  for (const m of String(text ?? "").matchAll(/([a-zA-Z][a-zA-Z0-9:_.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = unesc(m[3] ?? m[4] ?? m[5]);
  }
  return out;
}

/** What one page names: the pages it links to in the order it links to them,
 *  the stylesheets it loads, and its web app manifest. Read with patterns
 *  rather than a parser because this package carries no dependencies at all; a
 *  link this misses is a page the report does not have, never a wrong one. */
export function linksInPage(html) {
  const text = String(html ?? "");
  const visible = text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, " ");
  const anchors = [];
  for (const m of visible.matchAll(/<a\b([^>]*)>/gi)) {
    const href = trim(attrsOf(m[1]).href);
    if (href) anchors.push(href);
  }
  const stylesheets = [];
  let manifest = null;
  for (const m of text.matchAll(/<link\b([^>]*)>/gi)) {
    const a = attrsOf(m[1]);
    const href = trim(a.href);
    if (!href) continue;
    const rels = trim(a.rel).toLowerCase().split(/\s+/);
    if (rels.includes("stylesheet")) stylesheets.push(href);
    else if (rels.includes("manifest") && !manifest) manifest = href;
  }
  return { anchors, stylesheets, manifest };
}

// A link to one of these is a file and not a page that states a brand.
const NOT_A_PAGE = /\.(pdf|zip|gz|tgz|tar|rar|7z|dmg|exe|pkg|png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|mp4|webm|mov|avi|mp3|wav|ogg|woff2?|ttf|otf|eot|css|js|mjs|cjs|json|xml|rss|atom|txt|csv|docx?|xlsx?|pptx?)$/i;

/**
 * The pages to fetch next, from the anchors the home page wrote, and one plain
 * sentence for each kind of link that was not followed. Pure, so a test drives
 * the whole rule without a network.
 */
export function nextPages(anchors, { base, host, domain, limit = DEFAULT_PAGES - 1, asked = limit + 1 } = {}) {
  const take = [];
  const skipped = [];
  const seen = new Set([pageKey(base)]);
  const onHost = siteHost(host || new URL(base).host);
  let off = 0;
  let notHttps = 0;
  let notPages = 0;
  let over = 0;
  let elsewhere = 0;
  const elsewhereHosts = [];
  for (const href of anchors ?? []) {
    const raw = trim(href);
    if (!raw || raw.startsWith("#")) continue;
    const url = absolute(raw, base);
    if (!url) continue;
    if (url.protocol !== "https:") {
      // mailto, tel and javascript are not links to a page at all, so they are
      // passed over rather than counted as something refused.
      if (url.protocol === "http:") notHttps += 1;
      continue;
    }
    if (url.username || url.password) continue;
    if (registrableDomain(url.hostname) !== domain) { off += 1; continue; }
    // Another host under the same domain is another site. It may be run by the
    // same people and it is still not the site that was asked for, and reading
    // it as more pages of this one puts two brands in one profile, which then
    // carries neither.
    if (siteHost(url.host) !== onHost) {
      elsewhere += 1;
      if (!elsewhereHosts.includes(url.hostname)) elsewhereHosts.push(url.hostname);
      continue;
    }
    if (notPublic(url.hostname)) continue;
    if (NOT_A_PAGE.test(url.pathname)) { notPages += 1; continue; }
    const key = pageKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    if (take.length >= limit) { over += 1; continue; }
    url.hash = "";
    take.push(url.href);
  }
  if (off) skipped.push(`the home page links to ${many(off, "page")} off ${domain}, and a link off the domain is never followed`);
  if (elsewhere) {
    const named = elsewhereHosts.slice(0, 3).join(", ");
    const more = elsewhereHosts.length > 3 ? ` and ${elsewhereHosts.length - 3} more` : "";
    skipped.push(`the home page links to ${many(elsewhere, "page")} on ${elsewhereHosts.length === 1 ? "another host" : "other hosts"} under ${domain} (${named}${more}), and another host is another site whose brand is its own, so ${elsewhere === 1 ? "it was" : "they were"} not followed`);
  }
  if (notHttps) skipped.push(`the home page links to ${many(notHttps, "page")} that ${notHttps === 1 ? "is" : "are"} not https, and only https is fetched`);
  if (notPages) skipped.push(`the home page links to ${many(notPages, "file")} that ${notPages === 1 ? "is" : "are"} not a web page`);
  if (over) skipped.push(`the home page links to ${many(over, "page")} on ${domain} past the ${many(asked, "page")} asked for, which ${over === 1 ? "was" : "were"} not fetched`);
  return { take, skipped };
}

// ── fetching ────────────────────────────────────────────────────────────────

/** The one place this step touches the network. Handed in so a test drives all
 *  of the above and all of the below without one. */
export const net = { fetch: (url, init) => fetch(url, init) };

/** Why a request did not work, in words a person reads in a reply. "fetch
 *  failed" is what the runtime says for everything from a name that does not
 *  exist to a refused connection, and a reply repeating that tells nobody
 *  whether the address was wrong or the site was down. */
export function whyNoAnswer(e, ms) {
  const why = trim(e?.message) || "it did not answer";
  if (/abort|timeout|timed out/i.test(why)) return `it did not answer within ${Math.max(1, Math.round(ms / 1000))} seconds`;
  const code = trim(e?.cause?.code);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "there is no web address by that name";
  if (code === "ECONNREFUSED") return "the server refused the connection";
  if (code === "CERT_HAS_EXPIRED" || /^(ERR_TLS|UNABLE_TO_VERIFY|SELF_SIGNED)/.test(code)) return `its certificate was not accepted: ${code}`;
  if (code) return `the connection failed: ${code}`;
  return why === "fetch failed" ? "the connection failed" : why;
}

/** The body, or null when it passes the ceiling. Read a piece at a time where
 *  the runtime allows it, so a page that never ends is dropped rather than
 *  held. */
async function bodyWithin(res, limit) {
  const reader = res?.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > limit ? null : buf;
  }
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { try { await reader.cancel(); } catch { /* it is already refused */ } return null; }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Fetch one address and keep it: its address as it settled, the moment it was
 * fetched, its digest, its size, what kind of thing it is and its text.
 * Throws a Refusal, in one plain sentence, for every address this step will
 * not open and every answer it will not read.
 */
export async function fetchResource(address, {
  io = net, now = Date.now, deadline = null, limit = MAX_PAGE_BYTES, accept = PAGE_ACCEPT, domain = null, host = null,
} = {}) {
  const given = trim(address);
  let url;
  try { url = new URL(given); } catch { refuse(`${given || "an address that was given"} is not a web address`); }
  if (url.protocol === "file:" || url.protocol === "data:") {
    refuse(`${url.protocol.replace(":", "")} addresses are never opened, and ${given} is one`);
  }
  if (url.protocol !== "https:") refuse(`${url.href} is not https, and only https is fetched`);
  if (url.username || url.password) refuse(`the address for ${url.host} carries a sign-in, and a credential is never accepted`);
  const whyNot = notPublic(url.hostname);
  if (whyNot) refuse(`${url.href} was not fetched, because ${whyNot}`);
  if (domain && registrableDomain(url.hostname) !== domain) {
    refuse(`${url.href} is off ${domain}, and a link off the domain is never followed`);
  }
  // The host guard is asked for by the caller that wants pages. The home page
  // is fetched without it, because a site that sends acme.example to
  // www.acme.example is answering and not refusing, and the host everything
  // after it is held to is the one the home page settled on.
  if (host && siteHost(url.host) !== siteHost(host)) {
    refuse(`${url.href} is on a different host from ${host}, and another host is another site`);
  }

  const left = deadline === null ? PER_FETCH_MS : deadline - now();
  if (left <= 0) refuse(`there was no time left to fetch ${url.href}`);
  const wait = Math.min(PER_FETCH_MS, left);

  let res;
  try {
    res = await io.fetch(url.href, {
      redirect: "follow",
      headers: { accept, "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(wait),
    });
  } catch (e) {
    refuse(`${url.href} could not be read: ${whyNoAnswer(e, wait)}`);
  }

  const landed = trim(res?.url) || url.href;
  let settled;
  try { settled = new URL(landed); } catch { refuse(`${url.href} answered from ${landed}, which is not a web address`); }
  if (settled.protocol !== "https:") {
    refuse(`${url.href} redirected to ${settled.href}, which is not https, so nothing was read`);
  }
  if (domain && registrableDomain(settled.hostname) !== domain) {
    refuse(`${url.href} redirected to ${settled.href}, which is off ${domain}, so nothing was read`);
  }
  if (host && siteHost(settled.host) !== siteHost(host)) {
    refuse(`${url.href} redirected to ${settled.href}, which is on a different host from ${host}, so nothing was read`);
  }
  if (res.status === 401 || res.status === 403) refuse(`${settled.href} asks for a sign-in, and this step never signs in`);
  if (!res.ok) refuse(`${settled.href} answered ${res.status}`);

  const bytes = await bodyWithin(res, limit);
  if (bytes === null) {
    refuse(`${settled.href} is larger than the ${Math.round(limit / 1024)} kilobytes this step will read`);
  }
  const mediaType = trim(res.headers?.get?.("content-type")).split(";")[0].toLowerCase();
  return {
    address: settled.href,
    fetched: new Date(now()).toISOString(),
    sha256: digest(bytes),
    bytes: bytes.length,
    media_type: mediaType,
    text: bytes.toString("utf8"),
  };
}

const HTML_TYPES = /^(text\/html|application\/xhtml\+xml)$/;

/** Whether what came back is a web page. A server that says what it sent is
 *  believed; one that says nothing is read by what it starts with. */
export function looksHtml({ media_type: mediaType, text } = {}) {
  if (mediaType) return HTML_TYPES.test(mediaType);
  return /^\s*(<!doctype\s+html|<html\b)/i.test(String(text ?? "").slice(0, 2000));
}

const kindLabel = { page: "page", stylesheet: "stylesheet", manifest: "web app manifest" };

/**
 * Fetch the whole site: the home page, its web app manifest, the pages it
 * links to ON THE SAME HOST up to the limit, and every stylesheet those pages
 * name. Returns the record the next step reads.
 *
 * The host is the one the home page settled on, so a domain that redirects to
 * its www is read and not refused, and a link to any other host under the same
 * domain is named in `skipped` rather than followed.
 *
 * It refuses only for the home page, because a brand cannot be read from a
 * domain that will not answer. Everything after it that could not be fetched
 * is a sentence in `skipped` and the record is still written.
 */
export async function fetchSite({ domain, pages = DEFAULT_PAGES, now = Date.now } = {}, io = net) {
  const url = siteUrl(domain);
  const site = registrableDomain(url.hostname);
  const limit = pageLimit(pages);
  const deadline = now() + TOTAL_MS;
  const resources = [];
  const skipped = [];
  const counters = { page: 0, stylesheet: 0, manifest: 0 };
  const keep = (kind, got, extra = {}) => {
    counters[kind] += 1;
    const id = `${kind[0]}${counters[kind]}`;
    const record = { id, kind, ...extra, ...got };
    resources.push(record);
    return record;
  };

  const home = await fetchResource(url.href, {
    io, now, deadline, limit: MAX_PAGE_BYTES, accept: PAGE_ACCEPT, domain: site,
  });
  if (!looksHtml(home)) {
    refuse(`${home.address} answered with ${home.media_type || "nothing in particular"}, which is not a web page, so no brand was read from it`);
  }
  const first = keep("page", home, { role: "home" });
  // The host everything after the home page is held to, taken from where the
  // home page settled rather than from what was typed.
  const host = new URL(home.address).host;
  const named = linksInPage(home.text);

  // The manifest first, because it is one small request and it is the only
  // place a site states both a color and a mark in the same breath.
  if (named.manifest) {
    const at = absolute(named.manifest, home.address);
    if (!at) skipped.push(`the home page names a web app manifest at ${squash(named.manifest).slice(0, 120)}, which is not an address`);
    else {
      try {
        keep("manifest", await fetchResource(at.href, {
          io, now, deadline, limit: MAX_MANIFEST_BYTES, accept: MANIFEST_ACCEPT, domain: site,
        }), { named_by: [first.id] });
      } catch (e) { skipped.push(`the web app manifest was not fetched: ${reasonOf(e)}`); }
    }
  } else {
    skipped.push("the home page names no web app manifest");
  }

  // The count the person gave is of pages in total, and the home page is one
  // of them, so what is left is what the home page may be followed into.
  const next = nextPages(named.anchors, { base: home.address, host, domain: site, limit: limit - 1, asked: limit });
  skipped.push(...next.skipped);
  const sheets = new Map();
  const noteSheets = (page, hrefs, base) => {
    let off = 0;
    for (const href of hrefs) {
      const at = absolute(href, base);
      if (!at) continue;
      if (at.protocol !== "https:" || registrableDomain(at.hostname) !== site || notPublic(at.hostname)) { off += 1; continue; }
      at.hash = "";
      const found = sheets.get(at.href);
      if (found) { if (!found.includes(page)) found.push(page); continue; }
      sheets.set(at.href, [page]);
    }
    return off;
  };
  let offSheets = noteSheets(first.id, named.stylesheets, home.address);

  for (const address of next.take) {
    try {
      const got = await fetchResource(address, {
        io, now, deadline, limit: MAX_PAGE_BYTES, accept: PAGE_ACCEPT, domain: site, host,
      });
      if (!looksHtml(got)) {
        skipped.push(`${got.address} answered with ${got.media_type || "nothing in particular"}, which is not a web page`);
        continue;
      }
      const page = keep("page", got, { role: "linked" });
      offSheets += noteSheets(page.id, linksInPage(got.text).stylesheets, got.address);
    } catch (e) { skipped.push(`${address} was not fetched: ${reasonOf(e)}`); }
  }
  if (offSheets) {
    skipped.push(`the pages name ${many(offSheets, "stylesheet")} off ${site}, and a link off the domain is never followed`);
  }

  const wanted = [...sheets.entries()];
  for (const [address, namedBy] of wanted.slice(0, MAX_STYLESHEETS)) {
    try {
      keep("stylesheet", await fetchResource(address, {
        io, now, deadline, limit: MAX_STYLESHEET_BYTES, accept: STYLESHEET_ACCEPT, domain: site,
      }), { named_by: namedBy });
    } catch (e) { skipped.push(`${address} was not fetched: ${reasonOf(e)}`); }
  }
  if (wanted.length > MAX_STYLESHEETS) {
    skipped.push(`the pages name ${many(wanted.length, "stylesheet")}, and the ${wanted.length - MAX_STYLESHEETS} past the first ${MAX_STYLESHEETS} were not fetched`);
  }

  return {
    fetched: FETCHED,
    site: home.address,
    host,
    domain: site,
    started: new Date(deadline - TOTAL_MS).toISOString(),
    pages_asked: limit,
    resources,
    skipped,
  };
}

/** A refusal is already one plain sentence; anything else is said as plainly
 *  as the runtime allows. */
const reasonOf = (e) => (e instanceof Refusal ? e.message : trim(e?.message) || "it did not answer");

/** How many pages to fetch in total, the home page included, from what the
 *  person asked for. The home page is always one of them, so nought is not a
 *  count this step can honour and it is said rather than quietly read as one. */
export function pageLimit(value) {
  if (value === undefined || value === null || trim(value) === "") return DEFAULT_PAGES;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) refuseSettings(`PAGES is how many pages to fetch in total, counting the home page, a whole number from 1 to ${MAX_PAGES}, and "${trim(value)}" is not one`);
  if (n > MAX_PAGES) refuseSettings(`PAGES is at most ${MAX_PAGES}, and ${n} is past it; a brand is read from the first few pages of a site`);
  return n;
}

const EXTENSION = { page: "html", stylesheet: "css", manifest: "webmanifest" };

/** The bare name a resource's body is written under. Bare, because the record
 *  travels and a local path in it would say where this agent keeps its work. */
export const fileNameFor = (resource) => `${resource.id}.${EXTENSION[resource.kind] ?? "txt"}`;

/**
 * Write the record, and the bodies beside it when a folder was named. The
 * folder is never written into the record: each resource carries the bare file
 * name its body went to and nothing more.
 */
export function writeFetched(fetched, { out, dir = null } = {}) {
  if (!trim(out)) refuseSettings("OUT is required: the file to write the fetched record to");
  if (trim(dir)) {
    const folder = resolve(trim(dir));
    mkdirSync(folder, { recursive: true });
    for (const resource of fetched.resources) {
      const name = fileNameFor(resource);
      writeFileSync(join(folder, name), resource.text ?? "");
      resource.file = name;
    }
  }
  mkdirSync(dirname(resolve(trim(out))), { recursive: true });
  writeFileSync(trim(out), `${JSON.stringify(fetched, null, 2)}\n`);
  return fetched;
}

/** The one line the step prints when it has fetched everything it could. */
export function summarise(fetched) {
  const of = (kind) => fetched.resources.filter((r) => r.kind === kind).length;
  const linked = of("page") - 1;
  const parts = [
    `the home page${linked > 0 ? ` and ${many(linked, "page")} it links to` : ""}`,
    of("manifest") ? "the web app manifest" : "no web app manifest",
    of("stylesheet") ? many(of("stylesheet"), "stylesheet") : "no stylesheet",
  ];
  return `fetched ${parts.join(", ")} from ${fetched.site}`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  try {
    const domain = trim(process.env.DOMAIN);
    const out = trim(process.env.OUT);
    if (!domain) refuseSettings("DOMAIN is required: the address of the site to read");
    if (!out) refuseSettings("OUT is required: the file to write the fetched record to");
    const fetched = await fetchSite({ domain, pages: process.env.PAGES });
    writeFetched(fetched, { out, dir: process.env.DIR });
    console.log(summarise(fetched));
  } catch (e) {
    if (e instanceof Refusal) { console.error(`refused: ${e.message}`); process.exit(e.settings ? 2 : 1); }
    console.error(`the site could not be fetched: ${trim(e?.message) || e}`);
    process.exit(1);
  }
}
