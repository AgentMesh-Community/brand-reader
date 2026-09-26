// The statements step collects what the site SAYS about itself and nothing
// else, and references/what-counts.md is the authority on the difference.
//
// What is worth pinning: the mark comes only by the four routes that name it,
// so a favicon is never the mark while an apple touch icon at 180 is, and a
// share image is not one either; a custom property called --brand-primary is a
// statement and one called --c3 is not; a color a stylesheet sets on body or
// on a heading is a statement and is left to the step with the browser, which
// is what settles a cascade; a font-family declaration carries its whole
// fallback stack; every statement carries the address, the place and the
// count; a site that states nothing is a real answer and not an error; and no
// local file path reaches the statements.
// Run: node --test test/statements.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  LOOKED_FOR, Refusal,
  colorValue, cssRules, customProperties, declaresOnRoot, familiesInHref, familyOf,
  firstTrademark, footerCopyright, headerLogos, namesWhatItIs, organisationLogos,
  readStatements, resolveStack, roleOf, selectorRoles, sizeOf, summarise,
} from "../scripts/statements.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "statements.mjs");

const HOME = `<!doctype html><html><head>
<title>Meridian Analytics</title>
<link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/brand.css">
<link rel="icon" sizes="16x16" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#1F6FEB">
<meta property="og:image" content="https://meridian.example/card.png">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Organization","name":"Meridian Analytics","logo":"https://meridian.example/brand/mark.svg"}
</script>
<style>:root { --brand-ground: #FFFFFF; }</style>
</head><body>
<header><a class="site-logo" href="/"><img src="/brand/mark.svg" alt="Meridian Analytics"></a></header>
<h1>Meridian Analytics&reg; reads what a site states.</h1>
<p>A brand profile is a draft until its owner adopts it.</p>
<footer><p>&copy; 2026 Meridian Analytics. All rights reserved.</p></footer>
</body></html>`;

const ABOUT = `<!doctype html><html><head>
<title>About Meridian</title>
<link rel="stylesheet" href="/brand.css">
<link rel="stylesheet" href="/about.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans&display=swap">
<link rel="icon" sizes="16x16" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#1F6FEB">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#101317">
</head><body>
<header><a href="/" aria-label="Meridian Analytics logo"><img src="/brand/mark.svg"></a></header>
<h1>About</h1>
<footer><p>&copy; 2026 Meridian Analytics. All rights reserved.</p></footer>
</body></html>`;

const MANIFEST = JSON.stringify({
  name: "Meridian Analytics",
  theme_color: "#1F6FEB",
  icons: [
    { src: "/icons/48.png", sizes: "48x48", type: "image/png" },
    { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
  ],
}, null, 2);

const BRAND_CSS = `/* what the brand states about itself */
:root {
  --brand-primary: #1F6FEB;
  --c3: #E9C46A;
  --color-ink: rgb(16, 19, 23);
  --blue-400: #2266CC;
  --brand-voice: uppercase;
  --space-3: 1.25rem;
  --body-font: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
  --heading-font: var(--display-font);
}
.card { --brand-shadow: #000000; }
h1, h2 { font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 700 }
body { font-family: var(--body-font) }
h3 { font-family: var(--heading-font) }
.pill { font-family: "Some Other", sans-serif }
@media (min-width: 40rem) { h1 { font-family: "Space Grotesk", system-ui, sans-serif } }
@font-face { font-family: "Never Declared"; src: url(/f.woff2) }`;

const ABOUT_CSS = `.card { color: #101317 }`;
const BARE = `<!doctype html><html><head><title>Nothing</title></head><body><h1>Words on a page</h1><p>And more words.</p></body></html>`;

const MOMENT = "2026-09-12T09:00:00.000Z";
const resource = (id, kind, address, text, extra = {}) => ({
  id, kind, ...extra, address, fetched: MOMENT,
  sha256: "0".repeat(64), bytes: Buffer.byteLength(text), media_type: kind === "stylesheet" ? "text/css" : "text/html", text,
});

/** The record the fetch step writes, made up here so this whole file runs with
 *  no network and no disk. */
const fetched = (resources) => ({
  fetched: "v1",
  site: "https://meridian.example/",
  domain: "meridian.example",
  started: MOMENT,
  pages_asked: 5,
  resources,
  skipped: [],
});

const wholeSite = () => fetched([
  resource("p1", "page", "https://meridian.example/", HOME, { role: "home" }),
  resource("m1", "manifest", "https://meridian.example/site.webmanifest", MANIFEST, { named_by: ["p1"] }),
  resource("p2", "page", "https://meridian.example/about", ABOUT, { role: "linked" }),
  resource("s1", "stylesheet", "https://meridian.example/brand.css", BRAND_CSS, { named_by: ["p1", "p2"] }),
  resource("s2", "stylesheet", "https://meridian.example/about.css", ABOUT_CSS, { named_by: ["p2"] }),
]);

const routes = (statements) => statements.mark.map((m) => m.route).sort();
const named = (statements, name) => statements.color.find((c) => c.name === name) ?? null;

test("the mark comes by the four routes that name it, and a favicon is not one of them", () => {
  const statements = readStatements(wholeSite());

  assert.deepEqual(routes(statements), ["apple-touch-icon", "header-logo", "manifest-icon", "manifest-icon", "organisation-record"]);
  for (const mark of statements.mark) {
    assert.ok(!/favicon/i.test(mark.value), `${mark.value} is a browser tab icon and was taken as the mark`);
    assert.ok(!/card\.png/.test(mark.value), "a share image was taken as the mark");
  }

  // The apple touch icon is 180 by 180 and is a mark; it is named on both
  // pages, which is what the count says.
  const apple = statements.mark.find((m) => m.route === "apple-touch-icon");
  assert.equal(apple.value, "https://meridian.example/apple-touch-icon.png");
  assert.equal(apple.pixels, 180);
  assert.equal(apple.count, 2);
  assert.equal(apple.where, "https://meridian.example/");
  assert.equal(apple.place, 'link rel="apple-touch-icon" sizes="180x180"');

  // The manifest names three icons and the 48 is a tab icon by another name.
  assert.deepEqual(statements.mark.filter((m) => m.route === "manifest-icon").map((m) => [m.value, m.pixels]), [
    ["https://meridian.example/icons/192.png", 192],
    ["https://meridian.example/icons/512.png", 512],
  ]);

  const record = statements.mark.find((m) => m.route === "organisation-record");
  assert.equal(record.value, "https://meridian.example/brand/mark.svg");
  assert.equal(record.place, 'script type="application/ld+json", the Organization logo');

  // The header logo holds all three of what-counts: it says logo, it is in the
  // header, and it links to the root. Both pages name it, by the class on one
  // and the label on the other.
  const header = statements.mark.find((m) => m.route === "header-logo");
  assert.equal(header.value, "https://meridian.example/brand/mark.svg");
  assert.equal(header.count, 2);

  // What was there and was not used is said, because silence about a favicon
  // is exactly how one ends up in a profile.
  assert.ok(statements.skipped.some((s) => /2 pages name a favicon, which is a browser tab icon and not the mark/.test(s)));
  assert.ok(statements.skipped.some((s) => /share image in og:image or twitter:image, which is a social card and not the mark/.test(s)));
  assert.ok(statements.skipped.some((s) => /1 icon is under 180 pixels/.test(s)));

  // The routes on their own, so the rule is pinned and not only its result.
  assert.deepEqual(organisationLogos({ "@type": "Organization", logo: { url: "/mark.svg" } }), ["/mark.svg"]);
  assert.deepEqual(organisationLogos({ "@graph": [{ "@type": ["Organization", "Corporation"], logo: "/a.svg" }, { "@type": "WebPage", logo: "/b.svg" }] }), ["/a.svg"]);
  assert.deepEqual(headerLogos('<header><a href="/"><img class="logo" src="/m.svg"></a></header>', "https://meridian.example/").marks, ["https://meridian.example/m.svg"]);
  assert.deepEqual(headerLogos('<header><a href="/about"><img class="logo" src="/m.svg"></a></header>', "https://meridian.example/").marks, [], "a logo that does not link to the root is not the route");
  assert.deepEqual(headerLogos('<header><a href="/"><img src="/m.svg" alt="Meridian"></a></header>', "https://meridian.example/").marks, [], "an image in the header that says nothing about being a logo is not the route");
  assert.deepEqual(headerLogos('<div><a href="/"><img class="logo" src="/m.svg"></a></div>', "https://meridian.example/").marks, [], "outside the header it is not the route");
  assert.equal(sizeOf("16x16 32x32 180x180"), 180);
  assert.equal(sizeOf("any"), 0);
});

test("a custom property named --brand-primary is a statement, and one named --c3 is not", () => {
  const statements = readStatements(wholeSite());

  assert.ok(namesWhatItIs("--brand-primary"));
  assert.ok(namesWhatItIs("--color-primary"));
  assert.ok(namesWhatItIs("--accent"));
  assert.ok(namesWhatItIs("--ink"));
  assert.ok(namesWhatItIs("--ground"));
  assert.ok(!namesWhatItIs("--c3"));
  assert.ok(!namesWhatItIs("--x"));
  assert.ok(!namesWhatItIs("--space-3"));

  const primary = named(statements, "--brand-primary");
  assert.equal(primary.value, "#1F6FEB");
  assert.equal(primary.hex, "#1F6FEB");
  assert.equal(primary.where, "https://meridian.example/brand.css");
  assert.equal(primary.place, ":root { --brand-primary }");
  assert.equal(primary.count, 1);

  assert.equal(named(statements, "--c3"), null, "the name is the statement, and --c3 states nothing");
  assert.ok(statements.skipped.some((s) => /1 custom property on :root holds a color but its name does not say what it is/.test(s)));

  // Stating a color and filling a role are two different things, and only the
  // second can reach a profile. --blue-400 says which color it is, so it is
  // kept; it says no role it fills, so it is reported and never written into
  // the profile as though the owner had chosen it for something.
  assert.equal(primary.role, "primary");
  assert.equal(named(statements, "--color-ink").role, "ink");
  assert.equal(named(statements, "--brand-ground").role, "ground");
  const blue = named(statements, "--blue-400");
  assert.equal(blue.value, "#2266CC");
  assert.equal(blue.role, undefined, "a color that fills no role names none");
  assert.ok(statements.skipped.some((s) => /1 custom property states a color and names no role it fills, so it belongs in the report and not in the profile/.test(s)));

  assert.equal(roleOf("--brand-primary"), "primary");
  assert.equal(roleOf("--color-primary"), "primary");
  assert.equal(roleOf("--theme-color-accent"), "accent");
  assert.equal(roleOf("--ink"), "ink");
  assert.equal(roleOf("--on-primary"), "on_primary");
  assert.equal(roleOf("--blue-400"), null);
  assert.equal(roleOf("--color-gray-500"), null, "a step on a ramp is not the role");
  assert.equal(roleOf("--primary-500"), null);
  assert.equal(roleOf("--brand-primary-hover"), null, "a state is not the role either");
  assert.ok(namesWhatItIs("--blue-400"), "a name that says which color it is says what it is");

  // A name fills a role only when it is unambiguous about which role, to
  // somebody reading the name alone and knowing nothing about the site.
  // Background and text pass that test, and hardly anybody writes --ground or
  // --ink, so leaving them out would empty the profile in the two places it is
  // most obviously wrong to be empty.
  assert.equal(roleOf("--color-background"), "ground");
  assert.equal(roleOf("--bg"), "ground");
  assert.equal(roleOf("--color-text"), "ink");
  assert.equal(roleOf("--foreground"), "ink");
  assert.equal(roleOf("--fg"), "ink");
  assert.equal(roleOf("--color-surface"), null, "surface is a role in some systems and a shade in others");
  assert.equal(roleOf("--canvas"), null);
  assert.equal(roleOf("--muted"), null);
  assert.equal(roleOf("--base"), null);
  assert.equal(roleOf("--constructor"), null, "a name is only ever looked up among the role words themselves");
  assert.ok(namesWhatItIs("--bg") && namesWhatItIs("--text"), "a name that says which role it fills has said what it is");

  // Read through the whole step, not only the rule: a bare --bg and a bare
  // --color-text state a color and fill their roles.
  const plain = readStatements(fetched([resource("p1", "page", "https://meridian.example/",
    "<html><head><style>:root{--bg:#FFFFFF;--color-text:#101317;--color-surface:#F4F4F5}</style></head><body><p>Words.</p></body></html>",
    { role: "home" })]));
  assert.deepEqual(plain.color.map((c) => [c.name, c.role, c.hex]), [
    ["--bg", "ground", "#FFFFFF"],
    ["--color-text", "ink", "#101317"],
    ["--color-surface", undefined, "#F4F4F5"],
  ]);
  assert.equal(plain.counts.color, 3);
  assert.equal(plain.counts.color_filling_a_role, 2);

  // The value is the site's own words, with the plain hex beside it only when
  // the two are exactly the same color.
  assert.equal(named(statements, "--color-ink").value, "rgb(16, 19, 23)");
  assert.equal(named(statements, "--color-ink").hex, "#101317");

  // A name that says what it is, holding something that is not a color this
  // step converts, is reported and never guessed at.
  assert.equal(named(statements, "--brand-voice"), null);
  assert.ok(statements.skipped.some((s) => /does not read as a color: "uppercase"/.test(s)));

  // A custom property on a component is not a statement about the brand.
  assert.equal(named(statements, "--brand-shadow"), null);

  // A style block in the page is a stylesheet the page carries.
  const ground = named(statements, "--brand-ground");
  assert.equal(ground.where, "https://meridian.example/");
  assert.equal(ground.place, "a style block in the page, :root { --brand-ground }");

  // Both theme colors are stated, in two different places, and they are kept
  // apart so the step after this one can report a disagreement rather than
  // resolve it.
  assert.deepEqual(statements.color.filter((c) => !c.name.startsWith("--")).map((c) => [c.name, c.value, c.count, c.place]), [
    ["theme_color", "#1F6FEB", 1, "theme_color in the web app manifest"],
    ["theme-color", "#1F6FEB", 2, 'meta name="theme-color"'],
    ["theme-color", "#101317", 1, 'meta name="theme-color" media="(prefers-color-scheme: dark)"'],
  ]);

  assert.deepEqual(colorValue("#fff"), { value: "#fff", hex: "#FFFFFF" });
  assert.deepEqual(colorValue("rgba(31, 111, 235, 0.5)"), { value: "rgba(31, 111, 235, 0.5)" });
  assert.deepEqual(colorValue("oklch(0.7 0.1 240)"), { value: "oklch(0.7 0.1 240)" });
  assert.equal(colorValue("rebeccapurple"), null, "a color written as a name is not converted here");
  assert.equal(colorValue("1.25rem"), null);
  assert.equal(colorValue("var(--blue-500)"), null);
  assert.ok(declaresOnRoot(':root[data-theme="dark"]'));
  assert.ok(declaresOnRoot("html.dark, :root"));
  assert.ok(!declaresOnRoot(".card, .pill"));
});

test("a color a stylesheet sets on the site's own elements is left to the step with the browser", () => {
  // Those five are statements. They are not collected HERE, because what a
  // rule sets is not what an element comes to: the cascade, the media queries
  // and the specificity decide between them, and a browser is what settles
  // that. Matching selectors here as well would state a color no page shows
  // and then argue with the page about it.
  const css = `body { color: #101317; background: #FFFFFF }
h1 { color: #0B5CD5 }
a { color: #1F6FEB }
.btn { background-color: #1F6FEB }
@media (prefers-color-scheme: dark) { body { color: #FFFFFF } }`;
  const site = (sheet) => fetched([
    resource("p1", "page", "https://meridian.example/", BARE, { role: "home" }),
    resource("s1", "stylesheet", "https://meridian.example/a.css", sheet, { named_by: ["p1"] }),
  ]);

  const statements = readStatements(site(css));
  assert.deepEqual(statements.color, [], "no color is taken off a selector here");
  assert.equal(statements.counts.color, 0);
  assert.ok(statements.not_found.includes(LOOKED_FOR[1]));

  // A custom property in the same stylesheet is read, because its name is the
  // statement and a name needs no cascade to settle it.
  const withVar = readStatements(site(`:root { --color-ink: #101317 }\n${css}`));
  assert.deepEqual(withVar.color.map((c) => c.name), ["--color-ink"]);
  assert.equal(withVar.color[0].role, "ink");
});

test("a font-family declaration carries its whole fallback stack", () => {
  const statements = readStatements(wholeSite());

  assert.deepEqual(statements.type.map((t) => [t.role ?? t.route, t.family, t.stack, t.count]), [
    ["font-link", "Space Grotesk", undefined, 1],
    ["font-link", "IBM Plex Sans", undefined, 1],
    ["heading", "Space Grotesk", '"Space Grotesk", system-ui, sans-serif', 2],
    ["body", "IBM Plex Sans", "'IBM Plex Sans', system-ui, -apple-system, sans-serif", 1],
  ]);
  const heading = statements.type.find((t) => t.role === "heading");
  assert.equal(heading.where, "https://meridian.example/brand.css");
  assert.equal(heading.place, "h1, h2 { font-family }");

  // A stack written through a variable declared on :root is one statement
  // written in two places, so it is followed one step and the place says so.
  const body = statements.type.find((t) => t.role === "body");
  assert.equal(body.place, "body { font-family } through --body-font declared on :root");
  assert.deepEqual(resolveStack("var(--body-font)", customProperties([{ rules: cssRules(BRAND_CSS) }])), [
    { stack: "'IBM Plex Sans', system-ui, -apple-system, sans-serif", through: "--body-font" },
  ]);
  assert.deepEqual(resolveStack('var(--nowhere, "Space Grotesk", system-ui)', new Map()), [
    { stack: '"Space Grotesk", system-ui', through: "--nowhere" },
  ], "a fallback written into the declaration is written on the page like anything else");
  assert.equal(resolveStack('"Space Grotesk", system-ui', new Map()), null, "a stack that names a face outright is not a chain");
  assert.deepEqual(resolveStack("var(--missing)", new Map()), [], "a variable declared nowhere resolves to nothing");

  // One step only. A variable whose value is another variable states no face,
  // and it is counted rather than followed.
  assert.ok(!statements.type.some((t) => t.place?.includes("--heading-font")));
  assert.ok(statements.skipped.some((s) => /1 font-family declaration names a variable this step could not follow in one step, so it states no face/.test(s)));

  // The families a stylesheet address names in itself, with nothing fetched.
  assert.deepEqual(familiesInHref("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans&display=swap", "https://meridian.example/"), ["Space Grotesk", "IBM Plex Sans"]);
  assert.deepEqual(familiesInHref("https://fonts.googleapis.com/css?family=Space+Grotesk:400,700|IBM+Plex+Sans", "https://meridian.example/"), ["Space Grotesk", "IBM Plex Sans"]);
  assert.deepEqual(familiesInHref("/brand.css", "https://meridian.example/"), [], "an ordinary stylesheet names no family in its address");
  const linked = statements.type.find((t) => t.route === "font-link");
  assert.equal(linked.where, "https://meridian.example/about", "the family was stated on the page that named it");
  assert.ok(linked.place.startsWith('link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk'));
  assert.equal(linked.stack, undefined, "an address carries no fallback stack, so the family alone is the statement");

  // A face declared for neither headings nor body text is not a statement
  // about the brand's type, and a face named in @font-face is a file the site
  // loads rather than a face it declares.
  assert.ok(!statements.type.some((t) => /Some Other|Never Declared/.test(t.family)));
  assert.ok(statements.skipped.some((s) => /1 font-family declaration names neither headings nor body text/.test(s)));

  assert.deepEqual(selectorRoles(".page h1, .page h2"), ["heading"]);
  assert.deepEqual(selectorRoles("h1 .badge"), [], "the last compound is what a selector targets");
  assert.deepEqual(selectorRoles("body"), ["body"]);
  assert.deepEqual(selectorRoles("h1, body"), ["heading", "body"]);
  assert.deepEqual(familyOf('"Space Grotesk", system-ui'), { family: "Space Grotesk", stack: '"Space Grotesk", system-ui' });
  assert.equal(familyOf("var(--font-heading), sans-serif"), null, "a stack that starts in a variable names no face");
  assert.equal(familyOf("inherit"), null);

  // The reading of a stylesheet itself: the groups are descended into and the
  // at-rules that are not groups are left alone.
  const rules = cssRules(BRAND_CSS);
  assert.deepEqual(rules.map((r) => r.selector), [":root", ".card", "h1, h2", "body", "h3", ".pill", "h1"]);
  assert.deepEqual(rules[2].declarations, [
    { name: "font-family", value: '"Space Grotesk", system-ui, sans-serif' },
    { name: "font-weight", value: "700" },
  ]);
});

test("every statement carries the address, the place and the count, and the legal lines are the exact text", () => {
  const statements = readStatements(wholeSite());

  for (const statement of [...statements.mark, ...statements.color, ...statements.type, ...statements.legal]) {
    assert.ok(statement.where.startsWith("https://"), `a statement is kept with the address it was found at: ${JSON.stringify(statement)}`);
    assert.ok(statement.place && statement.place.length > 2, "a statement is kept with the place within that address");
    assert.ok(Number.isInteger(statement.count) && statement.count >= 1, "a statement is kept with how many times it was seen");
  }

  assert.deepEqual(statements.legal.map((l) => [l.kind, l.text, l.count, l.place]), [
    ["copyright", "© 2026 Meridian Analytics. All rights reserved.", 2, "the footer"],
    ["trademark", "Meridian Analytics®", 1, "the first mention on the home page"],
  ]);
  assert.equal(footerCopyright("<footer><p>Copyright 2026 Meridian</p></footer>"), "Copyright 2026 Meridian");
  assert.equal(footerCopyright('<div role="contentinfo"><small>&copy; 2026 Meridian</small></div>'), "© 2026 Meridian");
  assert.equal(footerCopyright("<p>&copy; 2026 Meridian</p>"), null, "the copyright line is the one in the footer");
  assert.equal(firstTrademark("<p>Meridian Analytics&trade; is a trademark.</p>"), "Meridian Analytics™");
  assert.equal(firstTrademark("<p>Nothing is claimed here.</p>"), null);

  // The counts are in the record as well as in the printed line, so the report
  // can say that a site states seven colors and names three of them without
  // counting them itself.
  // The three theme colors fill a role too, and they fill it by their PLACE:
  // the manifest field called theme_color holds the theme color, and so does a
  // meta tag named theme-color. The role travels with the statement from here,
  // because the step that writes the profile reads no names of its own.
  assert.deepEqual(statements.counts, { mark: 5, color: 7, color_filling_a_role: 6, type: 4, legal: 2 });
  for (const [kind, n] of Object.entries(statements.counts)) {
    if (kind === "color_filling_a_role") continue;
    assert.equal(statements[kind].length, n, `the ${kind} count is what is in the record`);
  }
  assert.equal(statements.color.filter((c) => c.role).length, statements.counts.color_filling_a_role);

  assert.deepEqual(statements.looked_for, LOOKED_FOR);
  assert.deepEqual(statements.not_found, [], "this site states all six");
  assert.equal(summarise(statements), "read 18 statements from https://meridian.example/: 5 marks, 7 colors of which 6 fill a role, 4 faces, 2 legal lines");
});

test("a site that states nothing is a real answer and not an error", () => {
  const nothing = readStatements(fetched([resource("p1", "page", "https://meridian.example/", BARE, { role: "home" })]));
  assert.deepEqual(nothing.mark, []);
  assert.deepEqual(nothing.color, []);
  assert.deepEqual(nothing.type, []);
  assert.deepEqual(nothing.legal, []);
  assert.deepEqual(nothing.not_found, LOOKED_FOR, "all six were looked for and none was found");
  assert.match(summarise(nothing), /^https:\/\/meridian\.example\/ states nothing about itself: looked for the theme color, /);

  // A site that states some of the six says which ones it did not.
  const thin = readStatements(fetched([
    resource("p1", "page", "https://meridian.example/", `<html><head><meta name="theme-color" content="#1F6FEB"></head><body><p>Words.</p></body></html>`, { role: "home" }),
  ]));
  assert.equal(thin.color.length, 1);
  assert.deepEqual(thin.not_found, LOOKED_FOR.filter((w) => w !== "the theme color"));

  // A record that is not a record is a refusal, because reading a brand from
  // nothing at all is not an empty answer, it is a broken step.
  assert.throws(() => readStatements({}), (e) => e instanceof Refusal && /names no resources/.test(e.message));
  assert.throws(() => readStatements(fetched([])), /nothing was fetched from the site/);
});

test("run from the shell, it writes the statements and puts no local path in them", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-statements-"));
  try {
    const from = join(dir, "records", "job-1", "fetched.json");
    const out = join(dir, "records", "job-1", "statements.json");
    const run = (env) => spawnSync(process.execPath, [script], { env: { ...process.env, FETCHED: from, OUT: out, ...env }, encoding: "utf8" });
    mkdirSync(dirname(from), { recursive: true });
    writeFileSync(from, `${JSON.stringify(wholeSite(), null, 2)}\n`);

    const ran = run({});
    assert.equal(ran.status, 0, ran.stderr);
    assert.match(ran.stdout, /^read 18 statements from https:\/\/meridian\.example\/: 5 marks, 7 colors of which 6 fill a role, 4 faces, 2 legal lines/m);

    const written = readFileSync(out, "utf8");
    assert.ok(!written.includes(dir), "the folder the statements were written to is in the statements");
    assert.ok(!written.includes(dir.replace(/\\/g, "\\\\")), "the folder the statements were written to is in the statements");
    assert.ok(!written.includes(tmpdir()), "a local path is in the statements");
    assert.ok(!written.includes("—"), "nothing a person reads carries an em dash");
    const statements = JSON.parse(written);
    assert.equal(statements.statements, "v1");
    assert.equal(statements.mark.length, 5);

    // A site that states nothing still writes a file and still exits nought.
    writeFileSync(from, `${JSON.stringify(fetched([resource("p1", "page", "https://meridian.example/", BARE, { role: "home" })]), null, 2)}\n`);
    const empty = run({});
    assert.equal(empty.status, 0, empty.stderr);
    assert.match(empty.stdout, /states nothing about itself: looked for /);
    const quiet = JSON.parse(readFileSync(out, "utf8"));
    assert.deepEqual(quiet.mark, []);
    assert.deepEqual(quiet.not_found, LOOKED_FOR);

    // A refusal is one plain sentence, and it names the file and never the
    // folder this agent keeps its work in.
    const missing = run({ FETCHED: join(dir, "records", "job-2", "fetched.json") });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /^refused: there is no file named fetched\.json to read the fetched pages from/);
    assert.ok(!missing.stderr.includes(dir), "a refusal never prints where this agent keeps its work");

    writeFileSync(from, "not json at all");
    const broken = run({});
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /^refused: fetched\.json is not JSON/);

    const noSettings = run({ FETCHED: "" });
    assert.equal(noSettings.status, 2);
    assert.match(noSettings.stderr, /^refused: FETCHED is required/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
