// Collect what the site STATES about itself, and nothing else.
//   needs: node >= 22, no network
//   FETCHED=records/<job>/fetched.json OUT=records/<job>/statements.json
//   node statements.mjs
// Exit: 0 read, whether or not anything was found; 1 refused, and the one
// sentence saying why is printed; 2 the settings are not right.
//
// A statement is something the site declares about itself, in a place whose
// purpose is to declare it. references/what-counts.md is the authority on what
// qualifies, and this step is that file written out:
//
//   the mark      only the four routes that NAME an image as the mark: an
//                 organisation record whose logo names it, an element in the
//                 header that says logo and links to the root, an icon in the
//                 web app manifest at 180 pixels or more, and the apple touch
//                 icon. A favicon is a sixteen pixel tab picture and is never
//                 the mark, which is the exact silent wrongness this step
//                 exists to prevent. A share image is a social card, not a
//                 mark. No color is ever taken out of the mark.
//   color        theme_color in the web app manifest, the theme-color meta
//                 tag, and a custom property on :root or html whose NAME says
//                 what it is. The name is the statement: --brand-primary is
//                 one and --c3 is not. Stating a color and filling a role are
//                 two things, and only the second can reach a profile, so each
//                 custom property carries the role its name fills when it
//                 names one. --brand-primary fills primary; --blue-400 fills
//                 nothing and belongs in the report.
//   type          a font-family a stylesheet declares for headings or for body
//                 text, with its whole fallback stack; a stack written through
//                 a variable declared on :root, followed one step, which is
//                 one statement written in two places; and the families a
//                 stylesheet address names in itself, which the site wrote on
//                 its own page and which carry no fallback stack.
//   the legal     the copyright line in the footer and the trademark on the
//   lines         organisation's name at its first mention on the home page,
//                 both as the exact text the site wrote.
//
// THE PLACES WHERE THE PLACE IS THE MEANING are statements too, and they are
// deliberately NOT collected here. The color of body text, the color behind
// it, the color of headings, the color of a link in running text, the
// background of the main call to action, and the font stacks the site asks for
// on its body and on its headings are all what the site's own CSS sets on its
// own elements, and what a rule sets is not what an element comes to: the
// cascade, the media queries and the specificity decide between them, and a
// browser is what settles that. The step after this one opens the pages and
// reads them, and they reach the profile as statements exactly like these.
// Matching selectors here as well would state a color no page ever shows and
// then argue with the page about it.
//
// Every statement carries three things: the address it was found at, the place
// within that address, and how many times it was seen. A statement with no
// evidence is not written. The record also carries the counts, the colors
// stated and the colors filling a role among them, so the report can say that
// a site states two hundred colors and names five of them.
//
// Nothing is sampled, nothing is inferred and nothing is defaulted. A color
// out of a logo, a face guessed from how a heading looks, and a primary color
// chosen because it appears most are all inferences, and they belong in the
// report. A site that states nothing is a real answer: the statements file is
// written empty and says which of the six were looked for.
//
// No local file path is ever written into the statements, because they travel
// to the person and into the profile.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const STATEMENTS = "v1";

/** The six things looked for, said the same way every time, so that a site
 *  which states nothing can still say what was looked for. */
export const LOOKED_FOR = [
  "the theme color",
  "the custom properties whose names say what they are",
  "the font families the stylesheets name",
  "the mark the site names as its own",
  "the trademark on first mention",
  "the copyright line",
];

// Under this, an icon is a favicon by another name. 180 is the apple touch
// icon size, the smallest square anybody publishes as their mark.
export const MARK_MIN_PIXELS = 180;

// A custom property whose name carries one of these says what it is. The name
// is the statement, so the list is of words a person would recognise as a role
// in a palette, and a property called --c3 carries none of them.
export const BRAND_WORDS = [
  // Both spellings, because this list matches what a SITE wrote in its own CSS
  // and a British site writes --colour-primary. Our own prose says color.
  "brand", "color", "colour", "primary", "secondary", "tertiary", "accent",
  "ink", "ground", "background", "foreground", "surface", "highlight", "link",
  "muted", "border", "shadow", "danger", "success", "warning", "error", "info",
  "neutral", "theme", "palette",
];

// A name that says which color it is says what it is, the same way a name
// that says which role it fills does. --blue-400 is a statement; --c3 is not.
export const HUE_WORDS = [
  "black", "white", "grey", "gray", "silver", "slate", "stone", "red", "rose",
  "pink", "magenta", "purple", "violet", "indigo", "blue", "sky", "cyan",
  "teal", "emerald", "green", "lime", "olive", "yellow", "amber", "gold",
  "orange", "brown", "beige", "cream",
];

/** What this step will not read, in one plain sentence. The caller prints it
 *  as `refused: <sentence>` and stops. `settings` marks the ones that are the
 *  caller's to fix rather than the material's. */
export class Refusal extends Error {
  constructor(why, { settings = false } = {}) { super(why); this.name = "Refusal"; this.settings = settings; }
}
const refuse = (why) => { throw new Refusal(why); };
const refuseSettings = (why) => { throw new Refusal(why, { settings: true }); };

const trim = (text) => String(text ?? "").trim();
const squash = (text) => String(text ?? "").replace(/\s+/g, " ").trim();
const many = (n, one, more = `${one}s`) => `${n} ${n === 1 ? one : more}`;

/** A file name with no folders in front of it. This is the only part of a path
 *  that is ever printed. */
export const bareName = (path) => trim(path).split(/[\\/]/).pop() || "";

// ── what a page wrote ───────────────────────────────────────────────────────

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " ",
  copy: "©", reg: "®", trade: "™", ndash: "–", rsquo: "’", lsquo: "‘",
};

/** The named and numbered entities a page uses, as the characters they stand
 *  for. An entity nobody listed is left as it was written rather than dropped,
 *  because the legal lines are kept as the exact text the site wrote. */
export function decodeEntities(text) {
  return String(text ?? "").replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === "#") {
      const n = /^#[xX]/.test(body) ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** The attributes of one tag, by their lower case names. */
export function attrsOf(text) {
  const out = {};
  for (const m of String(text ?? "").matchAll(/([a-zA-Z][a-zA-Z0-9:_.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5]);
  }
  return out;
}

const BLOCK_END = /<\/(?:p|div|section|article|li|tr|td|th|h[1-6]|blockquote|pre|figcaption|footer|header|nav|small|span)\s*>|<br\s*\/?>/gi;
const HIDDEN = /<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi;

/** Markup to the words a reader sees, one line a block. What a page runs or
 *  paints with is not something the page says. */
export function stripTags(html) {
  return decodeEntities(String(html ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(HIDDEN, " ")
    .replace(BLOCK_END, "\n")
    .replace(/<[^>]*>/g, " "))
    .split("\n").map((line) => squash(line)).join("\n").replace(/\n{2,}/g, "\n").trim();
}

/** An address resolved against the page it was written on, or null. */
export function absolute(href, base) {
  const raw = trim(href);
  if (!raw) return null;
  try { return new URL(raw, base).href; } catch { return null; }
}

/** The largest square an icon declares, or 0 when it declares none.
 *  sizes="16x16 32x32 180x180" and sizes="any" are both ordinary. */
export function sizeOf(sizes) {
  let best = 0;
  for (const m of String(sizes ?? "").matchAll(/(\d+)\s*[x×]\s*(\d+)/gi)) {
    best = Math.max(best, Math.min(Number(m[1]), Number(m[2])));
  }
  return best;
}

/** The meta tags, the link tags and the JSON-LD blocks of one page. Read with
 *  patterns rather than a parser because this package carries no dependencies
 *  at all; a statement this misses is a statement the profile does not have,
 *  never a wrong one. */
export function readHead(html) {
  const text = String(html ?? "");
  const metas = [];
  const links = [];
  for (const m of text.matchAll(/<(meta|link)\b([^>]*)>/gi)) {
    const a = attrsOf(m[2]);
    if (m[1].toLowerCase() === "meta") {
      const name = trim(a.property ?? a.name ?? a.itemprop).toLowerCase();
      if (name && a.content !== undefined) metas.push({ name, content: trim(a.content), media: trim(a.media) });
    } else if (a.rel && a.href) {
      links.push({ rel: trim(a.rel).toLowerCase(), href: trim(a.href), sizes: trim(a.sizes), type: trim(a.type).toLowerCase() });
    }
  }
  const ld = [];
  for (const m of text.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try { ld.push(JSON.parse(m[1])); } catch { /* a block that is not JSON states nothing */ }
  }
  return { metas, links, ld };
}

export const relIs = (link, name) => trim(link?.rel).split(/\s+/).includes(name);

/** Every style block written into the page itself. A style block is a
 *  stylesheet the page carries, so what it declares on :root is declared in a
 *  place whose purpose is to declare it. */
export function styleBlocks(html) {
  const out = [];
  for (const m of String(html ?? "").matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    if (trim(m[1])) out.push(m[1]);
  }
  return out;
}

// ── the mark ────────────────────────────────────────────────────────────────

/** Every logo an organisation record names, at any depth and through @graph.
 *  A site writing an organisation record with a logo in it has said the word
 *  outright, which is the strongest statement any site makes about which image
 *  is its mark. A logo on a record that is not an organisation is passed over,
 *  because what-counts.md names the Organization record and nothing else. */
export function organisationLogos(node, out = []) {
  if (Array.isArray(node)) { for (const item of node) organisationLogos(item, out); return out; }
  if (!node || typeof node !== "object") return out;
  const types = [].concat(node["@type"] ?? []).filter((t) => typeof t === "string");
  if (types.some((t) => /organi[sz]ation/i.test(t))) {
    const logo = node.logo;
    if (typeof logo === "string" && trim(logo)) out.push(trim(logo));
    else if (logo && typeof logo === "object") {
      const url = trim(logo.url) || trim(logo.contentUrl);
      if (url) out.push(url);
    }
  }
  for (const [key, value] of Object.entries(node)) if (key !== "logo") organisationLogos(value, out);
  return out;
}

const HEADER_BLOCK = /<header\b[^>]*>([\s\S]*?)<\/header\s*>/gi;
const BANNER_BLOCK = /<([a-z][a-z0-9]*)\b[^>]*\brole\s*=\s*["']banner["'][^>]*>([\s\S]*?)<\/\1\s*>/gi;
const SAYS_LOGO = /(^|[\s_-])logos?([\s_-]|$)/i;

/** Whether an address is the site's own root, which is what a mark in the
 *  header links to. */
export function isRoot(href, base) {
  const at = absolute(href, base);
  if (!at) return false;
  try {
    const url = new URL(at);
    const home = new URL(base);
    return url.origin === home.origin && (url.pathname === "/" || url.pathname === "") && !url.search;
  } catch { return false; }
}

/**
 * The images the page marks as its logo: inside the header, linking to the
 * root, and saying logo in the class, the id or the alt text of either the
 * link or the image. All three have to hold, because each on its own is
 * something every site has.
 */
export function headerLogos(html, base) {
  const text = String(html ?? "").replace(/<!--[\s\S]*?-->/g, " ");
  const blocks = [];
  for (const m of text.matchAll(HEADER_BLOCK)) blocks.push(m[1]);
  for (const m of text.matchAll(BANNER_BLOCK)) blocks.push(m[2]);
  const out = [];
  const inline = [];
  for (const block of blocks) {
    for (const anchor of block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
      const a = attrsOf(anchor[1]);
      if (!isRoot(a.href, base)) continue;
      const linkSays = SAYS_LOGO.test(`${a.class ?? ""} ${a.id ?? ""} ${a["aria-label"] ?? ""} ${a.title ?? ""}`);
      for (const image of anchor[2].matchAll(/<img\b([^>]*)>/gi)) {
        const i = attrsOf(image[1]);
        const says = linkSays || SAYS_LOGO.test(`${i.class ?? ""} ${i.id ?? ""} ${i.alt ?? ""}`);
        if (!says) continue;
        const src = absolute(trim(i.src) || trim(i["data-src"]), base);
        if (src && !out.includes(src)) out.push(src);
      }
      // A mark drawn into the page has no address to carry, so it is named in
      // the report and never written as a value.
      if ((linkSays || SAYS_LOGO.test(anchor[2].slice(0, 400))) && /<svg\b/i.test(anchor[2])) inline.push(true);
    }
  }
  return { marks: out, inline: inline.length };
}

// ── css ─────────────────────────────────────────────────────────────────────

/** Split on a separator that is not inside quotes, brackets or parentheses, so
 *  that a selector list is split on its own commas and a font stack on its
 *  own, and url(data:...;base64,...) is left alone. */
export function splitTop(text, separator) {
  const src = String(text ?? "");
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "(" || c === "[") { depth += 1; continue; }
    if (c === ")" || c === "]") { if (depth > 0) depth -= 1; continue; }
    if (depth === 0 && c === separator) { out.push(src.slice(start, i)); start = i + 1; }
  }
  out.push(src.slice(start));
  return out.map((piece) => piece.trim()).filter(Boolean);
}

/** The text of a rule's own declarations, with any nested rule taken out, so
 *  that a nested block is never read as a declaration of its parent. */
function ownDeclarations(body) {
  const src = String(body ?? "");
  let out = "";
  let depth = 0;
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (depth === 0) out += c;
      if (c === "\\") { if (depth === 0) out += src[i + 1] ?? ""; i += 1; }
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; if (depth === 0) out += c; continue; }
    if (c === "{") { depth += 1; continue; }
    if (c === "}") { if (depth > 0) depth -= 1; continue; }
    if (depth === 0) out += c;
  }
  return out;
}

const PROPERTY = /^(--)?[a-zA-Z_][a-zA-Z0-9_-]*$/;

/** One rule body as its declarations. A piece whose name is not a property
 *  name is the leftover of a nested selector and is not a declaration. */
export function declarationsOf(body) {
  const out = [];
  for (const piece of splitTop(ownDeclarations(body), ";")) {
    const at = piece.indexOf(":");
    if (at < 0) continue;
    const name = piece.slice(0, at).trim();
    const value = squash(piece.slice(at + 1)).replace(/\s*!\s*important\s*$/i, "").trim();
    if (!name || !value || !PROPERTY.test(name)) continue;
    out.push({ name, value });
  }
  return out;
}

/** Every block in a stylesheet, as { prelude, body }, honouring quotes so that
 *  a brace inside a string does not end a rule. */
function blocksOf(text) {
  const src = String(text ?? "");
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  let bodyStart = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === "{") { if (depth === 0) bodyStart = i + 1; depth += 1; continue; }
    if (c === "}") {
      depth -= 1;
      if (depth <= 0) { out.push({ prelude: src.slice(start, bodyStart - 1).trim(), body: src.slice(bodyStart, i) }); start = i + 1; depth = 0; }
      continue;
    }
    if (depth === 0 && c === ";") { start = i + 1; }
  }
  return out;
}

const GROUP_AT_RULE = /^@(media|supports|layer|container|scope|document)\b/i;

/**
 * A stylesheet as its style rules, in the order they are written, descending
 * into the at-rules that group rules. @font-face and @keyframes are not style
 * rules: @font-face names a face the site is loading, which is not a face it
 * declares for headings or for body text.
 */
export function cssRules(css) {
  const out = [];
  const walk = (text) => {
    for (const { prelude, body } of blocksOf(text)) {
      if (prelude.startsWith("@")) {
        if (GROUP_AT_RULE.test(prelude)) walk(body);
        continue;
      }
      if (!prelude) continue;
      out.push({ selector: squash(prelude), declarations: declarationsOf(body) });
    }
  };
  walk(String(css ?? "").replace(/\/\*[\s\S]*?\*\//g, " "));
  return out;
}

/** The compound a selector actually targets, which is its last one: ".page h1"
 *  sets the face of a heading and "h1 .badge" does not. */
const subjectOf = (part) => squash(part).split(/\s*[\s>+~]\s*/).filter(Boolean).pop() ?? "";

/** Which of headings and body text a selector declares for, which may be both
 *  and is often neither. */
export function selectorRoles(selector) {
  const roles = new Set();
  for (const part of splitTop(selector, ",")) {
    const subject = subjectOf(part);
    if (/^h[1-6]\b/i.test(subject)) roles.add("heading");
    if (/^(body|html|\*)\b/i.test(subject) || /^:root\b/i.test(subject)) roles.add("body");
  }
  return [...roles];
}

/** Whether a rule declares on :root or html, which is where a site states a
 *  custom property about itself rather than about one component. */
export function declaresOnRoot(selector) {
  return splitTop(selector, ",").some((part) => {
    const subject = subjectOf(part);
    return /^:root\b/i.test(subject) || /^html\b/i.test(subject);
  });
}

const words = (name) => trim(name).replace(/^--/, "").toLowerCase().split(/[-_]+/).filter(Boolean);

/** Whether a custom property's NAME says what it is. The name is the
 *  statement: --brand-primary, --color-primary, --blue-400 and --bg say it,
 *  --c3 does not. A name that says which role it fills has said what it is by
 *  saying that, so the role words count here too and a bare --text or --bg is
 *  not lost for want of a second word. */
export function namesWhatItIs(name) {
  return words(name).some((word) => BRAND_WORDS.includes(word) || HUE_WORDS.includes(word) || Object.hasOwn(ROLE_WORDS, word));
}

// The words that name the role a color fills, which is a different question
// from whether the name says what it is. Stating a color and filling a role
// are two things: --brand-primary states a color AND fills the primary role,
// so it can go in the profile; --blue-400 states a color and fills no role,
// so it is kept and reported and never written into a profile as though the
// owner had chosen it for something.
const QUALIFIER = new Set(["brand", "color", "color", "theme", "palette"]);
// The test a word has to pass to be in here: the name must be unambiguous
// about which role it fills to somebody reading the name alone, knowing
// nothing about the site. `background` and `text` pass, and they are in
// because hardly anybody writes --ink or --ground and nearly everybody writes
// --color-text and --color-background, so leaving them out would empty the
// profile in the two places it is most obviously wrong to be empty. `surface`
// fails, because surface is a role in some systems and a shade in others, and
// a profile that puts a card color in ground gets applied to a whole page by
// something with no way to know it was a guess. So do canvas, muted, subtle,
// base and default: placing any of them takes a taste, and this step has none.
export const ROLE_WORDS = {
  primary: "primary", secondary: "secondary", accent: "accent",
  ink: "ink", text: "ink", foreground: "ink", fg: "ink",
  ground: "ground", background: "ground", bg: "ground",
};
const roleWord = (word) => (Object.hasOwn(ROLE_WORDS, word) ? ROLE_WORDS[word] : null);

/** The role a custom property's name says it fills, or null when it says none.
 *  The role is the whole of the name once the words that say only "this is a
 *  brand color" are taken off the front, so --brand-primary and
 *  --color-primary both fill primary, --bg fills ground, --on-primary fills
 *  on_primary, and --primary-500 and --color-gray-500 fill nothing, because a
 *  step on a ramp is not a role. */
export function roleOf(name) {
  const rest = words(name).filter((word, i, all) => !(QUALIFIER.has(word) && all.slice(0, i).every((w) => QUALIFIER.has(w))));
  if (rest.length === 1) return roleWord(rest[0]);
  if (rest.length === 2 && rest[0] === "on") {
    const role = roleWord(rest[1]);
    return role ? `on_${role}` : null;
  }
  return null;
}

const CSS_WIDE = new Set(["inherit", "initial", "unset", "revert", "revert-layer"]);

/**
 * A color the site stated, as it was written, with the plain hex beside it
 * when the two are exactly the same color. A color written as a name is not
 * converted, because converting it would mean carrying a table of names, and
 * preferring nothing over a half-right color is the rule this step follows.
 */
export function colorValue(value) {
  const raw = trim(value);
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return { value: raw, hex: v.toUpperCase() };
  if (/^#[0-9a-f]{3}$/.test(v)) return { value: raw, hex: `#${v.slice(1).split("").map((c) => c + c).join("")}`.toUpperCase() };
  // Four and eight digits carry an alpha, so there is no plain hex for them.
  if (/^#([0-9a-f]{4}|[0-9a-f]{8})$/.test(v)) return { value: raw };
  if (!/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/.test(v)) return null;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*([0-9.]+%?)\s*)?\)$/.exec(v);
  if (rgb) {
    const parts = [rgb[1], rgb[2], rgb[3]].map(Number);
    const alpha = rgb[4];
    if (parts.every((n) => n >= 0 && n <= 255) && (alpha === undefined || alpha === "1" || alpha === "100%")) {
      return { value: raw, hex: `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase() };
    }
  }
  return { value: raw };
}

const VAR = /^var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,([\s\S]*))?\)$/i;

/** Every custom property the site declares on :root or html, by name, with the
 *  distinct values it was declared with. This is the table a font stack
 *  written through a variable is resolved against. */
export function customProperties(sources) {
  const vars = new Map();
  for (const { rules } of sources ?? []) {
    for (const rule of rules) {
      if (!declaresOnRoot(rule.selector)) continue;
      for (const { name, value } of rule.declarations) {
        if (!name.startsWith("--")) continue;
        const seen = vars.get(name.toLowerCase()) ?? [];
        if (!seen.includes(value)) seen.push(value);
        vars.set(name.toLowerCase(), seen);
      }
    }
  }
  return vars;
}

/**
 * A font stack written through a variable, resolved one step: null when the
 * stack names a face outright, and otherwise every stack the variable was
 * declared with, with whatever the declaration named after it. A site writing
 * `font-family: var(--brand-font)` and `--brand-font: "Space Grotesk",
 * system-ui` on :root has made one statement in two places, so following it is
 * reading and not inferring.
 *
 * One step only. A variable whose value is another variable, and one that is
 * declared nowhere and carries no fallback, resolve to nothing, and a stack
 * that resolves to nothing states no face.
 */
export function resolveStack(value, vars) {
  const families = splitTop(squash(value), ",");
  const m = VAR.exec(families[0] ?? "");
  if (!m) return null;
  const rest = families.slice(1);
  const declared = [...(vars?.get(m[1].toLowerCase()) ?? [])];
  const fallback = trim(m[2]);
  if (!declared.length && fallback) declared.push(fallback);
  const out = [];
  for (const declaration of declared) {
    const whole = squash([declaration, ...rest].join(", "));
    if (VAR.test(splitTop(whole, ",")[0] ?? "")) continue;
    if (!out.some((o) => o.stack === whole)) out.push({ stack: whole, through: m[1] });
  }
  return out;
}

/** The font families a stylesheet address names in itself, which is how a font
 *  service is asked for them. The site wrote the address on its own page, so
 *  the families are stated there and nothing has to be fetched to read them.
 *  The address carries no fallback stack, so the family alone is the
 *  statement. */
export function familiesInHref(href, base) {
  const at = absolute(href, base);
  if (!at) return [];
  let url;
  try { url = new URL(at); } catch { return []; }
  const out = [];
  for (const asked of url.searchParams.getAll("family")) {
    for (const piece of String(asked).split("|")) {
      const family = squash(piece.split(":")[0].replace(/\+/g, " "));
      if (family && !out.includes(family)) out.push(family);
    }
  }
  return out;
}

/** The face a font-family declaration names and the whole stack it names it
 *  in, which comes free and is worth carrying. A declaration whose first
 *  family is a variable or a keyword names no face. */
export function familyOf(value) {
  const stack = squash(value);
  if (!stack) return null;
  const first = splitTop(stack, ",")[0] ?? "";
  const family = first.replace(/^["']|["']$/g, "").trim();
  if (!family || /^var\(/i.test(family) || CSS_WIDE.has(family.toLowerCase())) return null;
  return { family, stack };
}

// ── the legal lines ─────────────────────────────────────────────────────────

const FOOTER_BLOCK = /<footer\b[^>]*>([\s\S]*?)<\/footer\s*>/gi;
const CONTENTINFO_BLOCK = /<([a-z][a-z0-9]*)\b[^>]*\brole\s*=\s*["']contentinfo["'][^>]*>([\s\S]*?)<\/\1\s*>/gi;
const COPYRIGHT = /(©|\(c\)|\bcopyright\b)/i;

/** The copyright line in the footer, as the exact text the site wrote, or null
 *  when the footer carries none. */
export function footerCopyright(html) {
  const text = String(html ?? "").replace(/<!--[\s\S]*?-->/g, " ");
  const blocks = [];
  for (const m of text.matchAll(FOOTER_BLOCK)) blocks.push(m[1]);
  for (const m of text.matchAll(CONTENTINFO_BLOCK)) blocks.push(m[2]);
  for (const block of blocks) {
    for (const line of stripTags(block).split("\n")) {
      const said = squash(line);
      if (said && COPYRIGHT.test(said)) return said.slice(0, 200);
    }
  }
  return null;
}

const TRADEMARK = /(\p{Lu}[\p{L}\p{N}&'’.-]*(?:[  ]+\p{Lu}[\p{L}\p{N}&'’.-]*){0,4})[  ]*([®™℠])/u;

/** The trademark on the organisation's name at its first mention, as the exact
 *  text, or null when the page carries none. One line at a time, because the
 *  name is the run of capitalised words beside the symbol, and the line it is
 *  written on is the only thing that says where that run starts. */
export function firstTrademark(html) {
  for (const line of stripTags(html).split("\n")) {
    const m = TRADEMARK.exec(line);
    if (m) return squash(m[0]).slice(0, 120);
  }
  return null;
}

// ── collecting ──────────────────────────────────────────────────────────────

/** One kind of statement, deduplicated by what was said. The first time a
 *  thing is said fixes the address and the place it was said in; every time
 *  after that only adds to the count. */
function box() {
  const map = new Map();
  return {
    add(key, made) {
      const found = map.get(key);
      if (found) { found.count += 1; return found; }
      map.set(key, { ...made, count: 1 });
      return map.get(key);
    },
    list: () => [...map.values()],
  };
}

/**
 * Every statement the site makes about itself, from the record the fetch step
 * wrote. Pure: it reads no file and opens no connection, so a test drives all
 * of it from a record it made up.
 */
export function readStatements(fetched) {
  if (!fetched || typeof fetched !== "object" || !Array.isArray(fetched.resources)) {
    refuse("the fetched record is not in the shape this step reads: it names no resources");
  }
  const has = (kind) => fetched.resources.filter((r) => r?.kind === kind && typeof r.text === "string");
  const pages = has("page");
  const sheets = has("stylesheet");
  const manifestResource = has("manifest")[0] ?? null;
  if (!pages.length && !sheets.length && !manifestResource) {
    refuse("nothing was fetched from the site, so there is nothing to read");
  }
  const site = trim(fetched.site) || pages[0]?.address || "";
  const home = pages.find((p) => p.role === "home") ?? pages[0] ?? null;

  const mark = box();
  const color = box();
  const type = box();
  const legal = box();
  const skipped = [];
  const passed = { favicon: 0, share: 0, smallIcon: 0, unnamed: 0, notColor: 0, held: [], otherFace: 0, unresolved: 0, inlineMark: 0 };
  // Every stylesheet the site carries, read once: the style blocks the pages
  // write, then the stylesheets they name. They are gathered first because a
  // font stack written through a variable is resolved against all of them.
  const cssSources = [];

  // The web app manifest, which is the one place a site states a color and a
  // mark in the same file.
  let manifest = null;
  if (manifestResource) {
    try { manifest = JSON.parse(manifestResource.text); }
    catch { skipped.push(`the web app manifest at ${manifestResource.address} is not JSON, so nothing was read from it`); }
  }
  if (manifest && typeof manifest === "object") {
    const where = manifestResource.address;
    const stated = colorValue(manifest.theme_color);
    if (stated) {
      // The role comes with it, because the place is the meaning: the field is
      // called theme_color and holds the theme color. It is not read off the
      // name by any test, here or downstream.
      color.add(`theme_color|${trim(manifest.theme_color).toLowerCase()}`, {
        name: "theme_color", role: "theme", ...stated, where, place: "theme_color in the web app manifest",
      });
    } else if (trim(manifest.theme_color)) {
      skipped.push(`the theme color in the web app manifest is written as "${squash(manifest.theme_color).slice(0, 30)}", which this step does not convert, so no color was taken from it`);
    }
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    icons.forEach((icon, i) => {
      const src = absolute(trim(icon?.src), where);
      if (!src) return;
      const px = sizeOf(icon?.sizes);
      const scalable = /svg/i.test(trim(icon?.type)) || trim(icon?.sizes).toLowerCase().includes("any");
      if (px < MARK_MIN_PIXELS && !scalable) { passed.smallIcon += 1; return; }
      mark.add(`manifest-icon|${src}`, {
        value: src, route: "manifest-icon",
        ...(px ? { pixels: px } : {}), ...(trim(icon?.type) ? { media_type: trim(icon.type) } : {}),
        where, place: `icons[${i}] in the web app manifest${px ? `, ${px} by ${px}` : ", with no fixed size"}`,
      });
    });
  }

  for (const page of pages) {
    const where = page.address;
    const head = readHead(page.text);

    // Color: the theme-color meta tag, which a page may state twice when it
    // states one for a light ground and one for a dark.
    for (const meta of head.metas) {
      if (meta.name !== "theme-color") continue;
      const stated = colorValue(meta.content);
      const place = `meta name="theme-color"${meta.media ? ` media="${squash(meta.media).slice(0, 60)}"` : ""}`;
      if (stated) color.add(`theme-color|${meta.content.toLowerCase()}|${meta.media.toLowerCase()}`, { name: "theme-color", role: "theme", ...stated, where, place });
      else if (meta.content) skipped.push(`the theme color the page states is written as "${squash(meta.content).slice(0, 30)}", which this step does not convert, so no color was taken from it`);
    }

    // The mark, by the routes that name it and by no other.
    for (const href of head.ld.flatMap((block) => organisationLogos(block))) {
      const src = absolute(href, where);
      if (src) {
        mark.add(`organisation-record|${src}`, {
          value: src, route: "organisation-record", where,
          place: 'script type="application/ld+json", the Organization logo',
        });
      }
    }
    const header = headerLogos(page.text, where);
    passed.inlineMark += header.inline;
    for (const src of header.marks) {
      mark.add(`header-logo|${src}`, {
        value: src, route: "header-logo", where,
        place: "the logo in the page header, which links to the root",
      });
    }
    for (const link of head.links) {
      // A stylesheet on a font service names the families in the address
      // itself, and the site wrote that address on its own page, so the
      // families are stated there whether or not the stylesheet is ever
      // fetched. The address carries no fallback stack, so the family alone is
      // what was said and the family alone is what is kept.
      if (relIs(link, "stylesheet")) {
        for (const family of familiesInHref(link.href, where)) {
          type.add(`font-link|${family.toLowerCase()}`, {
            family, route: "font-link", where,
            place: `link rel="stylesheet" href="${squash(link.href).slice(0, 120)}"`,
          });
        }
        continue;
      }
      if (relIs(link, "apple-touch-icon") || relIs(link, "apple-touch-icon-precomposed")) {
        const px = sizeOf(link.sizes);
        if (px && px < MARK_MIN_PIXELS) { passed.smallIcon += 1; continue; }
        const src = absolute(link.href, where);
        if (!src) continue;
        mark.add(`apple-touch-icon|${src}`, {
          value: src, route: "apple-touch-icon", pixels: px || MARK_MIN_PIXELS, where,
          place: `link rel="apple-touch-icon"${px ? ` sizes="${px}x${px}"` : ", which is 180 by 180 by convention"}`,
        });
        continue;
      }
      // The favicon is the one to watch. It is on every site, it is a sixteen
      // pixel tab picture, and a profile carrying one as the mark looks
      // deliberate and is wrong, so it is passed over by name rather than left
      // to a size rule.
      if (relIs(link, "icon") || relIs(link, "shortcut") || relIs(link, "mask-icon")) passed.favicon += 1;
    }
    if (head.metas.some((m) => m.name === "og:image" || m.name === "twitter:image")) passed.share += 1;

    // The style blocks the page carries are stylesheets the page wrote.
    for (const block of styleBlocks(page.text)) {
      cssSources.push({ rules: cssRules(block), where, inline: true });
    }

    // The legal lines.
    const copyright = footerCopyright(page.text);
    if (copyright) legal.add(`copyright|${copyright.toLowerCase()}`, { kind: "copyright", text: copyright, where, place: "the footer" });
  }

  if (home) {
    const trademark = firstTrademark(home.text);
    if (trademark) {
      legal.add(`trademark|${trademark.toLowerCase()}`, {
        kind: "trademark", text: trademark, where: home.address, place: "the first mention on the home page",
      });
    }
  }

  for (const sheet of sheets) cssSources.push({ rules: cssRules(sheet.text), where: sheet.address, inline: false });
  const vars = customProperties(cssSources);
  for (const source of cssSources) readCss(source, { vars, color, type, passed });

  const say = (n, one, more) => (n === 1 ? one : more);
  if (passed.favicon) skipped.push(`${many(passed.favicon, "page")} ${say(passed.favicon, "names", "name")} a favicon, which is a browser tab icon and not the mark`);
  if (passed.share) skipped.push(`${many(passed.share, "page")} ${say(passed.share, "names", "name")} a share image in og:image or twitter:image, which is a social card and not the mark`);
  if (passed.smallIcon) skipped.push(`${many(passed.smallIcon, "icon")} ${say(passed.smallIcon, "is", "are")} under ${MARK_MIN_PIXELS} pixels, which is a tab icon rather than a mark`);
  if (passed.inlineMark) skipped.push(`${many(passed.inlineMark, "page header")} ${say(passed.inlineMark, "draws its mark", "draw their mark")} into the page, which has no address to carry into a profile`);
  if (passed.unnamed) skipped.push(`${many(passed.unnamed, "custom property", "custom properties")} on :root ${say(passed.unnamed, "holds a color but its name does not", "hold a color but their names do not")} say what it is, and the name is the statement`);
  if (passed.notColor) {
    const held = [...new Set(passed.held)].slice(0, 3).map((v) => `"${v}"`).join(", ");
    skipped.push(`${many(passed.notColor, "custom property", "custom properties")} whose name says what it is ${say(passed.notColor, "holds", "hold")} something this step does not read as a color${held ? `: ${held}` : ""}`);
  }
  if (passed.otherFace) skipped.push(`${many(passed.otherFace, "font-family declaration")} ${say(passed.otherFace, "names", "name")} neither headings nor body text, so ${say(passed.otherFace, "it is", "they are")} not a statement about the brand's type`);
  if (passed.unresolved) skipped.push(`${many(passed.unresolved, "font-family declaration")} ${say(passed.unresolved, "names a variable", "name variables")} this step could not follow in one step, so ${say(passed.unresolved, "it states", "they state")} no face`);
  const unroled = color.list().filter((c) => c.name.startsWith("--") && !c.role).length;
  if (unroled) skipped.push(`${many(unroled, "custom property", "custom properties")} ${say(unroled, "states a color and names no role it fills, so it belongs", "state a color and name no role they fill, so they belong")} in the report and not in the profile`);

  const statements = {
    statements: STATEMENTS,
    site,
    looked_for: [...LOOKED_FOR],
    // Counted here so the report can say it without counting again, and so
    // the two color counts stay one number apart from each other wherever
    // they are read. An owner learning that their site states two hundred
    // colors and names five of them has learned the thing this job exists to
    // tell them.
    counts: {
      mark: mark.list().length,
      color: color.list().length,
      color_filling_a_role: color.list().filter((c) => c.role).length,
      type: type.list().length,
      legal: legal.list().length,
    },
    mark: mark.list(),
    color: color.list(),
    type: type.list(),
    legal: legal.list(),
    not_found: [],
    skipped,
    // What the fetch step could not or would not take, carried through in its
    // own words. It explains a thin reading better than anything this step
    // knows: a stylesheet on somebody else's host, or a page on another host
    // under the same domain that was seen and not followed, is why a part of
    // the profile is empty, and the person reads that in the report or
    // nowhere.
    not_fetched: Array.isArray(fetched.skipped) ? fetched.skipped.map((s) => squash(s)).filter(Boolean) : [],
  };
  statements.not_found = LOOKED_FOR.filter((what) => !foundFor(what, statements).length);
  return statements;
}

/** What was found for one of the six, so that what was not found can be said
 *  in the same words it was looked for in. */
export function foundFor(what, statements) {
  if (what === LOOKED_FOR[0]) return statements.color.filter((c) => !c.name.startsWith("--"));
  if (what === LOOKED_FOR[1]) return statements.color.filter((c) => c.name.startsWith("--"));
  if (what === LOOKED_FOR[2]) return statements.type;
  if (what === LOOKED_FOR[3]) return statements.mark;
  if (what === LOOKED_FOR[4]) return statements.legal.filter((l) => l.kind === "trademark");
  if (what === LOOKED_FOR[5]) return statements.legal.filter((l) => l.kind === "copyright");
  return [];
}

/** One stylesheet, or one style block in a page, as the colors and the faces
 *  it declares. Only what is declared on :root or html is a color the site
 *  states about itself, and only a face declared for headings or for body text
 *  is a face it states. */
function readCss({ rules, where, inline }, { vars, color, type, passed }) {
  const at = (selector, name) => `${inline ? "a style block in the page, " : ""}${squash(selector).slice(0, 80)} { ${name} }`;
  for (const rule of rules) {
    const onRoot = declaresOnRoot(rule.selector);
    const roles = selectorRoles(rule.selector);
    for (const { name, value } of rule.declarations) {
      if (name.startsWith("--")) {
        if (!onRoot) continue;
        const stated = colorValue(value);
        if (!namesWhatItIs(name)) { if (stated) passed.unnamed += 1; continue; }
        if (!stated) {
          // A color written as a name is stated, and converting it would mean
          // carrying a table of names, so it is reported rather than taken:
          // preferring nothing over a half-right color is the rule here.
          passed.notColor += 1;
          passed.held.push(squash(value).toLowerCase().slice(0, 30));
          continue;
        }
        // The role is a second question and it is the one the profile turns
        // on: this name states a color, and it says which role that color
        // fills only when the name says so.
        const role = roleOf(name);
        color.add(`${name.toLowerCase()}|${value.toLowerCase()}`, {
          name, ...(role ? { role } : {}), ...stated, where, place: at(rule.selector, name),
        });
        continue;
      }
      if (name.toLowerCase() !== "font-family") continue;
      const chain = resolveStack(value, vars);
      const found = [];
      if (chain === null) {
        const face = familyOf(value);
        if (face) found.push({ face, place: at(rule.selector, "font-family") });
      } else {
        for (const link of chain) {
          const face = familyOf(link.stack);
          if (face) found.push({ face, place: `${at(rule.selector, "font-family")} through ${link.through} declared on :root` });
        }
        if (!found.length) { passed.unresolved += 1; continue; }
      }
      if (!found.length) continue;
      if (!roles.length) { passed.otherFace += 1; continue; }
      for (const { face, place } of found) {
        for (const role of roles) {
          type.add(`${role}|${face.stack.toLowerCase()}`, { role, family: face.family, stack: face.stack, where, place });
        }
      }
    }
  }
}

/** The one line the step prints. A site that states nothing says so plainly,
 *  because silence that looks like an error is the one outcome this step must
 *  not have. */
export function summarise(statements) {
  // The colors that fill a role are said on their own, because they are the
  // ones a profile can carry, and a site with two hundred palette variables
  // states two hundred colors and fills five roles. The record carries both
  // counts, so the report says the same line this one does.
  const roled = statements.counts?.color_filling_a_role ?? statements.color.filter((c) => c.role).length;
  const counted = [
    statements.mark.length ? many(statements.mark.length, "mark") : null,
    statements.color.length ? `${many(statements.color.length, "color")}${roled ? ` of which ${roled} fill${roled === 1 ? "s" : ""} a role` : ", none of which fills a role"}` : null,
    statements.type.length ? many(statements.type.length, "face") : null,
    statements.legal.length ? many(statements.legal.length, "legal line") : null,
  ].filter(Boolean);
  const total = statements.mark.length + statements.color.length + statements.type.length + statements.legal.length;
  if (!total) return `${statements.site} states nothing about itself: looked for ${LOOKED_FOR.join(", ")}, and found none of them`;
  const missing = statements.not_found.length ? `; found nothing for ${statements.not_found.join(", ")}` : "";
  return `read ${many(total, "statement")} from ${statements.site}: ${counted.join(", ")}${missing}`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  try {
    const from = trim(process.env.FETCHED);
    const out = trim(process.env.OUT);
    if (!from) refuseSettings("FETCHED is required: the record the fetch step wrote");
    if (!out) refuseSettings("OUT is required: the file to write the statements to");
    let fetched;
    try { fetched = JSON.parse(readFileSync(from, "utf8")); }
    catch (e) {
      const code = trim(e?.code);
      if (code === "ENOENT") refuse(`there is no file named ${bareName(from)} to read the fetched pages from`);
      if (code) refuse(`${bareName(from)} could not be opened: ${code}`);
      refuse(`${bareName(from)} is not JSON, so the fetched pages could not be read`);
    }
    const statements = readStatements(fetched);
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, `${JSON.stringify(statements, null, 2)}\n`);
    // Exit 0 with an empty file when the site states nothing: that is a real
    // answer and the step after this one says so in the report.
    console.log(summarise(statements));
  } catch (e) {
    if (e instanceof Refusal) { console.error(`refused: ${e.message}`); process.exit(e.settings ? 2 : 1); }
    console.error(`the statements could not be read: ${trim(e?.message) || e}`);
    process.exit(1);
  }
}
