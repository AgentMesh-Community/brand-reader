// Looking at what a site renders, without opening one.
//
// What is worth pinning: the five colors and the two font stacks a site sets on
// its own elements read as STATEMENTS, in the shape the statements step emits
// and with the element and the page in the evidence; a heading in the same color as body text
// stating nothing separate; the contrast maths against the pairs WCAG is
// checked with; the colors tallied by the share of the page they cover; four
// blues across five pages read as ONE finding that names all four; a color the
// site states and no page shows read as a finding; a page that will not open
// named with its reason rather than filled in from the others; and a run where
// none opened saying so and carrying no observations at all. The page reader
// is a parameter, so all of it runs with no browser and no network.
// Run: node --test test/observe.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  DEFINITIONAL, DISAGREEMENTS, colorShare, contrastRatio, contrastsSeen, disagreements, facesSeen,
  firstFamily, hueName, observe, organisationInCopyright, pagesFromFetched, parseColor,
  relativeLuminance, sameOrganisation, stated, statedByThePages, statedColors, statedFaces,
  toHex, untilPainted, withoutPaths,
} from "../scripts/observe.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "observe.mjs");

const HEADING = '"Space Grotesk", system-ui, sans-serif';
const BODY = '"IBM Plex Sans", system-ui, sans-serif';

/** One page as the reader gives it back: a white ground, a blue on it, ink
 *  headings and grey body text. The five places the page sets on its own
 *  elements are the same on every page, except the blue in the grid, so a
 *  fixture that disagrees with itself has to say so. */
function page(url, blue, over = {}) {
  return {
    url,
    cells: 6144,
    colors: [{ value: "rgb(255, 255, 255)", cells: 5000 }, { value: blue, cells: 900 }, { value: "#101317", cells: 244 }],
    text: [
      { role: "heading", family: HEADING, color: "#101317", ground: "#ffffff", size_px: 40, weight: "700", seen: 2 },
      { role: "body", family: BODY, color: "#767676", ground: "#ffffff", size_px: 16, weight: "400", seen: 9 },
    ],
    definitional: [
      { role: "ink", value: "#101317", selector: "body" },
      { role: "ground", value: "#ffffff", selector: "body" },
      { role: "heading", value: "#101317", selector: "h1" },
      { role: "link", value: "#1f6feb", selector: "p a" },
      { role: "button", value: "#1f6feb", selector: "button" },
    ],
    stacks: [
      { role: "body", stack: BODY, selector: "body" },
      { role: "heading", stack: HEADING, selector: "h1" },
    ],
    mark: "https://meridian.example.com/brand/mark.svg",
    copyright: "© 2026 Meridian Analytics. All rights reserved.",
    ...over,
  };
}

const FOUR_BLUES = ["#1f6feb", "#2d7ff9", "#0b5cd5", "#4f8ff7", "#1f6feb"];
const fivePages = () => FOUR_BLUES.map((blue, i) => page(`https://meridian.example.com/p${i}`, blue));

const themeColor = (value) => ({
  site: "https://meridian.example.com/",
  color: [{ name: "theme_color", value, hex: value, where: "https://meridian.example.com/site.webmanifest", place: "theme_color in the web app manifest", count: 1 }],
});

test("the five colors a site sets on its own elements are statements, with the element and the page", () => {
  const { color } = statedColors(fivePages());
  assert.deepEqual(color.map((c) => c.role), ["ink", "ground", "link", "button"]);

  const ink = color.find((c) => c.role === "ink");
  assert.deepEqual(Object.keys(ink), ["name", "role", "value", "hex", "where", "place", "count", "pages"], "the shape the statements step emits");
  assert.equal(ink.name, DEFINITIONAL.ink.says);
  assert.equal(ink.value, "#101317");
  assert.equal(ink.hex, "#101317");
  assert.equal(ink.where, "https://meridian.example.com/p0", "the page it was read on");
  assert.equal(ink.place, "body { color }, as the page renders it", "the element it was read off");
  assert.equal(ink.count, 5, "five pages that agree are one statement seen five times");
  assert.deepEqual(ink.pages, FOUR_BLUES.map((_, i) => `https://meridian.example.com/p${i}`),
    "and the pages themselves, because the step after this one names which pages stated which value");

  const link = color.find((c) => c.role === "link");
  assert.equal(link.value, "#1F6FEB", "every color is named the same way once it is in a statement");
  assert.equal(link.place, "p a { color }, as the page renders it");
  assert.equal(color.find((c) => c.role === "button").place, "button { background-color }, as the page renders it");
  assert.equal(color.find((c) => c.role === "ground").place, "body { background-color }, as the page renders it");

  // A heading in the color of body text is body text in a larger size.
  assert.ok(!color.some((c) => c.role === "heading"), "a heading that matches the ink is a separate statement");

  assert.deepEqual(statedColors(), { color: [] });
  assert.deepEqual(statedColors([{ url: "https://meridian.example.com/" }]), { color: [] }, "a page the reader gave nothing back for states nothing");
});

test("the font stack a site asks for on its own elements is a statement, and the face a browser resolved is not", () => {
  const { type } = statedFaces(fivePages());
  assert.deepEqual(type.map((t) => t.role), ["body", "heading"]);

  const heading = type.find((t) => t.role === "heading");
  assert.deepEqual(Object.keys(heading), ["role", "family", "stack", "where", "place", "count", "pages"], "the shape the statements step emits");
  assert.equal(heading.family, "Space Grotesk", "the face it asks for first, without its quotes");
  assert.equal(heading.stack, HEADING, "and the whole stack, which the profile writes as the fallback");
  assert.equal(heading.where, "https://meridian.example.com/p0");
  assert.equal(heading.place, "h1 { font-family }, as the page renders it");
  assert.equal(heading.count, 5);
  assert.equal(type.find((t) => t.role === "body").family, "IBM Plex Sans");

  // Pages that ask for different stacks have stated two.
  const two = fivePages();
  two[2].stacks = [{ role: "heading", stack: '"Inter", system-ui, sans-serif', selector: "h2" }];
  const asked = statedFaces(two).type.filter((t) => t.role === "heading");
  assert.deepEqual(asked.map((t) => t.family), ["Space Grotesk", "Inter"]);
  assert.deepEqual(asked.map((t) => t.count), [4, 1]);
  assert.deepEqual(asked.map((t) => t.pages.length), [4, 1], "and which pages asked for which");
  assert.deepEqual(asked[1].pages, ["https://meridian.example.com/p2"]);

  assert.deepEqual(statedFaces(), { type: [] });
  assert.deepEqual(statedFaces([{ url: "x", stacks: [{ role: "caption", stack: "Inter", selector: "figcaption" }] }]).type, [], "only the two places are read");
  assert.deepEqual(Object.keys(statedByThePages(fivePages())), ["color", "type"]);
});

test("pages that set different inks state two, and a heading that differs is its own statement", () => {
  const pages = fivePages();
  pages[3].definitional = [
    { role: "ink", value: "rgb(51, 51, 51)", selector: "body" },
    { role: "ground", value: "#ffffff", selector: "body" },
    { role: "heading", value: "#0b5cd5", selector: "h2" },
  ];
  const { color } = statedColors(pages);

  const inks = color.filter((c) => c.role === "ink");
  assert.equal(inks.length, 2, "the site has stated two inks, and the step after this one carries neither");
  assert.deepEqual(inks.map((c) => c.value), ["#101317", "#333333"]);
  assert.deepEqual(inks.map((c) => c.count), [4, 1]);

  const heading = color.find((c) => c.role === "heading");
  assert.equal(heading.value, "#0B5CD5", "a heading color that differs from the ink is stated");
  assert.equal(heading.where, "https://meridian.example.com/p3");
  assert.equal(heading.place, "h2 { color }, as the page renders it");
});

test("a color set at less than full opacity is the color it paints over the ground", () => {
  const read = (definitional) => statedColors([{ url: "https://meridian.example.com/", definitional }]).color;

  const over = read([
    { role: "ink", value: "rgba(0, 0, 0, 0.5)", selector: "body" },
    { role: "ground", value: "#ffffff", selector: "body" },
  ]);
  assert.equal(over.find((c) => c.role === "ink").value, "#808080", "black at half alpha on white is the grey a reader sees");

  // A page that paints no ground has stated none. The white a browser falls
  // back to is the browser's white, and the text on it is read over that.
  const bare = read([{ role: "ink", value: "rgba(0, 0, 0, 0.5)", selector: "body" }]);
  assert.deepEqual(bare.map((c) => c.role), ["ink"], "no ground is stated for a page that paints none");
  assert.equal(bare[0].value, "#808080");

  // A color this cannot read is left out rather than half read.
  assert.deepEqual(read([{ role: "ink", value: "rebeccapurple", selector: "body" }]), []);
  assert.deepEqual(read([{ role: "surface", value: "#ffffff", selector: "div" }]), [], "only the five places are read");
});

test("the contrast maths gives the ratios WCAG is checked with", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#000000"), 21, "the ratio is the same either way round");
  assert.equal(contrastRatio("#767676", "#ffffff"), 4.54, "the grey that just passes AA on white");
  assert.equal(contrastRatio("#595959", "#ffffff"), 7, "the grey that just passes AAA on white");
  assert.equal(contrastRatio("#1f6feb", "#ffffff"), 4.63);
  assert.equal(contrastRatio("#1f6feb", "#1f6feb"), 1, "a color on itself");
  assert.equal(contrastRatio("rgb(0, 0, 0)", "rgb(255, 255, 255)"), 21, "as a computed style gives it");
  assert.equal(contrastRatio("#fff", "#000"), 21, "three digit hex");

  // Text that is not fully opaque is laid over its ground, because that is what
  // a reader sees. Black at half alpha on white is the grey it looks like,
  // which is half of 255 rounded up to 128.
  assert.equal(contrastRatio("rgba(0, 0, 0, 0.5)", "#ffffff"), contrastRatio("#808080", "#ffffff"));
  assert.equal(contrastRatio("rgba(0, 0, 0, 0.5)", "#ffffff"), 3.95);
  assert.equal(contrastRatio("rebeccapurple", "#ffffff"), null, "a color this cannot read is not guessed at");

  assert.equal(relativeLuminance("#ffffff"), 1);
  assert.equal(relativeLuminance("#000000"), 0);
  assert.deepEqual(parseColor("#1F6FEB"), { r: 31, g: 111, b: 235, a: 1 });
  assert.deepEqual(parseColor("rgba(31, 111, 235, 0.5)"), { r: 31, g: 111, b: 235, a: 0.5 });
  assert.equal(toHex("rgb(31, 111, 235)"), "#1f6feb", "every color is named the same way once it is in a record");
});

test("a near black ink is a neutral and not a blue", () => {
  assert.equal(hueName("#1f6feb"), "blue");
  assert.equal(hueName("#e9c46a"), "orange");
  assert.equal(hueName("#2a9d8f"), "teal");
  assert.equal(hueName("#ffffff"), null);
  assert.equal(hueName("#767676"), null);
  assert.equal(hueName("#fafbfc"), null, "an off white is a neutral");
  assert.equal(hueName("#101317"), null, "an ink with a breath of blue in it is not a blue");
});

test("the colors are tallied by the share of the page they cover", () => {
  const pages = fivePages();
  const share = colorShare(pages);
  assert.equal(share[0].color, "#ffffff", "the biggest first");
  assert.equal(share[0].share, Math.round((25000 / (6144 * 5)) * 10000) / 10000);
  assert.equal(share[0].pages.length, 5);
  assert.deepEqual(Object.keys(share[0]), ["color", "share", "cells", "pages"]);

  const blue = share.find((c) => c.color === "#1f6feb");
  assert.equal(blue.pages.length, 2, "the blue on two of the five pages is on two of them");
  assert.equal(blue.cells, 1800);
  assert.ok(share.every((c) => c.share <= 1));

  const faces = facesSeen(pages);
  assert.deepEqual(faces.heading.map((f) => f.face), ["Space Grotesk"]);
  assert.deepEqual(faces.body.map((f) => f.face), ["IBM Plex Sans"]);
  assert.equal(faces.heading[0].seen, 10, "twice a page over five pages");
  assert.equal(firstFamily(HEADING), "Space Grotesk");

  const contrast = contrastsSeen(pages);
  assert.equal(contrast[0].ratio, 4.54, "the worst pairing first");
  assert.deepEqual(contrast[0].roles, ["body"]);
  assert.equal(contrast.length, 2);
});

test("four blues across five pages are one finding, and it names all four", () => {
  const found = disagreements({ pages: fivePages(), statements: {} });
  const blues = found.filter((d) => d.what === DISAGREEMENTS[0]);
  assert.equal(blues.length, 1, "one finding, not four");
  assert.equal(blues[0].role, "blue");
  assert.deepEqual(blues[0].values, ["#0b5cd5", "#1f6feb", "#2d7ff9", "#4f8ff7"]);
  assert.match(blues[0].says, /^Four blues are used across the five pages that were opened: /);
  for (const value of blues[0].values) assert.ok(blues[0].says.includes(value), `${value} is not named in the finding`);
  assert.equal(blues[0].where.length, 5);

  // Nothing is resolved: no finding picks one of them.
  assert.ok(!/primary|should|use /i.test(blues[0].says));

  const one = disagreements({ pages: FOUR_BLUES.map((_, i) => page(`https://meridian.example.com/p${i}`, "#1f6feb")), statements: {} });
  assert.deepEqual(one.filter((d) => d.what === DISAGREEMENTS[0]), [], "one blue on every page is not a disagreement");
});

test("a color the site states and no page shows is a finding", () => {
  const pages = fivePages();
  const found = disagreements({ pages, statements: themeColor("#7F5AF0") });
  const missing = found.filter((d) => d.what === DISAGREEMENTS[2]);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].role, "theme_color");
  assert.deepEqual(missing[0].values, ["#7F5AF0"]);
  assert.equal(missing[0].says, "The site states #7F5AF0 for theme_color and none of the five pages that were opened shows it.");
  assert.deepEqual(missing[0].where, ["https://meridian.example.com/site.webmanifest"]);

  const shown = disagreements({ pages, statements: themeColor("#1F6FEB") });
  assert.deepEqual(shown.filter((d) => d.what === DISAGREEMENTS[2]), [], "a stated color the pages do show is not a finding");

  // A color this cannot read is not checked at all. Saying a named color
  // appears nowhere, when it was never compared, would be a finding made up.
  const named = disagreements({ pages, statements: themeColor("rebeccapurple") });
  assert.deepEqual(named.filter((d) => d.what === DISAGREEMENTS[2]), []);
});

test("two heading faces, a mark that differs, and a copyright naming somebody else are findings", () => {
  const pages = fivePages();
  pages[3].text[0].family = '"Inter", system-ui, sans-serif';
  pages[4].mark = "https://meridian.example.com/brand/mark-2024.svg";
  const found = disagreements({ pages, statements: {} });

  const faces = found.filter((d) => d.what === DISAGREEMENTS[1]);
  assert.equal(faces.length, 1);
  assert.deepEqual(faces[0].values.sort(), ["Inter", "Space Grotesk"]);

  const marks = found.filter((d) => d.what === DISAGREEMENTS[3]);
  assert.equal(marks.length, 1);
  assert.equal(marks[0].values.length, 2);

  const named = { site: "https://meridian.example.com/", legal: [{ kind: "trademark", text: "Meridian Analytics®", where: "https://meridian.example.com/", place: "the first mention on the home page", count: 1 }] };
  const same = disagreements({ pages: fivePages(), statements: named });
  assert.deepEqual(same.filter((d) => d.what === DISAGREEMENTS[4]), [], "the same organisation with a trademark symbol is the same organisation");

  const other = fivePages().map((p) => ({ ...p, copyright: "© 2026 Northwind Holdings Ltd. All rights reserved." }));
  const wrong = disagreements({ pages: other, statements: named }).filter((d) => d.what === DISAGREEMENTS[4]);
  assert.equal(wrong.length, 1);
  assert.equal(wrong[0].says, "The copyright line names Northwind Holdings Ltd and the page names itself Meridian Analytics®.");

  assert.equal(organisationInCopyright("© 2026 Meridian Analytics. All rights reserved."), "Meridian Analytics");
  assert.equal(organisationInCopyright("Copyright (c) 2019-2026 Northwind Holdings Ltd"), "Northwind Holdings Ltd");
  assert.equal(organisationInCopyright(""), null);
  assert.ok(sameOrganisation("Meridian Analytics", "Meridian Analytics®"));
  assert.ok(!sameOrganisation("Meridian Analytics", "Northwind Holdings"));
});

test("the site saying a thing about itself twice and differently is a finding", () => {
  const twice = {
    site: "https://meridian.example.com/",
    color: [
      { name: "--color-primary", value: "#1f6feb", hex: "#1F6FEB", where: "https://meridian.example.com/a.css", place: ":root { --color-primary }", count: 2 },
      { name: "--color-primary", value: "#2d7ff9", hex: "#2D7FF9", where: "https://meridian.example.com/b.css", place: ":root { --color-primary }", count: 1 },
    ],
  };
  const found = disagreements({ pages: fivePages(), statements: twice });
  const role = found.filter((d) => d.role === "--color-primary");
  assert.equal(role.length, 1);
  assert.equal(role[0].what, DISAGREEMENTS[0]);
  assert.deepEqual(role[0].values, ["#1F6FEB", "#2D7FF9"]);
  assert.deepEqual(role[0].where, ["https://meridian.example.com/a.css", "https://meridian.example.com/b.css"]);

  assert.deepEqual(stated(twice).colors.map((c) => c.value), ["#1F6FEB", "#2D7FF9"]);
  assert.deepEqual(stated({}).colors, [], "a record with nothing in it states nothing");
});

test("a family the site names without saying where it goes is not a body face", () => {
  // A font service link names its families in the address and says nothing
  // about their use. Reading those as body text would make a site that links
  // two families and declares one report three body faces, and then a
  // disagreement between faces that never disagreed.
  const linked = {
    site: "https://meridian.example.com/",
    type: [
      { family: "Space Grotesk", stack: "Space Grotesk", where: "https://fonts.example.com/css2?family=Space+Grotesk&family=Inter", place: "the font service link", count: 1 },
      { family: "Inter", stack: "Inter", where: "https://fonts.example.com/css2?family=Space+Grotesk&family=Inter", place: "the font service link", count: 1 },
      { role: "body", family: "IBM Plex Sans", stack: '"IBM Plex Sans", system-ui', where: "https://meridian.example.com/a.css", place: "body { font-family }", count: 1 },
    ],
  };
  assert.deepEqual(stated(linked).faces.map((f) => f.role), [null, null, "body"], "a family with no role keeps no role");

  const found = disagreements({ pages: [], statements: linked });
  assert.deepEqual(found, [], "three families, one of them said to be the body face, is no disagreement at all");

  // And when the site really does declare two body faces, that is one finding.
  const two = { ...linked, type: [...linked.type, { role: "body", family: "Inter", stack: "Inter", where: "https://meridian.example.com/b.css", place: "body { font-family }", count: 1 }] };
  const body = disagreements({ pages: [], statements: two });
  assert.equal(body.length, 1, "one finding at most, never three");
  assert.deepEqual(body[0].values, ["IBM Plex Sans", "Inter"]);
});

test("the pages are opened by the reader it is given, and one that will not open is named", async () => {
  const pages = fivePages();
  const asked = [];
  const readPage = async (url) => {
    asked.push(url);
    if (url.endsWith("p2")) throw new Error("the page answered 500");
    return pages.find((p) => p.url === url);
  };
  const record = await observe({
    addresses: pages.map((p) => p.url),
    statements: themeColor("#7F5AF0"),
    readPage,
    now: () => new Date("2026-09-12T10:00:00Z"),
  });
  assert.equal(asked.length, 5, "every address is opened");
  assert.equal(record.opened, true);
  assert.equal(record.observed_at, "2026-09-12T10:00:00.000Z");
  assert.equal(record.pages.length, 4);
  assert.deepEqual(record.not_opened, [{ url: "https://meridian.example.com/p2", why: "the page answered 500" }]);
  assert.equal(record.why, undefined);
  assert.ok(record.colors.length && record.contrast.length);
  assert.equal(record.faces.heading[0].face, "Space Grotesk");
  assert.ok(record.disagreements.some((d) => d.what === DISAGREEMENTS[2]));

  // The statements ride in the record beside the observations, from the four
  // pages that opened and not from the five that were asked for.
  assert.deepEqual(record.statements.color.map((c) => c.role), ["ink", "ground", "link", "button"]);
  assert.ok(record.statements.color.every((c) => c.count === 4));
  assert.deepEqual(record.statements.type.map((t) => t.family), ["IBM Plex Sans", "Space Grotesk"]);

  // The page that would not open is not filled in from the four that did.
  assert.ok(!record.pages.some((p) => p.url.endsWith("p2")));
  assert.ok(record.colors.every((c) => !c.pages.includes("https://meridian.example.com/p2")));
});

test("when no page opens, nothing is observed and the record says why", async () => {
  const record = await observe({
    addresses: ["https://meridian.example.com/", "https://meridian.example.com/about"],
    statements: themeColor("#7F5AF0"),
    readPage: async () => { throw new Error("chromium would not start\nand this second line is not carried"); },
  });
  assert.equal(record.opened, false);
  assert.equal(record.why, "chromium would not start");
  assert.deepEqual(record.pages, []);
  assert.equal(record.not_opened.length, 2);
  assert.deepEqual(record.colors, []);
  assert.deepEqual(record.contrast, []);
  assert.deepEqual(record.disagreements, [], "nothing is found when nothing was seen");
  assert.deepEqual(record.faces, { heading: [], body: [] });
  assert.deepEqual(record.statements, { color: [], type: [] }, "a page nobody opened sets nothing on its own elements");

  const nothing = await observe({ addresses: [], readPage: async () => ({}) });
  assert.equal(nothing.why, "there was no page to open");
});

test("no local path reaches the record", async () => {
  const record = await observe({
    addresses: ["https://meridian.example.com/"],
    readPage: async () => { throw new Error("Cannot find module C:\\Users\\someone\\deps\\node_modules\\playwright-core at https://meridian.example.com/"); },
  });
  assert.ok(!JSON.stringify(record).includes("Users"), "a path on this host is in the record");
  assert.match(record.why, /a local file/);
  assert.match(record.why, /https:\/\/meridian\.example\.com\//, "a web address is not a path and stays");
  assert.equal(withoutPaths("read /opt/fleet/brand.json and C:\\work\\a.txt"), "read a local file and a local file");
});

test("the pages to open are the fetch record's pages, over https and with no credential in them", () => {
  const fetched = {
    fetched: "v1",
    site: "https://meridian.example.com/",
    resources: [
      { id: "p1", kind: "page", role: "home", address: "https://meridian.example.com/", media_type: "text/html" },
      { id: "p2", kind: "page", address: "https://meridian.example.com/about", media_type: "text/html" },
      { id: "p3", kind: "page", address: "https://meridian.example.com/about", media_type: "text/html" },
      { id: "s1", kind: "stylesheet", address: "https://meridian.example.com/a.css", media_type: "text/css" },
      { id: "m1", kind: "manifest", address: "https://meridian.example.com/site.webmanifest", media_type: "application/manifest+json" },
      { id: "p4", kind: "page", address: "http://meridian.example.com/plain", media_type: "text/html" },
      { id: "p5", kind: "page", address: "https://user:secret@meridian.example.com/private", media_type: "text/html" },
    ],
  };
  assert.deepEqual(pagesFromFetched(fetched), ["https://meridian.example.com/", "https://meridian.example.com/about"]);
  assert.deepEqual(pagesFromFetched({}), []);
  assert.deepEqual(pagesFromFetched({ pages: [{ url: "https://meridian.example.com/" }] }), ["https://meridian.example.com/"]);
});

test("run from the shell with no browser, it refuses and writes no observations file", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-observe-"));
  try {
    const fetched = join(dir, "fetched.json");
    const statements = join(dir, "statements.json");
    const out = join(dir, "observations.json");
    writeFileSync(fetched, JSON.stringify({ resources: [{ id: "p1", kind: "page", address: "https://meridian.example.com/", media_type: "text/html" }] }));
    writeFileSync(statements, JSON.stringify(themeColor("#7F5AF0")));
    // AGENT_DEPS names a tree with no browser driver in it, so nothing opens a
    // page and nothing reaches the network.
    const env = { ...process.env, AGENT_DEPS: join(dir, "deps"), FETCHED: fetched, STATEMENTS: statements, OUT: out };

    const r = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.notEqual(r.status, 0, "the job carries on, and this step says it could not finish");
    assert.match(r.stderr, /^refused: none of the 1 pages would open/);
    assert.match(r.stderr, /browser driver/);
    assert.ok(!r.stderr.includes("node_modules"), "the refusal names no path on this host");
    assert.ok(!existsSync(out), "an observations file was written for a run that observed nothing");

    const settings = spawnSync(process.execPath, [script], { env: { ...env, OUT: "" }, encoding: "utf8" });
    assert.equal(settings.status, 2);
    assert.match(settings.stderr, /^refused: FETCHED, STATEMENTS and OUT are required/);

    writeFileSync(fetched, JSON.stringify({ resources: [{ id: "s1", kind: "stylesheet", address: "https://meridian.example.com/a.css" }] }));
    const empty = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /^refused: the fetch record names no page to open/);

    writeFileSync(fetched, "{ this is not json");
    const broken = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /^refused: the fetch record could not be read/);
    assert.ok(!existsSync(out));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a run that opened its pages writes the record the next step reads", async () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-observe-record-"));
  try {
    const pages = fivePages();
    const record = await observe({
      addresses: pages.map((p) => p.url),
      statements: themeColor("#7F5AF0"),
      readPage: async (url) => pages.find((p) => p.url === url),
      now: () => new Date("2026-09-12T10:00:00Z"),
    });
    const out = join(dir, "observations.json");
    writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
    const read = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(read.observations, "v1");
    assert.equal(read.pages.length, 5, "the counts behind each observation are kept");
    assert.equal(read.pages[0].cells, 6144);
    assert.equal(read.pages[0].colors.length, 3);
    assert.equal(read.pages[0].definitional.length, 5, "what was read off each page is kept beside what it added up to");
    assert.equal(read.pages[0].stacks.length, 2);
    assert.ok(read.disagreements.length);
    assert.equal(read.statements.color.length, 4, "the step after this one reads these as statements");
    assert.equal(read.statements.type.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A page whose network NEVER goes quiet, which is what a marketing page is:
 *  analytics, an embedded video and a chat widget hold connections open for as
 *  long as the page is open. Waiting for networkidle on one of these runs to
 *  the timeout and throws, and the page has rendered perfectly well the whole
 *  time. */
function neverIdle({ paints = true, heading = true, reading = { cells: 1 } } = {}) {
  const did = [];
  return {
    did,
    goto: async (url, { waitUntil, timeout }) => {
      did.push(waitUntil);
      if (waitUntil === "networkidle") throw new Error(`page.goto: Timeout ${timeout}ms exceeded`);
      return { ok: () => true, status: () => 200 };
    },
    waitForFunction: async (_fn, _arg, { timeout }) => {
      if (paints && heading) return true;
      throw new Error(`page.waitForFunction: Timeout ${timeout}ms exceeded`);
    },
    waitForTimeout: async (ms) => { did.push(`settled ${ms}`); },
    evaluate: async () => reading,
  };
}

test("a page whose network never settles is still read, because the wait is for the paint and not the quiet", async () => {
  const page = neverIdle();
  const open = await untilPainted(page, "https://www.langchain.com/blog/a-post", { paint: 50, settle: 5 });
  assert.equal(open, page);
  assert.deepEqual(page.did, ["domcontentloaded", "settled 5"], "the navigation waits for the document and nothing more");
  assert.deepEqual(await page.evaluate(), { cells: 1 }, "and the reading is taken off it as it stands");

  // The paint is allowed to run out. A page that paints no ground of its own
  // has stated none, and a page with no heading has no heading: losing the
  // page over either would be the same mistake in a smaller coat.
  const bare = neverIdle({ paints: false, reading: { cells: 2 } });
  await untilPainted(bare, "https://www.langchain.com/blog/a-post", { paint: 50, settle: 5 });
  assert.deepEqual(await bare.evaluate(), { cells: 2 });

  // A page that genuinely refuses is still a page that will not open, and the
  // step above this one writes it down with its reason.
  const gone = { ...neverIdle(), goto: async () => ({ ok: () => false, status: () => 500 }) };
  await assert.rejects(() => untilPainted(gone, "https://meridian.example.com/", { paint: 50, settle: 5 }),
    /the page answered 500/);
});

test("one page that will not open costs that page and not the readings from the others", async () => {
  const pages = fivePages();
  const record = await observe({
    addresses: pages.map((p) => p.url),
    statements: themeColor("#1F6FEB"),
    readPage: async (url) => {
      if (url.endsWith("/p2")) throw new Error("page.goto: Timeout 45000ms exceeded");
      return pages.find((p) => p.url === url);
    },
    now: () => new Date("2026-09-12T10:00:00Z"),
  });
  assert.equal(record.opened, true);
  assert.equal(record.pages.length, 4);
  assert.deepEqual(record.not_opened, [{ url: "https://meridian.example.com/p2", why: "page.goto: Timeout 45000ms exceeded" }]);
  assert.ok(record.statements.color.length, "the four that opened still state their colors");
});
