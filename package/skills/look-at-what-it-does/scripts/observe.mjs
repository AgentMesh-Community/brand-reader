// Open each fetched page in chromium and read it twice over.
//
// FIRST, what the site's own CSS sets on its own elements, which are
// STATEMENTS and reach the profile. Five colors: the color of body text, the
// color behind it, the color of headings where it differs, the color of a link
// in running text, and the background of the main call to action. And two
// faces: the font stack on body text and the font stack on headings, which is
// the stack the site ASKS for and not the face this machine happened to have.
// The place is the meaning in all of them, so no judgment goes into placing
// them, and a browser is only a better CSS parser: it settles the cascade, the
// media queries and the specificity, and gives back what the owner declared.
// references/what-counts.md is the authority and says why the line was once
// drawn in the wrong place.
//
// SECOND, what the site DOES, which is reported and never profiled: the faces
// the pages actually rendered in after the fallbacks, the colors by the share
// of the page they cover, the contrast the site achieves between each text
// color and the ground behind it, and every place the site disagrees with
// itself. An owner who learns their site uses four blues has learned something
// worth the job on its own.
//   needs: node >= 22, the browser driver this package's lockfile names, and
//   the host's chromium (BINARY_CHROMIUM, placed by the installer from the
//   binary the package names; falls back to the driver's own)
//   FETCHED=records/<job>/fetched.json STATEMENTS=records/<job>/statements.json OUT=records/<job>/observations.json node observe.mjs
//
// Writes OUT when at least one page opened, listing beside the observations
// every page that would not. When NONE of them opens it writes nothing at all,
// says why on stderr and exits non-zero, and the job carries on with the
// statements alone: the step after this one is whole without observations, an
// observation missing is a thinner report, and an observation invented is a
// wrong profile. A half written observations file would be the third thing.
//
// WHAT IT READS. The fetch record's pages, which is its resources of kind page,
// https only and never an address carrying a credential. The statements record,
// for the one disagreement that needs it: a color the site states and no page
// shows.
//
// WHAT A PAGE READER RETURNS, which is what readPage gives back per address and
// what a test hands in place of a browser:
//   { cells, colors: [ { value, cells } ],
//     text: [ { role, family, color, ground, size_px, weight, seen } ],
//     definitional: [ { role, value, selector } ],
//     stacks: [ { role, stack, selector } ],
//     mark, copyright }
// cells is the grid the colors were counted over, so a share is cells over
// cells and never a pixel this script did not look at. definitional is the
// five colors and stacks is the two faces, each naming the element it was read
// off.
//
// No local file path is ever written into the record. It travels to the person
// and to the step after this one, and neither has any use for where this host
// keeps its work.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const OBSERVATIONS = "v1";

// The five from references/what-counts.md, which is the authority, and a sixth
// for the same shape of disagreement in a part the five do not name: two body
// faces, or two of anything else the site states twice and differently.
export const DISAGREEMENTS = [
  "more than one color in the same role",
  "more than one heading face",
  "a stated color that appears on no page",
  "a mark that differs between pages",
  "a copyright line naming a different organisation from the page",
  "more than one value stated for the same part",
];

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n) => (n < WORDS.length ? WORDS[n] : String(n));
const upper = (text) => text.replace(/^./, (c) => c.toUpperCase());
const listed = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const firstLine = (text) => String(text ?? "").split("\n")[0].trim();

/** Any sentence on its way into the record, with local filesystem paths taken
 *  out of it. A driver that is missing says so by naming the directory it
 *  looked in, which is useful on the host and is nobody's business in a record
 *  that travels. */
export function withoutPaths(text) {
  return String(text ?? "")
    .split(/\s+/)
    .map((t) => (t.includes("://") ? t : /^[A-Za-z]:[\\/]/.test(t) || t.startsWith("/") || t.includes("\\") ? "a local file" : t))
    .join(" ")
    .trim();
}

// ------------------------------------------------------------------- color

const clamp = (n) => Math.min(255, Math.max(0, Math.round(n)));

/** A color as red, green, blue and alpha, from a hex value or from an rgb()
 *  or rgba() value, which is what a computed style always gives back.
 *
 *  A named color other than transparent comes back null on purpose. Guessing
 *  which of a hundred and forty names a stylesheet meant is not this job, and a
 *  color that cannot be read is left out of the comparisons rather than
 *  compared wrongly: it is never reported as appearing on no page. */
export function parseColor(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 3 || h.length === 4) {
      const n = (i) => parseInt(h[i] + h[i], 16);
      return { r: n(0), g: n(1), b: n(2), a: h.length === 4 ? n(3) / 255 : 1 };
    }
    if (h.length === 6 || h.length === 8) {
      const n = (i) => parseInt(h.slice(i, i + 2), 16);
      return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
    }
    return null;
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(s);
  if (!fn) return null;
  const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const num = (t) => (t.endsWith("%") ? (Number.parseFloat(t) * 255) / 100 : Number.parseFloat(t));
  const [r, g, b] = parts.slice(0, 3).map(num);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  const raw = parts[3] === undefined ? 1 : parts[3].endsWith("%") ? Number.parseFloat(parts[3]) / 100 : Number.parseFloat(parts[3]);
  return { r: clamp(r), g: clamp(g), b: clamp(b), a: Number.isNaN(raw) ? 1 : Math.min(1, Math.max(0, raw)) };
}

/** The six digit hex of a color, which is how every color is named once it
 *  is in a record. Two records that mean the same color must compare equal. */
export function toHex(value) {
  const c = typeof value === "string" || value === undefined || value === null ? parseColor(value) : value;
  if (!c) return null;
  return `#${[c.r, c.g, c.b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

/** A color that is not fully opaque, laid over the ground behind it, which is
 *  what a reader of the page actually sees. */
export function over(color, ground) {
  const c = typeof color === "object" && color !== null ? color : parseColor(color);
  const g = typeof ground === "object" && ground !== null ? ground : parseColor(ground);
  if (!c) return null;
  if (c.a >= 1 || !g) return { r: c.r, g: c.g, b: c.b, a: 1 };
  const mix = (x, y) => x * c.a + y * (1 - c.a);
  return { r: mix(c.r, g.r), g: mix(c.g, g.g), b: mix(c.b, g.b), a: 1 };
}

/** Relative luminance, as WCAG 2 defines it. */
export function relativeLuminance(value) {
  const c = typeof value === "object" && value !== null ? value : parseColor(value);
  if (!c) return null;
  const f = (n) => {
    const v = clamp(n) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** The contrast ratio between a text color and the ground behind it, to two
 *  decimal places: 21 for black on white, 1 for a color on itself, 4.54 for
 *  the grey that just passes AA on white. Text that is not fully opaque is laid
 *  over its ground first. Null when either color cannot be read. */
export function contrastRatio(text, ground) {
  const g = over(ground, { r: 255, g: 255, b: 255, a: 1 });
  const t = over(text, g);
  const lt = relativeLuminance(t);
  const lg = relativeLuminance(g);
  if (lt === null || lg === null) return null;
  const [hi, lo] = lt >= lg ? [lt, lg] : [lg, lt];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const HUES = [
  [345, 360, "red"], [0, 15, "red"], [15, 45, "orange"], [45, 70, "yellow"], [70, 160, "green"],
  [160, 195, "teal"], [195, 250, "blue"], [250, 290, "purple"], [290, 345, "pink"],
];

/** What a person would call this color, or null when it is a neutral. The
 *  greys, the near whites and the near blacks are neutrals: a site using three
 *  greys is not the finding that a site using four blues is.
 *
 *  Neutral is decided on the spread between the channels and not on saturation,
 *  which climbs towards one as a color gets dark. An ink of #101317 is a black
 *  with a breath of blue in it, its saturation reads as high, and calling it a
 *  blue would put it beside the brand's actual blue in a finding that is not
 *  true. */
export function hueName(value) {
  const c = typeof value === "object" && value !== null ? value : parseColor(value);
  if (!c) return null;
  const [r, g, b] = [clamp(c.r) / 255, clamp(c.g) / 255, clamp(c.b) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.1 || max < 0.1 || min > 0.95) return null;
  let h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  const found = HUES.find(([from, to]) => h >= from && h < to);
  return found ? found[2] : null;
}

// -------------------------------------------------------- what the pages show

const pageUrl = (p) => String(p?.url ?? "");
const textOf = (p) => (Array.isArray(p?.text) ? p.text : []);
const add = (list, item) => {
  if (item && !list.includes(item)) list.push(item);
  return list;
};

/** Every color the pages paint, by the share of the page it covers, the
 *  biggest first. The share is over every cell of every page that opened, so a
 *  color on one page of five cannot read as a fifth of the site. */
export function colorShare(pages) {
  const total = pages.reduce((n, p) => n + (Number(p?.cells) || (p?.colors ?? []).reduce((m, c) => m + (Number(c.cells) || 0), 0)), 0);
  const by = new Map();
  for (const p of pages) {
    for (const c of p?.colors ?? []) {
      const hex = toHex(c.value);
      if (!hex) continue;
      const e = by.get(hex) ?? { color: hex, share: 0, cells: 0, pages: [] };
      e.cells += Number(c.cells) || 0;
      add(e.pages, pageUrl(p));
      by.set(hex, e);
    }
  }
  return [...by.values()]
    .map((e) => ({ color: e.color, share: total ? Math.round((e.cells / total) * 10000) / 10000 : 0, cells: e.cells, pages: e.pages }))
    .sort((a, b) => b.cells - a.cells || a.color.localeCompare(b.color));
}

/** The first family in a stack, without its quotes: the face, as against the
 *  stack the stylesheet asked for. */
export function firstFamily(stack) {
  return String(stack ?? "").split(",")[0].trim().replace(/^["']|["']$/g, "");
}

/** The faces the pages actually rendered in, per role, the most seen first. */
export function facesSeen(pages) {
  const roles = { heading: new Map(), body: new Map() };
  for (const p of pages) {
    for (const t of textOf(p)) {
      const role = t.role === "heading" ? "heading" : "body";
      const face = firstFamily(t.family);
      if (!face) continue;
      const e = roles[role].get(face) ?? { face, stack: String(t.family ?? ""), seen: 0, pages: [] };
      e.seen += Number(t.seen) || 1;
      add(e.pages, pageUrl(p));
      roles[role].set(face, e);
    }
  }
  const sorted = (m) => [...m.values()].sort((a, b) => b.seen - a.seen || a.face.localeCompare(b.face));
  return { heading: sorted(roles.heading), body: sorted(roles.body) };
}

/** The contrast the site achieves, one entry per text color over the ground
 *  behind it, the worst first. This is what the site achieves, and it is not
 *  the floor the brand requires. Those are two different facts and only a
 *  person can say the second. */
export function contrastsSeen(pages) {
  const by = new Map();
  for (const p of pages) {
    for (const t of textOf(p)) {
      const text = toHex(t.color);
      const ground = toHex(t.ground);
      if (!text || !ground) continue;
      const key = `${text}|${ground}`;
      const e = by.get(key) ?? { text, ground, ratio: contrastRatio(t.color, t.ground), roles: [], seen: 0, pages: [] };
      e.seen += Number(t.seen) || 1;
      add(e.roles, t.role === "heading" ? "heading" : "body");
      add(e.pages, pageUrl(p));
      by.set(key, e);
    }
  }
  return [...by.values()].sort((a, b) => (a.ratio ?? 99) - (b.ratio ?? 99) || a.text.localeCompare(b.text));
}

// ------------------------------------------- the five the site sets itself

/** The five places where the place IS the meaning, each with the property that
 *  was read off the element and the words the rule names it by. A site that
 *  sets one of these has stated it: the browser settled the cascade and gave
 *  back what the site's own CSS says, which is the owner's word however we
 *  came to read it. */
export const DEFINITIONAL = {
  ink: { says: "the color of body text", property: "color" },
  ground: { says: "the color behind body text", property: "background-color" },
  heading: { says: "the color of headings", property: "color" },
  link: { says: "the color of a link in running text", property: "color" },
  button: { says: "the background of the main call to action", property: "background-color" },
};

/**
 * The five, from the pages that opened, in the shape the statements step
 * emits: the name, the role it fills, the color, the address it was read at,
 * the place within that address, how many pages said it, and WHICH pages those
 * were.
 *
 * Deduplicated by role and color, so five pages that agree are one statement
 * seen five times, and five pages that disagree are two statements or more.
 * The step after this one carries the one more pages state and names the
 * minority, which is why the pages are listed and not only counted: a report
 * that says four pages state this and one states that has to be able to say
 * which one.
 *
 * Pure, so a test drives it from a record it made up and no browser is opened.
 */
export function statedColors(pages = []) {
  const by = new Map();
  for (const p of pages ?? []) {
    const read = (Array.isArray(p?.definitional) ? p.definitional : [])
      .filter((d) => Object.hasOwn(DEFINITIONAL, String(d?.role ?? "")));
    // A color set at less than full opacity is the color it paints over the
    // ground behind it, because that is the color of the text. A page that
    // paints no ground of its own is read over the white the browser paints.
    const ground = over(read.find((d) => d.role === "ground")?.value ?? "#ffffff", { r: 255, g: 255, b: 255, a: 1 });
    const colorOf = (value) => {
      const hex = toHex(over(value, ground));
      return hex ? hex.toUpperCase() : null;
    };
    const ink = colorOf(read.find((d) => d.role === "ink")?.value);
    for (const d of read) {
      const role = String(d.role);
      const hex = colorOf(d.value);
      if (!hex) continue;
      // A heading in the same color as body text is body text in a larger
      // size, and the site has said nothing separate about its headings.
      if (role === "heading" && hex === ink) continue;
      const found = by.get(`${role}|${hex}`);
      if (found) { found.count += 1; add(found.pages, pageUrl(p)); continue; }
      by.set(`${role}|${hex}`, {
        name: DEFINITIONAL[role].says,
        role,
        value: hex,
        hex,
        where: pageUrl(p),
        place: `${String(d.selector ?? "").trim() || "the element"} { ${DEFINITIONAL[role].property} }, as the page renders it`,
        count: 1,
        pages: add([], pageUrl(p)),
      });
    }
  }
  return { color: [...by.values()] };
}

/**
 * The heading face and the body face the pages declare, in the shape the
 * statements step emits.
 *
 * A computed font-family is the STACK the site's own CSS asks for, and not the
 * face this machine happened to have, so it is the owner's word the same way
 * the five colors are. The face the browser RESOLVED after the fallbacks is a
 * different fact, it is about the reader's machine as much as the site's, and
 * it stays where it was, in the report.
 *
 * Deduplicated by role and stack, so pages that ask for the same stack are one
 * statement, and pages that ask for different ones are two. The profile
 * carries the stack more of them ask for, and carries neither where the pages
 * are split evenly, so the pages asking for each are listed here.
 */
export function statedFaces(pages = []) {
  const by = new Map();
  for (const p of pages ?? []) {
    for (const d of Array.isArray(p?.stacks) ? p.stacks : []) {
      const role = d?.role === "heading" ? "heading" : d?.role === "body" ? "body" : null;
      const stack = String(d?.stack ?? "").replace(/\s+/g, " ").trim();
      const family = firstFamily(stack);
      if (!role || !family) continue;
      const found = by.get(`${role}|${stack.toLowerCase()}`);
      if (found) { found.count += 1; add(found.pages, pageUrl(p)); continue; }
      by.set(`${role}|${stack.toLowerCase()}`, {
        role,
        family,
        stack,
        where: pageUrl(p),
        place: `${String(d.selector ?? "").trim() || "the element"} { font-family }, as the page renders it`,
        count: 1,
        pages: add([], pageUrl(p)),
      });
    }
  }
  return { type: [...by.values()] };
}

/** Everything the pages state about themselves, in the statements record's own
 *  shape, so the step after this one places it with no special case. */
export function statedByThePages(pages = []) {
  return { ...statedColors(pages), ...statedFaces(pages) };
}

// ------------------------------------------------------- what the site states

/** What the site states, as this step needs it: the colors by the name the
 *  site gave them, the faces by role, the marks by the route that named them,
 *  and the legal lines.
 *
 *  It reads the statements as they were collected and does not map them onto
 *  the profile's fields. That mapping is the next step's, because the profile's
 *  shape is the next step's, and a value is compared here by the name the site
 *  itself used. */
export function stated(statements) {
  const s = statements && typeof statements === "object" ? statements : {};
  const list = (k) => (Array.isArray(s[k]) ? s[k] : []);
  const at = (e) => ({ url: String(e?.where ?? ""), in: e?.place ? String(e.place) : undefined, seen: Number(e?.count) || 1 });
  return {
    colors: list("color").map((c) => ({ name: String(c?.name ?? ""), value: String(c?.hex ?? c?.value ?? ""), at: at(c) })),
    // A family the site named without saying where it goes keeps a null role
    // and is not turned into a body face. A font service link names the
    // families in its address and says nothing about their use, and reading
    // that as body text would invent a second body face and then a
    // disagreement between the two.
    faces: list("type").map((t) => ({ role: t?.role === "heading" ? "heading" : t?.role === "body" ? "body" : null, family: String(t?.family ?? ""), stack: String(t?.stack ?? ""), at: at(t) })),
    marks: list("mark").map((m) => ({ route: String(m?.route ?? ""), value: String(m?.value ?? ""), at: at(m) })),
    legal: list("legal").map((l) => ({ kind: String(l?.kind ?? ""), text: String(l?.text ?? ""), at: at(l) })),
  };
}

/** The distinct values one name was stated with, when it was stated more than
 *  once and differently. The site saying a thing about itself twice is the
 *  finding; which of the two is right is the owner's to say. */
function statedTwice(entries, nameOf, valueOf) {
  const by = new Map();
  for (const e of entries) {
    const name = nameOf(e);
    const value = String(valueOf(e) ?? "");
    if (!name || !value) continue;
    const seen = by.get(name) ?? new Map();
    if (!seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), { value, url: e.at?.url });
    by.set(name, seen);
  }
  return [...by.entries()]
    .filter(([, seen]) => seen.size > 1)
    .map(([name, seen]) => ({ name, values: [...seen.values()].map((v) => v.value), where: [...new Set([...seen.values()].map((v) => v.url).filter(Boolean))] }));
}

/** The organisation a copyright line names, with the symbol, the years and the
 *  rights sentence taken off. "© 2026 Meridian Analytics. All rights reserved."
 *  names Meridian Analytics. */
export function organisationInCopyright(line) {
  let s = String(line ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  s = s.replace(/^copyright\s*/i, "").replace(/^(©|\(c\))\s*/i, "").replace(/^copyright\s*/i, "");
  // A year range is written with a hyphen, an en dash, an em dash or a minus
  // sign, depending on who typed it, so the dash is matched by what it is
  // rather than by listing the four.
  s = s.replace(/\b(19|20)\d{2}\s*(?:\p{Pd}\s*(?:(?:19|20)\d{2}|present))?\s*/giu, "");
  s = s.replace(/[.,;]?\s*all rights reserved\.?\s*$/i, "");
  s = s.replace(/^[\s.,;-]+|[\s.,;-]+$/g, "");
  return s || null;
}

const plainName = (name) => String(name ?? "").toLowerCase().replace(/[®™]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Whether two organisation names are the same organisation, allowing for one
 *  carrying a trademark symbol, a suffix, or a shorter form of the other. */
export function sameOrganisation(a, b) {
  const [x, y] = [plainName(a), plainName(b)];
  if (!x || !y) return true;
  return x === y || x.includes(y) || y.includes(x);
}

/** Every place the site disagrees with itself, which is the part of this step
 *  an owner actually wants. Nothing here is resolved: four blues are reported
 *  as four blues, because choosing one would be a brand decision made silently,
 *  on evidence the owner never sees. */
export function disagreements({ pages = [], statements = {} } = {}) {
  const found = [];
  const said = stated(statements);
  const shares = colorShare(pages);
  const faces = facesSeen(pages);
  const say = (what, role, values, where, says) => found.push({ what, ...(role ? { role } : {}), values, where: [...where].sort(), says });

  // The site says a thing about itself twice and differently. Which kind of
  // disagreement that is depends on what it was saying.
  for (const c of statedTwice(said.colors, (e) => e.name, (e) => e.value)) {
    say(DISAGREEMENTS[0], c.name, c.values, c.where, `The site states ${count(c.values.length)} colors for ${c.name}: ${listed(c.values)}.`);
  }
  // By the face and not by the whole stack: two declarations that ask for the
  // same face behind different fallbacks are one face, and the finding this
  // names is more than one face. A family with no role is not compared at all,
  // because a site that names a family without saying where it goes has not
  // said anything a second family could disagree with.
  for (const f of statedTwice(said.faces.filter((e) => e.role), (e) => e.role, (e) => firstFamily(e.family || e.stack))) {
    const what = f.name === "heading" ? DISAGREEMENTS[1] : DISAGREEMENTS[5];
    say(what, `${f.name} face`, f.values, f.where, `The stylesheets declare ${count(f.values.length)} faces for ${f.name} text: ${listed(f.values)}.`);
  }
  for (const m of statedTwice(said.marks, (e) => e.route, (e) => e.value)) {
    say(DISAGREEMENTS[3], m.name, m.values, m.where, `The site names ${count(m.values.length)} different images as its mark by the same route, ${m.name}: ${listed(m.values)}.`);
  }

  // Four blues across five pages. Every color the pages show, grouped by what
  // a person would call it, and a group holding more than one is the finding.
  const seen = new Map();
  for (const c of shares) seen.set(c.color, { color: c.color, pages: [...c.pages] });
  for (const p of pages) {
    for (const t of textOf(p)) {
      for (const v of [t.color, t.ground]) {
        const hex = toHex(v);
        if (!hex) continue;
        const e = seen.get(hex) ?? { color: hex, pages: [] };
        add(e.pages, pageUrl(p));
        seen.set(hex, e);
      }
    }
  }
  const byHue = new Map();
  for (const c of seen.values()) {
    const hue = hueName(c.color);
    if (!hue) continue;
    byHue.set(hue, [...(byHue.get(hue) ?? []), c]);
  }
  for (const [hue, colors] of byHue) {
    if (colors.length < 2) continue;
    const values = colors.map((c) => c.color).sort();
    const where = [...new Set(colors.flatMap((c) => c.pages))];
    say(DISAGREEMENTS[0], hue, values, where,
      `${upper(count(colors.length))} ${hue}s are used across the ${count(pages.length)} pages that were opened: ${listed(values)}.`);
  }

  // A color the site states and no page shows. A color this cannot read is
  // not checked at all, rather than reported as appearing nowhere.
  const shown = new Set(seen.keys());
  for (const c of said.colors) {
    const hex = toHex(c.value);
    if (!hex || shown.has(hex)) continue;
    say(DISAGREEMENTS[2], c.name, [c.value], [c.at.url].filter(Boolean),
      `The site states ${c.value} for ${c.name} and none of the ${count(pages.length)} pages that were opened shows it.`);
  }

  // More than one heading face, as the pages rendered them.
  if (faces.heading.length > 1) {
    const values = faces.heading.map((f) => f.face);
    say(DISAGREEMENTS[1], "heading", values, [...new Set(faces.heading.flatMap((f) => f.pages))],
      `Headings render in ${count(values.length)} faces across the pages that were opened: ${listed(values)}.`);
  }

  // A mark that differs between pages.
  const marks = new Map();
  for (const p of pages) {
    if (!p?.mark) continue;
    marks.set(String(p.mark), add(marks.get(String(p.mark)) ?? [], pageUrl(p)));
  }
  if (marks.size > 1) {
    say(DISAGREEMENTS[3], "logo.mark", [...marks.keys()], [...new Set([...marks.values()].flat())],
      `The pages carry ${count(marks.size)} different marks: ${listed([...marks.keys()])}.`);
  }

  // A copyright line naming a different organisation from the one the page
  // names, and pages that do not agree with each other on it. The organisation
  // the page names is the trademark on its first mention, which is the only
  // place the site says its own name in its own words.
  const named = said.legal.find((l) => l.kind === "trademark") ?? null;
  const orgs = new Map();
  for (const p of pages) {
    const org = organisationInCopyright(p?.copyright);
    if (!org) continue;
    orgs.set(org, add(orgs.get(org) ?? [], pageUrl(p)));
  }
  for (const l of said.legal) {
    if (l.kind !== "copyright") continue;
    const org = organisationInCopyright(l.text);
    if (org) orgs.set(org, add(orgs.get(org) ?? [], l.at.url));
  }
  if (named) {
    for (const [org, where] of orgs) {
      if (sameOrganisation(org, named.text)) continue;
      say(DISAGREEMENTS[4], "the copyright line", [org, named.text], where,
        `The copyright line names ${org} and the page names itself ${named.text}.`);
    }
  }
  if (orgs.size > 1) {
    say(DISAGREEMENTS[4], "the copyright line", [...orgs.keys()], [...new Set([...orgs.values()].flat())],
      `The pages do not agree on the organisation in the copyright line: ${listed([...orgs.keys()])}.`);
  }
  return found;
}

// ----------------------------------------------------------------- the step

const pageRecord = (url, r) => ({
  url,
  cells: Number(r?.cells) || 0,
  colors: (r?.colors ?? []).map((c) => ({ value: String(c.value), cells: Number(c.cells) || 0 })),
  text: textOf(r).map((t) => ({
    role: t.role === "heading" ? "heading" : "body",
    family: String(t.family ?? ""),
    color: String(t.color ?? ""),
    ground: String(t.ground ?? ""),
    size_px: Number(t.size_px) || 0,
    weight: String(t.weight ?? ""),
    seen: Number(t.seen) || 1,
  })),
  definitional: (Array.isArray(r?.definitional) ? r.definitional : []).map((d) => ({
    role: String(d?.role ?? ""),
    value: String(d?.value ?? ""),
    selector: String(d?.selector ?? ""),
  })),
  stacks: (Array.isArray(r?.stacks) ? r.stacks : []).map((d) => ({
    role: String(d?.role ?? ""),
    stack: String(d?.stack ?? ""),
    selector: String(d?.selector ?? ""),
  })),
  mark: r?.mark ? String(r.mark) : null,
  copyright: r?.copyright ? String(r.copyright) : null,
});

/** Open every address with the page reader it is given and record what came
 *  back.
 *
 *  The reader is a parameter so that a test can drive this without a browser,
 *  and so that a host without one still gets an honest answer: a page that will
 *  not open is named with the reason, and a run where none opened says so and
 *  carries no observations at all, which is what the caller writes nothing for.
 *  Nothing here is ever filled in from what the other pages showed. */
export async function observe({ addresses = [], statements = {}, readPage, now = () => new Date() } = {}) {
  const pages = [];
  const notOpened = [];
  for (const url of addresses) {
    try {
      const r = await readPage(url);
      if (!r) throw new Error("the page gave nothing back");
      pages.push(pageRecord(url, r));
    } catch (e) {
      notOpened.push({ url, why: withoutPaths(firstLine(e?.message ?? e)) });
    }
  }
  const opened = pages.length > 0;
  const record = {
    observations: OBSERVATIONS,
    observed_at: now().toISOString(),
    opened,
    pages,
    not_opened: notOpened,
    // The one part of this record that reaches the profile, in the shape the
    // statements step emits, because it is the same kind of thing: what the
    // site's own CSS sets on the site's own elements.
    statements: opened ? statedByThePages(pages) : { color: [], type: [] },
    colors: opened ? colorShare(pages) : [],
    faces: opened ? facesSeen(pages) : { heading: [], body: [] },
    contrast: opened ? contrastsSeen(pages) : [],
    disagreements: opened ? disagreements({ pages, statements }) : [],
  };
  if (!opened) record.why = notOpened.length ? notOpened[0].why : "there was no page to open";
  return record;
}

/** The pages to open, from the fetch record: its resources of kind page, https
 *  only, never an address carrying a credential, and never a stylesheet or a
 *  web app manifest. */
export function pagesFromFetched(fetched) {
  const list = Array.isArray(fetched) ? fetched
    : Array.isArray(fetched?.resources) ? fetched.resources.filter((r) => (typeof r === "string" ? true : (r?.kind ?? "page") === "page"))
    : fetched?.pages ?? [];
  const out = [];
  for (const p of list) {
    const url = typeof p === "string" ? p : p?.address ?? p?.url ?? null;
    if (!url) continue;
    const type = typeof p === "object" && p !== null ? String(p.media_type ?? p.content_type ?? "") : "";
    if (type && !/html/i.test(type)) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" || u.username || u.password) continue;
      add(out, u.href);
    } catch {
      continue;
    }
  }
  return out;
}

// -------------------------------------------------------------- the browser

/** The browser driver, from where the host installed it.
 *
 *  A bare import would make node look for a node_modules inside the package,
 *  and a package carrying its own node_modules is one whose dependencies nobody
 *  verified. The host installs from the lockfile beside this script into a
 *  directory of its own, named after that lockfile's digest, and puts the root
 *  of those directories in AGENT_DEPS. With no AGENT_DEPS the answer is the
 *  node_modules beside this script, which is what an image has. Those are the
 *  only two places, and a plain require would quietly load whatever version the
 *  machine happened to have instead. */
function driver(name, env = process.env) {
  const here = dirname(fileURLToPath(import.meta.url));
  const lock = join(here, "package-lock.json");
  const from = env.AGENT_DEPS && existsSync(lock)
    ? join(env.AGENT_DEPS, createHash("sha256").update(readFileSync(lock)).digest("hex"))
    : here;
  if (!existsSync(join(from, "node_modules", ...name.split("/")))) {
    throw new Error("the browser driver this package's lockfile names is not installed on this host, so the pages cannot be opened");
  }
  return createRequire(pathToFileURL(join(from, "package.json")).href)(name);
}

/** What the browser reads off a rendered page. It runs inside the page, so it
 *  stands alone and reaches nothing out here.
 *
 *  The colors are counted over a coarse grid rather than off the pixels: every
 *  element that paints an opaque background fills its cells in document order,
 *  so a child covers its parent the way it does on screen, and a color's share
 *  is its cells over all of them. It is an approximation, and it is an honest
 *  one, which a color sampled out of a screenshot would not be. */
export const READ_RENDERED = () => {
  const COLS = 96, ROWS = 64, CAP = 4000;
  const opaque = (c) => {
    const m = /^rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return false;
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    return p.length < 4 || Number(p[3]) >= 0.95;
  };
  const doc = document.documentElement;
  const w = Math.max(doc.scrollWidth, window.innerWidth, 1);
  const h = Math.max(doc.scrollHeight, window.innerHeight, 1);
  // The ground the page paints, and which element paints it. A page that
  // paints neither on body nor on html has stated no ground: the white left
  // here is the browser's white, and it is used for the grid and never
  // written down as something the site said.
  let rootBg = "rgb(255, 255, 255)";
  let groundFrom = null;
  for (const el of [document.body, doc]) {
    const c = el ? getComputedStyle(el).backgroundColor : null;
    if (c && opaque(c)) { rootBg = c; groundFrom = el === doc ? "html" : "body"; break; }
  }
  const grid = new Array(COLS * ROWS).fill(rootBg);
  const shown = (s) => s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) >= 0.1;
  for (const el of [...document.querySelectorAll("body *")].slice(0, CAP)) {
    const s = getComputedStyle(el);
    if (!shown(s) || !opaque(s.backgroundColor)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const x0 = Math.max(0, Math.floor(((r.left + window.scrollX) / w) * COLS));
    const x1 = Math.min(COLS, Math.ceil(((r.right + window.scrollX) / w) * COLS));
    const y0 = Math.max(0, Math.floor(((r.top + window.scrollY) / h) * ROWS));
    const y1 = Math.min(ROWS, Math.ceil(((r.bottom + window.scrollY) / h) * ROWS));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) grid[y * COLS + x] = s.backgroundColor;
  }
  const tally = {};
  for (const c of grid) tally[c] = (tally[c] || 0) + 1;
  const groundOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (opaque(c)) return c;
    }
    return rootBg;
  };
  const text = {};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node, read = 0;
  while ((node = walker.nextNode()) && read < CAP) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const el = node.parentElement;
    if (!el) continue;
    const s = getComputedStyle(el);
    if (!shown(s)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    read++;
    const entry = {
      role: el.closest("h1,h2,h3,h4,h5,h6,[role=heading]") ? "heading" : "body",
      family: s.fontFamily,
      color: s.color,
      ground: groundOf(el),
      size_px: Math.round(Number.parseFloat(s.fontSize) || 0),
      weight: String(s.fontWeight),
    };
    const key = Object.values(entry).join("|");
    if (!text[key]) text[key] = { ...entry, seen: 0 };
    text[key].seen++;
  }
  // The five places where the place is the meaning. What the site's own CSS
  // sets on its own elements is the owner's word, and this is only where it is
  // read: the cascade settles these and a browser is what settles the cascade.
  // Each one names the element it came off, so a person can open the page and
  // check it.
  const definitional = [];
  const set = (role, value, selector) => { if (value) definitional.push({ role, value, selector }); };
  if (document.body) set("ink", getComputedStyle(document.body).color, "body");
  if (groundFrom) set("ground", rootBg, groundFrom);
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (!shown(s)) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  };
  const words = (el) => String(el.textContent || el.value || "").trim();
  const first = (selector, ok) => {
    for (const el of [...document.querySelectorAll(selector)].slice(0, CAP)) {
      if (!words(el) || !visible(el) || (ok && !ok(el))) continue;
      return el;
    }
    return null;
  };
  // On the page's own ground, so that a heading inside a dark band is read as
  // that band's color and not as the color of the brand's headings.
  const onGround = (el) => groundOf(el) === rootBg;
  const heading = first("h1", onGround) || first("h2", onGround);
  // Reported as it was read. A heading in the same color as body text says
  // nothing separate about headings, and the step that collects these drops it.
  if (heading) set("heading", getComputedStyle(heading).color, heading.tagName.toLowerCase());
  const chrome = (el) => !!el.closest('nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]');
  // Running text is words with a link among them, so the test is words BESIDE
  // the link in its own element. A link alone in its wrapper is a button or a
  // card, whatever the tag says, and a marketing page is mostly those. Asking
  // for a <p> instead would have been simpler and would have found nothing on
  // a site that writes its text in divs, which is most of them.
  const beside = (el) => [...(el.parentElement?.childNodes ?? [])].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim().length;
  const link = first("a[href]", (el) => !chrome(el) && beside(el) >= 20 && onGround(el));
  if (link) set("link", getComputedStyle(link).color, `${link.parentElement.tagName.toLowerCase()} a`);
  // The first call to action a reader meets that paints a background of its
  // own. Big enough to carry words, so an icon control with a background is
  // not read as the button, and never one inside a dialog.
  const cta = first('button, [role="button"], input[type="submit"], input[type="button"], a[class*="btn" i], a[class*="button" i], a[class*="cta" i]', (el) => {
    if (el.closest('dialog, [role="dialog"], [aria-modal="true"]')) return false;
    const s = getComputedStyle(el);
    if (!opaque(s.backgroundColor) || s.backgroundColor === rootBg) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 60 && r.height >= 24;
  });
  if (cta) set("button", getComputedStyle(cta).backgroundColor, cta.tagName.toLowerCase());
  // The two faces, on the same footing as the five colors. A computed
  // font-family is the STACK the site's own CSS asks for, not the face this
  // machine happened to have, so it is the owner's word and not a fact about
  // the reader. The heading here is the first one on the page, whatever ground
  // it sits on, because a band changes a color and not a face.
  const stacks = [];
  const asks = (role, stack, selector) => { if (stack) stacks.push({ role, stack, selector }); };
  if (document.body) asks("body", getComputedStyle(document.body).fontFamily, "body");
  const titled = first("h1") || first("h2");
  if (titled) asks("heading", getComputedStyle(titled).fontFamily, titled.tagName.toLowerCase());
  const markEl = document.querySelector('header a[href="/"] img, header img[alt*="logo" i], header img[class*="logo" i], header img[id*="logo" i], [itemprop="logo"], img[class*="logo" i]');
  const mark = markEl ? markEl.currentSrc || markEl.getAttribute("src") || markEl.getAttribute("content") || null : null;
  let copyright = null;
  for (const el of [...document.querySelectorAll("footer *, footer, body *")].slice(0, CAP)) {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 300) continue;
    if (/(©|\(c\)|copyright)/i.test(t)) { copyright = t; break; }
  }
  return { cells: grid.length, colors: Object.entries(tally).map(([value, cells]) => ({ value, cells })), text: Object.values(text), definitional, stacks, mark, copyright };
};

// How long each of the three waits gets. The first is the navigation, which is
// the one a page can genuinely fail. The second is the paint, which is allowed
// to run out without costing the page. The third is the settle after it.
export const OPEN_MS = 45_000;
export const PAINT_MS = 6_000;
export const SETTLE_MS = 900;

/** What this step waits for, which is the page PAINTED and not the network
 *  quiet: a ground painted on the body or on html, and a heading. Those are
 *  what every reading below is taken off, so they are what the wait is for.
 *
 *  It runs inside the page, so it stands alone and reaches nothing out here. */
export const PAINTED = () => {
  const opaque = (c) => {
    const m = /^rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return false;
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    return p.length < 4 || Number(p[3]) >= 0.95;
  };
  if (!document.body) return false;
  const ground = [document.body, document.documentElement]
    .some((el) => el && opaque(getComputedStyle(el).backgroundColor));
  return !!(ground && document.querySelector("h1, h2"));
};

/**
 * One page, open and painted and ready to read.
 *
 * WHY NOT networkidle. It waits for the network to go quiet, and a marketing
 * page never does: analytics, an embedded video and a chat widget hold
 * connections open for as long as the page is open. The wait then ran to its
 * timeout and the page was written down as one that WOULD NOT OPEN, when it had
 * rendered perfectly well and every color and face this step reads was sitting
 * there. One page of langchain.com's blog cost a whole run its five colors and
 * both faces that way, and the pages worth reading a brand from are exactly the
 * pages that behave like that.
 *
 * So the navigation waits for the document and nothing more, and then the wait
 * is for the thing this step actually depends on: the page painted. That wait
 * is allowed to run out. A page that paints no ground of its own has stated
 * none, which is a reading in itself, and a page with no heading has no
 * heading. Losing the page over either would be the same mistake in a smaller
 * coat.
 *
 * Exported so a test can drive it with a page of its own making and no browser.
 */
export async function untilPainted(page, url, { timeout = OPEN_MS, paint = PAINT_MS, settle = SETTLE_MS } = {}) {
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  if (res && !res.ok()) throw new Error(`the page answered ${res.status()}`);
  try {
    await page.waitForFunction(PAINTED, null, { timeout: paint });
  } catch {
    // Painted enough to read, or never going to be. Either way it is read as
    // it stands, and what it did not paint it did not state.
  }
  await page.waitForTimeout(settle);
  return page;
}

/** A page reader that opens addresses in the host's chromium: one browser for
 *  the whole run, one page per address, closed as it goes. A page that will not
 *  open costs its own waits and nothing else: the caller writes it down with
 *  the reason and the pages that did open still count. */
export function chromiumReader({ env = process.env, timeout = OPEN_MS, paint = PAINT_MS, settle = SETTLE_MS, viewport = { width: 1440, height: 900 } } = {}) {
  const { chromium } = driver("playwright-core", env);
  let browser = null;
  const readPage = async (url) => {
    if (!browser) browser = await chromium.launch({ ...(env.BINARY_CHROMIUM ? { executablePath: env.BINARY_CHROMIUM } : {}), args: ["--disable-dev-shm-usage"] });
    const page = await browser.newPage({ viewport });
    try {
      await untilPainted(page, url, { timeout, paint, settle });
      return await page.evaluate(READ_RENDERED);
    } finally {
      await page.close();
    }
  };
  return { readPage, close: async () => { if (browser) await browser.close(); browser = null; } };
}

/** A picture of one address, as the browser renders it, for the step that
 *  chooses which of the declared colors is the primary and which is the accent.
 *  It is here because the browser is here, and it is reached exactly the way
 *  the page reader reaches it, so a host without a browser fails the same way
 *  in both steps and the job carries on both times.
 *
 *  The picture is the WINDOW and never the whole page. A window is what a
 *  reader meets, and a picture of a page ten windows long shrinks the part they
 *  actually see to a strip at the top.
 *
 *  Nothing is ever read off the picture. It is looked at for salience, which is
 *  a question about which color carries the page, and every value the profile
 *  carries is read off the elements instead. references/what-counts.md says
 *  why, under what a picture is for. */
export function chromiumShot({ env = process.env, timeout = OPEN_MS, paint = PAINT_MS, settle = SETTLE_MS, viewport = { width: 1440, height: 900 } } = {}) {
  const { chromium } = driver("playwright-core", env);
  let browser = null;
  const shoot = async (url) => {
    if (!browser) browser = await chromium.launch({ ...(env.BINARY_CHROMIUM ? { executablePath: env.BINARY_CHROMIUM } : {}), args: ["--disable-dev-shm-usage"] });
    const page = await browser.newPage({ viewport });
    try {
      await untilPainted(page, url, { timeout, paint, settle });
      return await page.screenshot({ type: "png" });
    } finally {
      await page.close();
    }
  };
  return { shoot, close: async () => { if (browser) await browser.close(); browser = null; } };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const { FETCHED, STATEMENTS, OUT } = process.env;
  if (!FETCHED || !STATEMENTS || !OUT) { console.error("refused: FETCHED, STATEMENTS and OUT are required"); process.exit(2); }
  const read = (file, what) => {
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      console.error(`refused: the ${what} could not be read as the step before it wrote it`);
      process.exit(1);
    }
  };
  const addresses = pagesFromFetched(read(FETCHED, "fetch record"));
  const statements = read(STATEMENTS, "statements record");
  if (!addresses.length) { console.error("refused: the fetch record names no page to open"); process.exit(1); }

  // The browser is a page reader like any other here. When it will not start,
  // the reader that refuses every address stands in for it, so the run ends
  // with the same honest record either way and the job carries on with the
  // statements alone.
  let reader;
  try {
    reader = chromiumReader();
  } catch (e) {
    reader = { readPage: async () => { throw e; }, close: async () => {} };
  }
  const record = await observe({ addresses, statements, readPage: reader.readPage });
  await reader.close();
  if (!record.opened) {
    // Nothing to write. An observations file holding no observations would be
    // read by the step after this one as a site that renders nothing, and the
    // step after this one is whole without one.
    console.error(`refused: none of the ${addresses.length} pages would open, so nothing was observed and the profile is written from the statements alone: ${record.why}`);
    process.exit(1);
  }
  writeFileSync(OUT, JSON.stringify(record, null, 2) + "\n");
  const short = record.not_opened.length ? `, and ${record.not_opened.length} that would not open` : "";
  const colors = record.statements.color.length;
  const faces = record.statements.type.length;
  console.log(`${record.pages.length} pages opened${short}: the pages set ${colors} ${colors === 1 ? "color" : "colors"} and ask for ${faces} ${faces === 1 ? "face" : "faces"} on their own elements; ${record.colors.length} colors by the share they cover, ${record.faces.heading.length} heading faces rendered, ${record.contrast.length} pairings of text and ground, ${record.disagreements.length} disagreements. Observations at ${OUT}`);
}
