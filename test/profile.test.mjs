// The draft profile, and the report beside it.
//
// What is worth pinning: the profile carries STATEMENTS ALONE, whether they
// came from a stylesheet, from the manifest or from what the pages set on
// their own elements; nothing that was only observed reaches it; a part with no
// statement behind it is ABSENT rather than null or defaulted; every value in
// it carries where it was seen; a part the site states twice and differently is
// left out and reported rather than chosen between; a run with no browser says
// which five colors the profile went without; the report names, in this order,
// what was found, what was only observed, what no website carries, and where
// the site disagrees with itself; and a site that states nothing gets the
// report alone.
// Run: node --test test/profile.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PARTS, TYPED_BY_A_PERSON, buildProfile, hostOf, placeStatements, report } from "../scripts/profile.mjs";
import { roleOf } from "../scripts/statements.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "profile.mjs");

const SITE = "https://meridian.example.com/";
const CSS = "https://meridian.example.com/a.css";
const at = (where, place, count = 1) => ({ where, place, count });

/** A statements record as the step before this one writes it: grouped by what
 *  was looked for, each entry carrying the address, the place within it and how
 *  many times it was seen. */
function statements(over = {}) {
  return {
    statements: "v1",
    site: SITE,
    looked_for: [
      "the theme color", "the custom properties whose names say what they are",
      "the font families the stylesheets name", "the mark the site names as its own",
      "the trademark on first mention", "the copyright line",
    ],
    mark: [{ value: "https://meridian.example.com/brand/mark.svg", route: "organisation-record", ...at(SITE, 'script type="application/ld+json", the Organization logo', 2) }],
    color: [
      { name: "theme_color", role: "theme", value: "#1f6feb", hex: "#1F6FEB", ...at("https://meridian.example.com/site.webmanifest", "theme_color in the web app manifest") },
      { name: "--color-primary", role: "primary", value: "#1f6feb", hex: "#1F6FEB", ...at(CSS, ":root { --color-primary }", 4) },
      { name: "--ink", role: "ink", value: "#101317", hex: "#101317", ...at(CSS, ":root { --ink }") },
    ],
    type: [
      { role: "heading", family: "Space Grotesk", stack: '"Space Grotesk", system-ui, sans-serif', ...at(CSS, "h1, h2 { font-family }", 3) },
      { role: "body", family: "IBM Plex Sans", stack: '"IBM Plex Sans", system-ui, sans-serif', ...at(CSS, "body { font-family }") },
    ],
    legal: [{ kind: "copyright", text: "© 2026 Meridian Analytics. All rights reserved.", ...at(SITE, "the footer", 5) }],
    not_found: ["the trademark on first mention"],
    skipped: ["three pages name a favicon, which is a browser tab icon and not the mark"],
    ...over,
  };
}

const NOTHING = { statements: "v1", site: SITE, looked_for: statements().looked_for, mark: [], color: [], type: [], legal: [], not_found: statements().looked_for, skipped: [] };
const build = (record = statements()) => buildProfile({ statements: record, now: () => new Date("2026-09-12T10:00:00Z") });
const written = (built) => report({ statements: statements(), built, observations: null, now: () => new Date("2026-09-12T10:00:00Z") });

/** Every value in the profile, by the dotted path it sits at, without the
 *  frame the profile carries about itself. */
function leaves(node, prefix = "") {
  if (node === null || typeof node !== "object" || Array.isArray(node)) return [[prefix, node]];
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}
const values = (profile) => leaves(profile).filter(([p]) => !["brand_profile", "updated", "adopted"].includes(p) && !p.startsWith("evidence."));

test("the profile is built from the statements alone, and is whole with no observations", () => {
  const built = build();
  assert.deepEqual(built.profile.palette, { ink: "#101317", primary: "#1F6FEB", theme: "#1F6FEB" });
  assert.deepEqual(built.profile.type.heading, { family: "Space Grotesk", fallback: "system-ui, sans-serif" });
  assert.deepEqual(built.profile.logo.mark, { href: "https://meridian.example.com/brand/mark.svg" });
  assert.equal(built.profile.legal.footer, "© 2026 Meridian Analytics. All rights reserved.");
  assert.equal(built.profile.owner, "meridian.example.com");
  assert.equal(built.profile.brand_profile, "v1");
  assert.equal(built.profile.updated, "2026-09-12");
  assert.equal(built.profile.adopted, false, "nobody has vouched for it");

  // The same profile, with no observations record at all and with one that says
  // the pages would not open. Nothing observed was ever going to reach it.
  const text = written(built);
  const shut = report({ statements: statements(), built, observations: { opened: false, why: "chromium would not start" }, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /The pages were not opened, so there is nothing here\./);
  assert.match(shut, /The reason given was: chromium would not start\./);
  assert.match(text, /Nothing that was only observed would have gone in it either way\./);
  assert.equal(hostOf(SITE), "meridian.example.com");
});

test("a part with no statement behind it is absent, not null and not defaulted", () => {
  const built = build();
  assert.ok(!("accent" in built.profile.palette), "a color nobody stated is not in the palette");
  assert.ok(!("ground" in built.profile.palette));
  assert.ok(!("on_primary" in built.profile.palette));
  assert.ok(!("mono" in built.profile.type), "a mono face the site never mentions is absent, and never null");
  assert.ok(!("weight" in built.profile.type.heading));
  assert.ok(!("media_type" in built.profile.logo.mark));
  assert.ok(!("name" in built.profile), "the site never says its own name in a place whose purpose is to say it");
  assert.ok(!("first_mention" in built.profile.legal));
  assert.ok(!("voice" in built.profile) && !("words" in built.profile));
  assert.ok(!("contrast_floor" in built.profile.palette), "the floor a brand requires is not the contrast a site achieves");
  assert.ok(!("never" in built.profile.logo) && !("min_width_px" in built.profile.logo));
  assert.ok(!JSON.stringify(built.profile).includes("null"), "nothing in the profile is null");

  assert.deepEqual(built.missing.map((p) => p.path), [
    "name", "palette.ground", "palette.heading", "palette.link", "palette.button",
    "palette.on_primary", "palette.accent", "type.mono", "legal.first_mention",
  ]);

  // A site that states one thing gets a profile with one thing in it.
  const one = buildProfile({ statements: { ...NOTHING, color: [{ name: "--ink", role: "ink", value: "#101317", hex: "#101317", ...at(CSS, ":root { --ink }") }] }, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.deepEqual(one.profile.palette, { ink: "#101317" });
  assert.ok(!("type" in one.profile) && !("logo" in one.profile) && !("legal" in one.profile), "an empty block is not written either");
});

test("every value in the profile carries where it was seen", () => {
  const built = build();
  const evidence = built.profile.evidence;
  for (const [path] of values(built.profile)) {
    assert.ok(Array.isArray(evidence[path]) && evidence[path].length, `${path} is in the profile with no evidence behind it`);
    for (const e of evidence[path]) {
      assert.ok(e.url, `${path} names no address it was seen at`);
      assert.ok(!/^[A-Za-z]:[\\/]/.test(e.url) && !e.url.startsWith("/"), `${path} names a path on this host`);
    }
  }
  assert.deepEqual(evidence["palette.primary"], [{ url: CSS, in: ":root { --color-primary }", seen: 4 }]);
  assert.deepEqual(evidence["type.heading.family"], [{ url: CSS, in: "h1, h2 { font-family }", seen: 3 }]);
  assert.deepEqual(evidence["logo.mark.href"], [{ url: SITE, in: 'script type="application/ld+json", the Organization logo', seen: 2 }]);
  assert.deepEqual(evidence.owner, [{ url: SITE, in: "the domain the job was given, and claimed as its own" }]);
  assert.equal(Object.keys(evidence).length, values(built.profile).length);

  // The same color stated in two places carries both.
  const twice = build(statements({
    color: [
      { name: "--color-primary", role: "primary", value: "#1f6feb", hex: "#1F6FEB", ...at(CSS, ":root { --color-primary }", 4) },
      { name: "--brand-primary", role: "primary", value: "#1f6feb", hex: "#1F6FEB", ...at("https://meridian.example.com/b.css", ":root { --brand-primary }") },
    ],
  }));
  assert.equal(twice.profile.palette.primary, "#1F6FEB");
  assert.equal(twice.profile.evidence["palette.primary"].length, 2);
});

/** The observations record, as the browser step writes it: the five colors the
 *  pages set on their own elements, and beside them everything that was only
 *  observed. Each statement names the pages it was read off as well as how many
 *  there were, because the step after it counts them and names the minority. */
const PAGE = (n) => (n === 0 ? SITE : `https://meridian.example.com/p${n}`);
const onPages = (n) => Array.from({ length: n }, (_, i) => PAGE(i));
function readOffThePages(over = {}) {
  return {
    observations: "v1",
    opened: true,
    pages: [{ url: SITE }],
    not_opened: [],
    statements: {
      color: [
        { name: "the color of body text", role: "ink", value: "#101317", hex: "#101317", where: SITE, place: "body { color }, as the page renders it", count: 5, pages: onPages(5) },
        { name: "the color behind body text", role: "ground", value: "#FFFFFF", hex: "#FFFFFF", where: SITE, place: "body { background-color }, as the page renders it", count: 5, pages: onPages(5) },
        { name: "the color of headings", role: "heading", value: "#0B5CD5", hex: "#0B5CD5", where: SITE, place: "h1 { color }, as the page renders it", count: 3, pages: onPages(3) },
        { name: "the color of a link in running text", role: "link", value: "#1F6FEB", hex: "#1F6FEB", where: SITE, place: "p a { color }, as the page renders it", count: 2, pages: onPages(2) },
        { name: "the background of the main call to action", role: "button", value: "#1F6FEB", hex: "#1F6FEB", where: SITE, place: "button { background-color }, as the page renders it", count: 4, pages: onPages(4) },
      ],
      type: [
        { role: "body", family: "IBM Plex Sans", stack: '"IBM Plex Sans", system-ui, sans-serif', where: SITE, place: "body { font-family }, as the page renders it", count: 5, pages: onPages(5) },
      ],
    },
    colors: [],
    faces: { heading: [], body: [] },
    contrast: [],
    disagreements: [],
    ...over,
  };
}

test("the five a site sets on its own elements reach the profile like any other statement", () => {
  const seen = readOffThePages();
  const built = buildProfile({ statements: statements(), observations: seen, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.deepEqual(built.profile.palette, {
    ink: "#101317", ground: "#FFFFFF", heading: "#0B5CD5", link: "#1F6FEB", button: "#1F6FEB",
    primary: "#1F6FEB", theme: "#1F6FEB",
  });

  // The ink the stylesheet declares and the ink the page renders are one value
  // said in two places, and the evidence carries both.
  assert.deepEqual(built.profile.evidence["palette.ink"], [
    { url: CSS, in: ":root { --ink }" },
    { url: SITE, in: "body { color }, as the page renders it", seen: 5 },
  ]);
  assert.deepEqual(built.profile.evidence["palette.heading"], [{ url: SITE, in: "h1 { color }, as the page renders it", seen: 3 }]);
  assert.ok(!built.missing.some((p) => p.path === "palette.ink" || p.path === "palette.heading"));

  // A font stack the page asks for is placed the same way, and the body face
  // here was read off the page rather than out of a stylesheet.
  assert.deepEqual(built.profile.type.body, { family: "IBM Plex Sans", fallback: "system-ui, sans-serif" });
  assert.deepEqual(built.profile.evidence["type.body.family"], [
    { url: CSS, in: "body { font-family }" },
    { url: SITE, in: "body { font-family }, as the page renders it", seen: 5 },
  ]);

  const text = report({ statements: statements(), built, observations: seen, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /- The color of headings, `palette\.heading`: `#0B5CD5`\. Seen at https:\/\/meridian\.example\.com\/ in h1 \{ color \}, as the page renders it, three times\./);
  assert.match(text, /- The background of the main call to action, `palette\.button`: `#1F6FEB`\./);

  // The stylesheet and the page saying different things is the site saying two
  // things, and the rule for that is the rule for every other part: the value
  // more of them state is carried, and the other one is named.
  const argues = readOffThePages({ statements: { color: [{ ...seen.statements.color[0], value: "#333333", hex: "#333333" }] } });
  const two = buildProfile({ statements: statements(), observations: argues, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.equal(two.profile.palette.ink, "#333333", "five pages against one stylesheet line is five against one");
  assert.deepEqual(two.contested, [], "and nothing is contested, because nothing is tied");
  // Not every statement here was read off a page, so the count is not called a
  // count of pages.
  assert.deepEqual(two.profile.evidence["palette.ink"].at(-1),
    { in: "seen in five of six statements; https://meridian.example.com/a.css states #101317 instead" });

  // One against one is the tie the older rule was right about, and it still
  // carries neither.
  const tied = readOffThePages({ statements: { color: [{ ...seen.statements.color[0], value: "#333333", hex: "#333333", count: 1, pages: onPages(1) }] } });
  const even = buildProfile({ statements: statements(), observations: tied, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.ok(!("ink" in even.profile.palette), "nothing in a tie says which one the owner meant");
  assert.deepEqual(even.contested.map((c) => c.path), ["palette.ink"]);
  assert.deepEqual(even.contested[0].counts, [1, 1], "and the counts are recorded, so the report can say it was one against one");
  assert.deepEqual(even.majority, []);
});

test("a site whose stylesheets are off its host gets its faces from the browser step and nowhere else", () => {
  // The whole of langchain.com's CSS is on another host, so the statements step
  // reads no face at all. The stack the page asks for is still the site's own
  // word, and it is the only route to a face that is left.
  const noCss = { ...NOTHING, color: [], type: [] };
  const seen = readOffThePages({
    statements: {
      color: [],
      type: [
        { role: "heading", family: "Aeonik", stack: 'Aeonik, "TWK Lausanne", sans-serif', where: SITE, place: "h1 { font-family }, as the page renders it", count: 4, pages: onPages(4) },
        { role: "body", family: "Aeonik", stack: "Aeonik, sans-serif", where: SITE, place: "body { font-family }, as the page renders it", count: 4, pages: onPages(4) },
      ],
    },
  });
  const built = buildProfile({ statements: noCss, observations: seen, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.deepEqual(built.profile.type, {
    heading: { family: "Aeonik", fallback: '"TWK Lausanne", sans-serif' },
    body: { family: "Aeonik", fallback: "sans-serif" },
  });
  assert.deepEqual(built.profile.evidence["type.heading.family"], [{ url: SITE, in: "h1 { font-family }, as the page renders it", seen: 4 }]);

  // Three pages asking for one stack and one page asking for another is the
  // site saying two things, and the profile carries the one three of them ask
  // for. This is langchain.com's heading face: dropping it cost the profile the
  // face four pages out of five state.
  const argues = readOffThePages({
    statements: {
      color: [],
      type: [
        { role: "heading", family: "Aeonik", stack: "Aeonik, sans-serif", where: SITE, place: "h1 { font-family }, as the page renders it", count: 3, pages: [PAGE(1), PAGE(2), PAGE(3)] },
        { role: "heading", family: "Inter", stack: "Inter, sans-serif", where: "https://meridian.example.com/about", place: "h1 { font-family }, as the page renders it", count: 1, pages: ["https://meridian.example.com/about"] },
      ],
    },
  });
  const two = buildProfile({ statements: noCss, observations: argues, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.deepEqual(two.profile.type.heading, { family: "Aeonik", fallback: "sans-serif" });
  assert.deepEqual(two.contested, []);
  assert.deepEqual(two.majority.map((m) => [m.path, m.value, m.count, m.total]), [["type.heading.family", "Aeonik", 3, 4]]);
  // Both stacks end in sans-serif, so the fallback is agreed on all four pages
  // and is carried without a word about any minority.
  assert.deepEqual(two.profile.evidence["type.heading.fallback"].map((e) => e.in),
    ["h1 { font-family }, as the page renders it", "h1 { font-family }, as the page renders it"]);

  // Two against two is a tie, and a part whose leaves are tied carries none of
  // its leaves. The fallback still agrees, and a face with a fallback and no
  // family is not a face: anything reading the profile would take the half for
  // the whole.
  const evenly = readOffThePages({
    statements: {
      color: [],
      type: [
        { role: "heading", family: "Aeonik", stack: "Aeonik, sans-serif", where: SITE, place: "h1 { font-family }, as the page renders it", count: 2, pages: [PAGE(0), PAGE(1)] },
        { role: "heading", family: "Inter", stack: "Inter, sans-serif", where: PAGE(2), place: "h1 { font-family }, as the page renders it", count: 2, pages: [PAGE(2), PAGE(3)] },
      ],
    },
  });
  const tied = buildProfile({ statements: noCss, observations: evenly, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.ok(!tied.profile.type, "the pages ask evenly for two heading faces, so the profile carries neither");
  assert.deepEqual(tied.contested.map((c) => c.path), ["type.heading.family"]);
  assert.ok(!tied.written.includes("type.heading.fallback"));
});

test("what the fetch step would not take is in the report, in its own words", () => {
  const built = build();
  const text = report({
    statements: statements({ not_fetched: ["the home page links to 1 page on another host under meridian.example (interrupt.meridian.example), and another host is another site whose brand is its own, so it was not followed"] }),
    built, observations: null, now: () => new Date("2026-09-12T10:00:00Z"),
  });
  assert.match(text, /What was not fetched:/);
  assert.match(text, /- The home page links to 1 page on another host under meridian\.example \(interrupt\.meridian\.example\), and another host is another site whose brand is its own, so it was not followed\./);
  assert.ok(!/What was not fetched:/.test(written(built)), "a run with nothing to say about it says nothing");
});

test("a run with no browser leaves the five out, and the report says which five", () => {
  const built = build();
  assert.deepEqual(built.profile.palette, { ink: "#101317", primary: "#1F6FEB", theme: "#1F6FEB" }, "only what the stylesheets and the manifest state");
  const text = written(built);
  assert.match(text, /It does not carry what the site sets on its own elements, the five colors and the two faces/);
  assert.ok(!/the profile is the same either way/i.test(text), "a run with no browser is not the same either way, and saying so would be false");
  assert.match(text, /the color of headings \(`palette\.heading`\)/);
});

test("a part the site states twice with no value stated more often than another is left out, and the report says what the two were", () => {
  const built = build(statements({
    color: [
      { name: "--color-primary", role: "primary", value: "#1f6feb", hex: "#1F6FEB", ...at(CSS, ":root { --color-primary }") },
      { name: "--brand-primary", role: "primary", value: "#2d7ff9", hex: "#2D7FF9", ...at("https://meridian.example.com/b.css", ":root { --brand-primary }") },
    ],
  }));
  assert.ok(!("primary" in (built.profile.palette ?? {})), "choosing between two values stated once each would be a brand decision");
  assert.equal(built.profile.evidence["palette.primary"], undefined);
  assert.deepEqual(built.contested, [{
    path: "palette.primary", values: ["#1F6FEB", "#2D7FF9"], counts: [1, 1],
    where: [CSS, "https://meridian.example.com/b.css"],
  }]);
  assert.deepEqual(built.majority, []);

  const text = report({ statements: statements(), built, observations: null, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /The site states two values for `palette\.primary`: `#1F6FEB` at one and `#2D7FF9` at one, and no value is stated by more than another, so the draft carries neither\./);
  assert.match(text, /the draft leaves that one out as well/);
});

test("a part the site states more often one way than the other is carried the way most of it states, and the minority is named", () => {
  const built = build(statements({
    color: [
      { name: "--color-primary", role: "primary", value: "#1f6feb", hex: "#1F6FEB", ...at(CSS, ":root { --color-primary }", 4) },
      { name: "--brand-primary", role: "primary", value: "#2d7ff9", hex: "#2D7FF9", ...at("https://meridian.example.com/b.css", ":root { --brand-primary }") },
    ],
  }));
  assert.equal(built.profile.palette.primary, "#1F6FEB", "four against one is not one against one");
  assert.deepEqual(built.contested, []);
  assert.deepEqual(built.majority.map((m) => [m.path, m.value, m.count, m.total, m.pages]),
    [["palette.primary", "#1F6FEB", 4, 5, false]]);
  assert.deepEqual(built.majority[0].minority, [{ value: "#2D7FF9", count: 1, where: ["https://meridian.example.com/b.css"] }]);

  // The evidence for a carried value says it was the one most of them state,
  // and what the rest stated, in words a person can read.
  assert.deepEqual(built.profile.evidence["palette.primary"], [
    { url: CSS, in: ":root { --color-primary }", seen: 4 },
    { in: "seen in four of five statements; https://meridian.example.com/b.css states #2D7FF9 instead" },
  ]);

  const text = report({ statements: statements(), built, observations: null, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /- The primary color, `palette\.primary`: `#1F6FEB`\. Seen at https:\/\/meridian\.example\.com\/a\.css in :root \{ --color-primary \}, four times\. Seen in four of five statements; https:\/\/meridian\.example\.com\/b\.css states `#2D7FF9` instead\./);
  assert.match(text, /The site states two values for `palette\.primary`, over five statements: `#1F6FEB` at four \(https:\/\/meridian\.example\.com\/a\.css\) and `#2D7FF9` at one \(https:\/\/meridian\.example\.com\/b\.css\)\. The draft carries `#1F6FEB`, the one more of them state, and the evidence beside it says so\./);
  assert.ok(!/leaves that one out as well/.test(text), "it was not left out, so nothing says it was");
});

test("the heading color four pages of five state is carried, with the home page named as the one that differs", () => {
  // langchain.com, which is where the older rule was caught: #7FC8FF on four
  // pages and #E5F4FF on the home page, and dropping the field cost the profile
  // the one color that brand is known by.
  const seen = readOffThePages({
    statements: {
      color: [
        { name: "the color of headings", role: "heading", value: "#E5F4FF", hex: "#E5F4FF", where: SITE, place: "h1 { color }, as the page renders it", count: 1, pages: [SITE] },
        { name: "the color of headings", role: "heading", value: "#7FC8FF", hex: "#7FC8FF", where: PAGE(1), place: "h1 { color }, as the page renders it", count: 4, pages: [PAGE(1), PAGE(2), PAGE(3), PAGE(4)] },
      ],
      type: [],
    },
  });
  const built = buildProfile({ statements: { ...NOTHING }, observations: seen, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.equal(built.profile.palette.heading, "#7FC8FF");
  assert.deepEqual(built.profile.evidence["palette.heading"], [
    { url: PAGE(1), in: "h1 { color }, as the page renders it", seen: 4 },
    { in: "seen at four of five pages; the home page states #E5F4FF instead" },
  ]);

  const text = report({ statements: { ...NOTHING }, built, observations: seen, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /Seen at four of five pages; the home page states `#E5F4FF` instead\./);
  assert.match(text, /over five pages: `#7FC8FF` at four \(https:\/\/meridian\.example\.com\/p1, https:\/\/meridian\.example\.com\/p2, https:\/\/meridian\.example\.com\/p3 and https:\/\/meridian\.example\.com\/p4\) and `#E5F4FF` at one \(the home page\)\./);
  assert.match(text, /Nothing is resolved by that: both values are here, with which pages stated which, and the draft is yours to correct\./);
  assert.match(text, /a count of the owner's own statements is evidence and not a preference/);
});

test("a color whose name does not say which role it fills is reported and never placed", () => {
  const built = build(statements({
    color: [
      { name: "--blue-400", value: "#1f6feb", hex: "#1F6FEB", ...at(CSS, ":root { --blue-400 }") },
      { name: "--color-danger", value: "#c1121f", hex: "#C1121F", ...at(CSS, ":root { --color-danger }") },
      { name: "--color-surface", value: "#f4f4f5", hex: "#F4F4F5", ...at(CSS, ":root { --color-surface }") },
    ],
  }));
  assert.ok(!("palette" in built.profile), "a color that names no role of the shape fills none of it");
  assert.deepEqual(built.unplaceable.map((u) => u.value), ["#1F6FEB", "#C1121F", "#F4F4F5"]);

  const text = report({ statements: statements(), built, observations: null, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /the profile shape has no field for them, so they are here and not in it/);
  assert.match(text, /`#1F6FEB`, the color the site calls --blue-400/);

  // The role is read ONCE, upstream, and it travels on the statement. An empty
  // role, or none at all, means the step that reads names found none, and this
  // step does not go looking for a second opinion.
  const said = placeStatements({ site: SITE, color: [{ name: "--blue-400", role: "", value: "#1f6feb", hex: "#1F6FEB", ...at(CSS, ":root { --blue-400 }") }] });
  assert.equal(said.values.get("palette.primary"), undefined);
  assert.equal(said.unplaceable.length, 1);
});

test("the role a name fills is decided once, upstream, and a name holding the word background does not fill ground", () => {
  // --plyr-video-background is a video player's variable. It was written into a
  // real profile as the brand's ground, black, because the step that writes the
  // profile asked a second time whether the name filled a role and answered by
  // looking for the word background anywhere in it. There is one answer now and
  // it is the careful one.
  const names = ["--plyr-video-background", "--color-surface", "--bg", "--color-background"];
  assert.deepEqual(names.map(roleOf), [null, null, "ground", "ground"]);

  const colors = names.map((name, i) => ({
    name, ...(roleOf(name) ? { role: roleOf(name) } : {}),
    value: `#00000${i}`, hex: `#00000${i}`, ...at(CSS, `:root { ${name} }`),
  }));
  const placed = placeStatements({ site: SITE, color: colors });
  assert.deepEqual(placed.unplaceable.map((u) => [u.says, u.value]), [
    ["the color the site calls --plyr-video-background", "#000000"],
    ["the color the site calls --color-surface", "#000001"],
  ], "a color that fills no role is reported, and never placed");
  assert.deepEqual((placed.values.get("palette.ground") ?? []).map((e) => e.value), ["#000002", "#000003"],
    "and the two names that do say which role they fill, fill it");

  // End to end: the same four names in a stylesheet, and nothing but ground in
  // the profile, which those two disagree about and so leave empty.
  const built = build(statements({
    color: colors.filter((c) => c.role),
    type: [],
  }));
  assert.ok(!built.written.some((p) => p === "palette.ground"), "the two that fill ground state it differently and are tied");
  const dropped = build(statements({ color: colors.filter((c) => !c.role), type: [] }));
  assert.ok(!("palette" in dropped.profile), "and the two that fill no role reach no field at all");
  assert.deepEqual(dropped.unplaceable.map((u) => u.value), ["#000000", "#000001"]);
});

test("a family the site names without saying where it goes fills no field of the shape", () => {
  // A font service link names its families in its address. That the site loads
  // Inter is true; that Inter is its body face is not something the site said,
  // and a profile carrying it would be handed to other agents as though the
  // owner had said it.
  const built = build(statements({
    type: [
      { family: "Inter", stack: "Inter", ...at("https://fonts.example.com/css2?family=Inter&family=Space+Grotesk", "the font service link") },
      { family: "Space Grotesk", stack: "Space Grotesk", ...at("https://fonts.example.com/css2?family=Inter&family=Space+Grotesk", "the font service link") },
      { role: "heading", family: "Space Grotesk", stack: '"Space Grotesk", system-ui, sans-serif', ...at(CSS, "h1, h2 { font-family }", 3) },
    ],
  }));
  assert.deepEqual(built.profile.type, { heading: { family: "Space Grotesk", fallback: "system-ui, sans-serif" } });
  assert.ok(!("body" in built.profile.type), "a family loaded from a font service is not thereby the body face");
  assert.deepEqual(built.unplaceable.map((u) => u.value), ["Inter", "Space Grotesk"]);
  assert.ok(built.missing.some((p) => p.path === "type.body"), "the body face is missing, and the report says so");

  const text = report({ statements: statements(), built, observations: null, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /`Inter`, a font family the site names without saying whether it is for headings or for body text/);
  assert.match(text, /the body face \(`type\.body`\)/);
});

test("the mark comes from the route that names it first, and the others are reported beside it", () => {
  const built = build(statements({
    mark: [
      { value: "https://meridian.example.com/touch-icon.png", route: "apple-touch-icon", pixels: 180, ...at(SITE, 'link rel="apple-touch-icon"') },
      { value: "https://meridian.example.com/brand/mark.svg", route: "organisation-record", media_type: "image/svg+xml", ...at(SITE, "the Organization logo") },
    ],
  }));
  assert.deepEqual(built.profile.logo.mark, { href: "https://meridian.example.com/brand/mark.svg", media_type: "image/svg+xml" });
  assert.deepEqual(built.unplaceable.map((u) => u.value), ["https://meridian.example.com/touch-icon.png"]);
  const text = report({ statements: statements(), built, observations: null, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /touch-icon\.png is an image the site names as its mark by a second route/);
});

test("the report says the four things in this order, and names what no website carries", () => {
  const built = build();
  const text = written(built);
  const heads = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(heads, [
    "What was found, and where",
    "What the site was observed doing",
    "What no website carries",
    "Where the site disagrees with itself",
  ]);

  // The parts a person has to type, said in the words what-counts.md says them
  // in. An owner who is not told these are missing will read the silence as a
  // finished profile.
  for (const one of TYPED_BY_A_PERSON) assert.ok(text.toLowerCase().includes(one.says), `the report does not name ${one.says}`);
  assert.match(text, /the narration voice/i);
  assert.match(text, /the words the brand will not say/i);
  assert.match(text, /the things that must never be done to the mark/i);
  assert.match(text, /the contrast floor the brand requires, as against the one it achieves/i);
  assert.match(text, /which of two colors is primary when the site uses both everywhere/i);
  for (const field of ["voice.narration", "words.never_say", "logo.never", "palette.contrast_floor"]) {
    assert.ok(text.includes(`\`${field}\``), `the report does not name the field ${field}`);
  }

  // What was found, with the place it was said, and what is missing by name.
  assert.match(text, /- The primary color, `palette\.primary`: `#1F6FEB`\. Seen at https:\/\/meridian\.example\.com\/a\.css in :root \{ --color-primary \}, four times\./);
  assert.match(text, /- The heading face, `type\.heading`: its family `Space Grotesk` and its fallback `system-ui, sans-serif`\./);
  assert.match(text, /the accent color \(`palette\.accent`\)/);
  assert.match(text, /the mono face \(`type\.mono`\)/);
  assert.match(text, /An absent field means the site stated nothing\. It never means a default/);

  // What was looked at and not taken as a statement, which is where an owner
  // learns their favicon was not read as their mark.
  assert.match(text, /Three pages name a favicon, which is a browser tab icon and not the mark\./);

  // The closing line, in the last place a person reads.
  assert.match(text.trimEnd(), /This is a draft\. Nobody has vouched for it\. It becomes your brand profile when you correct it and adopt it\.$/);
  const dashes = [...new Set([...text].filter((c) => /\p{Pd}/u.test(c) && c !== "-"))];
  assert.deepEqual(dashes, [], "the report holds a dash a person would read as an em dash");
  assert.ok(!/[A-Za-z]:\\|\/(?:tmp|home|opt|Users)\//.test(text), "the report names a path on this host");
});

test("what the site was observed doing is in the report and in no profile", () => {
  const built = build();
  const observations = {
    observations: "v1", opened: true,
    pages: [{ url: "https://meridian.example.com/" }, { url: "https://meridian.example.com/about" }],
    not_opened: [{ url: "https://meridian.example.com/pricing", why: "the page answered 500" }],
    colors: [{ color: "#ffffff", share: 0.78, cells: 5000, pages: [] }, { color: "#1f6feb", share: 0.14, cells: 900, pages: [] }],
    faces: { heading: [{ face: "Space Grotesk", seen: 4, pages: ["https://meridian.example.com/"] }, { face: "Inter", seen: 1, pages: ["https://meridian.example.com/about"] }], body: [{ face: "IBM Plex Sans", seen: 9, pages: [] }] },
    contrast: [{ text: "#767676", ground: "#ffffff", ratio: 4.54, roles: ["body"], seen: 9, pages: [] }, { text: "#101317", ground: "#ffffff", ratio: 18.62, roles: ["heading"], seen: 4, pages: [] }],
    disagreements: [{ what: "more than one color in the same role", role: "blue", values: ["#0b5cd5", "#1f6feb"], where: ["https://meridian.example.com/"], says: "Two blues are used across the two pages that were opened: #0b5cd5 and #1f6feb." }],
  };
  const text = report({ statements: statements(), built, observations, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /Heading text renders in two faces: Space Grotesk on one page and Inter on one page\./);
  assert.match(text, /#ffffff at 78 percent/);
  assert.match(text, /runs from 4\.54 to 18\.62/);
  assert.match(text, /it is not the floor the brand requires/);
  assert.match(text, /One page would not open/);
  assert.match(text, /Two blues are used across the two pages that were opened: #0b5cd5 and #1f6feb\./);
  // Not "nothing is chosen for you": a primary or an accent can be chosen, by
  // a model looking at the page, and the report said the opposite two sections
  // above where it said so. What is true of this section is that a
  // disagreement is never resolved.
  assert.match(text, /Nothing in this section is resolved for you\./);
  assert.ok(!/a count of the owner's own statements/.test(text), "nothing was carried by a count here, so nothing explains one");

  // None of it reached the profile. This record states nothing itself, so the
  // profile built with it is the profile built without it, to the byte.
  const withObserved = buildProfile({ statements: statements(), observations, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.deepEqual(withObserved.profile, built.profile);
  assert.ok(!JSON.stringify(withObserved.profile).includes("#767676"), "a color read off a contrast pairing is not a statement");
  assert.ok(!JSON.stringify(withObserved.profile).includes("4.54"));
  assert.ok(!JSON.stringify(withObserved.profile).includes("0.78"), "the share of the page a color covers is not a statement");
});

test("a site that states nothing gets the report alone, naming what was looked for", () => {
  const built = buildProfile({ statements: NOTHING, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.deepEqual(built.stated, [], "the domain the person gave is not a statement the site made");
  assert.deepEqual(built.written, ["owner"]);
  const text = report({ statements: NOTHING, built, observations: null, now: () => new Date("2026-09-12T10:00:00Z") });
  assert.match(text, /The site states nothing about itself that this shape has a field for, so no profile was written\./);
  assert.match(text, /A profile of guesses would be worse than none/);
  assert.match(text, /These were looked for: the theme color, .+ and the copyright line\./);
});

test("run from the shell, it writes the profile and the report", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-profile-"));
  try {
    const records = join(dir, "statements.json");
    const out = join(dir, "brand-profile.json");
    const reportTo = join(dir, "brand-report.md");
    writeFileSync(records, JSON.stringify(statements()));
    const env = { ...process.env, STATEMENTS: records, OUT: out, REPORT: reportTo };

    const r = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /parts in the draft profile at /);
    const profile = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(profile.adopted, false);
    assert.equal(profile.palette.primary, "#1F6FEB");
    assert.ok(profile.evidence["palette.primary"]);
    const text = readFileSync(reportTo, "utf8");
    assert.match(text, /# Brand report for meridian\.example\.com/);
    assert.match(text, /The pages were not opened, so there is nothing here\./);
    assert.ok(!text.includes(dir) && !readFileSync(out, "utf8").includes(dir), "a path on this host reached what is delivered");

    // What was only observed reaches the report alone.
    const seen = join(dir, "observations.json");
    writeFileSync(seen, JSON.stringify({ opened: true, pages: [{ url: SITE }], not_opened: [], statements: { color: [] }, colors: [{ color: "#ffffff", share: 1, cells: 10, pages: [SITE] }], faces: { heading: [], body: [] }, contrast: [], disagreements: [] }));
    const withObs = spawnSync(process.execPath, [script], { env: { ...env, OBSERVATIONS: seen }, encoding: "utf8" });
    assert.equal(withObs.status, 0, withObs.stderr);
    assert.match(readFileSync(reportTo, "utf8"), /#ffffff at 100 percent/);
    assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), profile, "a record that states nothing leaves the profile as it was");

    // What the pages set on their own elements reaches the profile, with the
    // page it was read on in the evidence.
    writeFileSync(seen, JSON.stringify({
      opened: true, pages: [{ url: SITE }], not_opened: [],
      statements: { color: [{ name: "the color behind body text", role: "ground", value: "#FFFFFF", hex: "#FFFFFF", where: SITE, place: "body { background-color }, as the page renders it", count: 5 }] },
      colors: [], faces: { heading: [], body: [] }, contrast: [], disagreements: [],
    }));
    const withStated = spawnSync(process.execPath, [script], { env: { ...env, OBSERVATIONS: seen }, encoding: "utf8" });
    assert.equal(withStated.status, 0, withStated.stderr);
    const wider = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(wider.palette.ground, "#FFFFFF");
    assert.deepEqual(wider.evidence["palette.ground"], [{ url: SITE, in: "body { background-color }, as the page renders it", seen: 5 }]);

    // A site that states nothing: the report is written and the profile is not.
    writeFileSync(records, JSON.stringify(NOTHING));
    rmSync(out);
    const empty = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(empty.status, 0, "a site that states nothing is a real answer and not a failure");
    assert.match(empty.stdout, /brand report at .*, and no profile/);
    assert.match(empty.stderr, /the site states nothing this shape has a field for, so no profile was written/);
    assert.ok(!existsSync(out), "a profile of nothing was written");
    assert.match(readFileSync(reportTo, "utf8"), /These were looked for: /);

    const settings = spawnSync(process.execPath, [script], { env: { ...env, REPORT: "" }, encoding: "utf8" });
    assert.equal(settings.status, 2);
    assert.match(settings.stderr, /^refused: STATEMENTS, OUT and REPORT are required/);

    writeFileSync(records, "{ this is not json");
    const broken = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /^refused: the statements record could not be read/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------- the two roles nobody declares

const ROLES_WORDS = "chosen from the six colors these pages declare, by a model reading the home page; the site does not say so itself";
const roles = (over = {}) => ({
  roles: "v1",
  home_page: SITE,
  offered: [],
  primary: null,
  accent: { value: "#E9C46A", in: ROLES_WORDS, url: SITE },
  ...over,
});
const day = () => new Date("2026-09-12T10:00:00Z");
const withRoles = (chosen, record = statements()) => buildProfile({ statements: record, chosen, now: day });

test("a chosen role reaches the profile carrying evidence that says a model chose it", () => {
  const built = withRoles(roles());
  assert.equal(built.profile.palette.accent, "#E9C46A");
  assert.deepEqual(built.profile.evidence["palette.accent"], [{ url: SITE, in: ROLES_WORDS }]);
  assert.deepEqual(built.chosen, ["palette.accent"]);
  // It is not counted as something the site stated, so a site that states
  // nothing else still gets the report alone and no profile.
  assert.ok(!built.stated.includes("palette.accent"));
  assert.deepEqual(withRoles(roles(), NOTHING).stated, []);

  const text = report({ statements: statements(), built, observations: null, chosen: roles(), now: day });
  assert.match(text, /- The accent color, `palette\.accent`: `#E9C46A`\. Chosen from the six colors these pages declare, by a model reading the home page; the site does not say so itself\. The home page it read is https:\/\/meridian\.example\.com\//);
  assert.match(text, /`palette\.accent` is the one value here the site did not say\./);
  assert.match(text, /It answers with one of those colors or with none, it never supplies a color of its own/);
  assert.ok(!built.missing.some((p) => p.path === "palette.accent"), "a chosen part is not also reported as missing");
});

test("a role the site states for itself is never overwritten by a choice", () => {
  // The fixture site states --color-primary. A model choosing another color
  // for that role changes nothing, and the evidence still points at the CSS.
  const built = withRoles(roles({ primary: { value: "#FF6B35", in: ROLES_WORDS, url: SITE } }));
  assert.equal(built.profile.palette.primary, "#1F6FEB");
  assert.deepEqual(built.chosen, ["palette.accent"]);
  assert.equal(built.profile.evidence["palette.primary"][0].in, ":root { --color-primary }");
  assert.equal(JSON.stringify(built.profile).includes("#FF6B35"), false);
});

test("a role the site states two ways is left contested and not chosen either", () => {
  const tied = statements({
    color: [
      { name: "--accent", role: "accent", value: "#0ea5e9", hex: "#0EA5E9", ...at(CSS, ":root { --accent }") },
      { name: "--brand-accent", role: "accent", value: "#e9c46a", hex: "#E9C46A", ...at(`${SITE}b.css`, ":root { --brand-accent }") },
    ],
  });
  const built = withRoles(roles({ accent: { value: "#0EA5E9", in: ROLES_WORDS, url: SITE } }), tied);
  assert.deepEqual(built.contested.map((c) => c.path), ["palette.accent"]);
  assert.ok(!("accent" in (built.profile.palette ?? {})), "choosing between two things the owner published would be resolving a disagreement");
  assert.deepEqual(built.chosen, []);
});

test("with the step absent the profile is whole, and the report says the roles were not chosen and why", () => {
  const without = build();
  const same = withRoles(null);
  assert.deepEqual(same.profile, without.profile, "a run with no roles record writes exactly what it always wrote");
  assert.deepEqual(same.chosen, []);

  // No record at all: the step did not run, and the report says so rather than
  // leaving a reader to wonder whether their site simply has no accent.
  assert.match(written(without), /The primary and the accent were not chosen: the step that chooses them did not run\./);

  // A record with a reason in it: the reason is what the report carries, because
  // no key, no browser and a model that chose none are three different things
  // for a person to do next.
  for (const why of [
    "the key for the text-reasoning service is not set on this host, so nothing was asked",
    "the home page could not be opened to take a picture of it",
    "the model looked at the home page and said none of the colors these pages declare fills either role",
  ]) {
    const text = report({
      statements: statements(), built: without, observations: null,
      chosen: roles({ accent: null, not_chosen: why }), now: day,
    });
    assert.match(text, new RegExp(`The primary and the accent were not chosen: ${why.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`));
    assert.ok(!text.includes("a model"), "nothing says a model chose anything when none did");
  }
});

test("run from the shell, a roles record fills the two and the profile says who chose them", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-profile-"));
  try {
    const records = join(dir, "statements.json");
    const chosen = join(dir, "roles.json");
    const out = join(dir, "brand-profile.json");
    const reportTo = join(dir, "brand-report.md");
    writeFileSync(records, JSON.stringify(statements()));
    writeFileSync(chosen, JSON.stringify(roles()));
    const env = { ...process.env, STATEMENTS: records, CHOSEN: chosen, OUT: out, REPORT: reportTo };
    const r = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /1 of them chosen from the colors the site declares rather than stated by it/);
    const profile = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(profile.palette.accent, "#E9C46A");
    assert.deepEqual(profile.evidence["palette.accent"], [{ url: SITE, in: ROLES_WORDS }]);

    // The same run with no roles record at all, which is the skippable step
    // skipped: the profile is written without the accent and is whole.
    const bare = spawnSync(process.execPath, [script], { env: { ...env, CHOSEN: "" }, encoding: "utf8" });
    assert.equal(bare.status, 0, bare.stderr);
    const thinner = JSON.parse(readFileSync(out, "utf8"));
    assert.ok(!("accent" in thinner.palette));
    assert.deepEqual({ ...profile.palette, accent: undefined }, { ...thinner.palette, accent: undefined });
    assert.match(readFileSync(reportTo, "utf8"), /The primary and the accent were not chosen/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the shape this writes is the one the package documents", () => {
  const doc = readFileSync(join(here, "..", "references", "brand-profile.md"), "utf8");
  for (const part of PARTS) assert.ok(doc.includes(`\`${part.path}\``) || doc.includes(part.path), `${part.path} is not in references/brand-profile.md`);
  assert.match(doc, /absence means not stated/i);
  assert.match(doc, /palette\.theme/);
  assert.match(doc, /evidence/);
});
