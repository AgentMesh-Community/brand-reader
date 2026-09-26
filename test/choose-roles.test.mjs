// Choosing which of the declared colors is the primary and which is the accent,
// without a browser, a key or a network.
//
// What is worth pinning: only colors the site DECLARED are offered, and they
// are offered by number; a model that answers with a number outside the list is
// refused, told what was wrong and asked once more; a model that answers with a
// hex is refused the same way even though a hex looks like an answer, because
// the answer this step asked for is a number and a model that supplies colors
// can supply one the site never declared; two bad answers yield NOTHING rather
// than a guess; none is a real answer and comes back as a role left empty
// rather than a failure; the evidence on a chosen value says in words that a
// model chose it and the site did not; a role the site states for itself is
// never chosen for it; the ceiling is honoured; and every road that ends in no
// roles still writes the record with the reason in it, so the report can say
// which of no key, no browser and no answer it was.
// Run: node --test test/choose-roles.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  NONE, ROLE_NAMES, candidates, chooseRoles, chosenIn, colorLines, hexOf, homePage,
  jsonIn, pickOf, rolesRecord, rolesRequest, saidLine, statedRoles, takePicture,
} from "../scripts/choose-roles.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "choose-roles.mjs");

const SITE = "https://meridian.example.com/";

/** The statements record as the second step writes it: two custom properties,
 *  one of which names no role, and the theme color. */
const statements = (over = {}) => ({
  statements: "v1",
  site: SITE,
  color: [
    { name: "--brand-blue", value: "#1F6FEB", hex: "#1F6FEB", where: `${SITE}a.css`, place: ":root declares --brand-blue", count: 1 },
    { name: "theme_color", value: "#101317", hex: "#101317", where: `${SITE}manifest.webmanifest`, place: "theme_color in the web app manifest", count: 1 },
  ],
  type: [],
  ...over,
});

/** The observations record as the browser step writes it: the five the pages
 *  set on their own elements, already in the statements shape. */
const observations = (over = {}) => ({
  observations: "v1",
  opened: true,
  pages: [{ url: SITE }, { url: `${SITE}about` }],
  statements: {
    color: [
      { name: "the color of body text", role: "ink", value: "#101317", hex: "#101317", where: SITE, place: "body { color }, as the page renders it", count: 2 },
      { name: "the color behind body text", role: "ground", value: "#FFFFFF", hex: "#FFFFFF", where: SITE, place: "body { background-color }, as the page renders it", count: 2 },
      { name: "the background of the main call to action", role: "button", value: "#1F6FEB", hex: "#1F6FEB", where: SITE, place: "button { background-color }, as the page renders it", count: 2 },
    ],
    type: [],
  },
  ...over,
});

/** A service that answers with whatever is handed to it, and keeps every
 *  request so a test can look at what was actually sent. */
function service(...answers) {
  const sent = [];
  const call = async (req) => {
    sent.push(req);
    const next = answers[Math.min(sent.length - 1, answers.length - 1)];
    if (next instanceof Error) throw next;
    return { candidates: [{ content: { parts: [{ text: typeof next === "string" ? next : JSON.stringify(next) }] } }] };
  };
  return { call, sent };
}

const colorsOf = () => candidates({ statements: statements(), observations: observations() });

test("only colors the site declared are offered, each once, and the page-read ones come first", () => {
  const colors = colorsOf();
  assert.deepEqual(colors.map((c) => c.value), ["#101317", "#FFFFFF", "#1F6FEB"]);
  // The blue is declared twice, on a button and as a custom property, and it is
  // one color either way.
  assert.equal(colors.filter((c) => c.value === "#1F6FEB").length, 1);
  assert.equal(colors[0].says, "the color of body text");
  assert.equal(colors[2].says, "the background of the main call to action");
  assert.equal(hexOf("#1f6feb"), "#1F6FEB");
  assert.equal(hexOf("rgb(31, 111, 235)"), null);
  assert.equal(homePage({ statements: statements(), observations: observations() }), SITE);
});

test("the request carries the picture, the numbered colors and the rule that only a number is an answer", () => {
  const colors = colorsOf();
  const req = rolesRequest({ shot: "AAAA", colors, page: SITE });
  const parts = req.body.contents[0].parts;
  assert.deepEqual(parts.find((p) => p.inline_data).inline_data, { mime_type: "image/png", data: "AAAA" });
  const text = parts.filter((p) => p.text).map((p) => p.text).join("\n");
  assert.match(text, /1\. #101317/);
  assert.match(text, /3\. #1F6FEB/);
  assert.match(text, /The numbers 1 to 3 and the word none are the only answers there are/);
  assert.match(text, /Never write a color of your own/);
  assert.match(text, /None is a real answer/);
  // Nothing in the list beyond the three, so there is no fourth number to pick.
  assert.doesNotMatch(colorLines(colors), /^4\./m);
});

test("a color off the list is refused, named to the model, and asked once more", async () => {
  const colors = colorsOf();
  const { call, sent } = service({ primary: "9", accent: "3" }, { primary: "1", accent: "3" });
  const out = await chooseRoles({ shot: "AAAA", colors, page: SITE, call });
  assert.equal(out.asked, 2);
  assert.equal(out.chosen.primary.value, "#101317");
  assert.equal(out.chosen.accent.value, "#1F6FEB");
  const second = sent[1].body.contents[0].parts.map((p) => p.text ?? "").join("\n");
  assert.match(second, /it answered with color 9, and there are only three colors in the list/);
  assert.match(second, /Answer with the number of a color from the list, or the word none/);
});

test("a model that invents a hex is refused, and two bad answers yield nothing at all", async () => {
  const colors = colorsOf();
  const { call, sent } = service({ primary: "#FF6B35", accent: "2" }, { primary: "#FF6B35", accent: "2" });
  const out = await chooseRoles({ shot: "AAAA", colors, page: SITE, call });
  assert.equal(out.asked, 2);
  assert.deepEqual(out.chosen, {});
  assert.match(out.not_chosen, /asked twice/);
  assert.match(out.not_chosen, /answered with a color of its own, "#FF6B35"/);
  assert.match(sent[1].body.contents[0].parts.map((p) => p.text ?? "").join("\n"), /a color of its own/);
  // The hex it invented is in the record as something REFUSED, which is what a
  // person checking the run wants to see, and it is in neither role.
  const record = rolesRecord({ page: SITE, colors, out });
  assert.equal(record.primary, null);
  assert.equal(record.accent, null);
  assert.match(record.refused.join(" "), /#FF6B35/);
  assert.equal(JSON.stringify({ ...record, refused: [], not_chosen: "" }).includes("#FF6B35"), false);
});

test("a hex that IS in the list is refused too, because the answer asked for was a number", () => {
  const colors = colorsOf();
  assert.equal(pickOf("#1F6FEB", colors).at, null);
  assert.match(pickOf("#1F6FEB", colors).bad, /a color of its own/);
  assert.equal(pickOf("rgb(31, 111, 235)", colors).at, null);
  assert.equal(pickOf("2", colors).at, 1);
  assert.equal(pickOf("color 3", colors).at, 2);
  assert.match(pickOf("the teal one", colors).bad, /neither a number from the list nor none/);
});

test("none is an answer: the role is left empty and the run is not a failure", async () => {
  const colors = colorsOf();
  const { call } = service({ primary: "3", accent: "none", why: "one blue carries the page and nothing is used sparingly" });
  const out = await chooseRoles({ shot: "AAAA", colors, page: SITE, call });
  assert.equal(out.asked, 1);
  assert.equal(out.chosen.primary.value, "#1F6FEB");
  assert.equal(out.chosen.accent, undefined);
  assert.equal(out.faults.length, 0);
  assert.match(out.not_chosen_for, /the model said none of these colors is the accent/);

  const record = rolesRecord({ page: SITE, colors, out });
  assert.equal(record.accent, null);
  assert.equal(record.primary.value, "#1F6FEB");
  assert.match(saidLine(record), /chose #1F6FEB as the primary, out of the three colors these pages declare/);
});

test("none for both is an answer, and the record says the model looked and found neither", async () => {
  const colors = colorsOf();
  const { call } = service({ primary: NONE, accent: "" });
  const out = await chooseRoles({ shot: "AAAA", colors, page: SITE, call });
  assert.deepEqual(out.chosen, {});
  assert.match(out.not_chosen, /said none of the colors these pages declare fills either role/);
  const record = rolesRecord({ page: SITE, colors, out });
  assert.equal(record.primary, null);
  assert.equal(record.accent, null);
  assert.match(saidLine(record), /The roles were not chosen/);
});

test("the evidence on a chosen value says a model chose it and the site did not", async () => {
  const colors = colorsOf();
  const { call } = service({ primary: "3", accent: "1" });
  const out = await chooseRoles({ shot: "AAAA", colors, page: SITE, call });
  const words = "chosen from the three colors these pages declare, by a model reading the home page; the site does not say so itself";
  assert.equal(out.chosen.primary.in, words);
  assert.equal(chosenIn(6), "chosen from the six colors these pages declare, by a model reading the home page; the site does not say so itself");

  const record = rolesRecord({ page: SITE, colors, out });
  assert.deepEqual(record.primary, { value: "#1F6FEB", in: words, url: SITE });
  // The picture is a record and never an address in a record that travels.
  assert.doesNotMatch(JSON.stringify(record), /home-page\.png/);
});

test("a role the site states for itself is not chosen for it", async () => {
  const said = statements({
    color: [
      { name: "--color-primary", role: "primary", value: "#1F6FEB", hex: "#1F6FEB", where: `${SITE}a.css`, place: ":root declares --color-primary", count: 1 },
      { name: "--blue-400", value: "#3B82F6", hex: "#3B82F6", where: `${SITE}a.css`, place: ":root declares --blue-400", count: 1 },
    ],
  });
  assert.deepEqual(statedRoles(said), ["primary"]);
  const colors = candidates({ statements: said, observations: observations() });
  const { call, sent } = service({ primary: "1", accent: "4" });
  const out = await chooseRoles({ shot: "AAAA", colors, page: SITE, stated: statedRoles(said), call });
  assert.equal(sent.length, 1);
  assert.equal(out.chosen.primary, undefined);
  assert.equal(out.chosen.accent.value, "#3B82F6");
  // The model's answer for the primary was dropped, and nothing says it
  // declined a role it was never up for choosing.
  assert.equal(out.not_chosen, undefined);
  assert.equal(out.not_chosen_for, undefined);

  const declined = await chooseRoles({
    shot: "AAAA", colors, page: SITE, stated: statedRoles(said),
    call: service({ primary: "1", accent: "none" }).call,
  });
  assert.deepEqual(declined.chosen, {});
  assert.match(declined.not_chosen, /fills the accent$/);
});

test("a site that states both roles itself is not asked at all", async () => {
  const colors = colorsOf();
  const { call, sent } = service({ primary: "1", accent: "2" });
  const out = await chooseRoles({ shot: "AAAA", colors, page: SITE, stated: [...ROLE_NAMES], call });
  assert.equal(sent.length, 0);
  assert.deepEqual(out.chosen, {});
  assert.match(out.not_chosen, /states its own primary and its own accent/);
});

test("no picture and no color are both answers, and neither calls the service", async () => {
  const { call, sent } = service({ primary: "1", accent: "2" });
  const noShot = await chooseRoles({ shot: "", colors: colorsOf(), call });
  assert.match(noShot.not_chosen, /could not be opened to take a picture/);
  const noColors = await chooseRoles({ shot: "AAAA", colors: [], call });
  assert.match(noColors.not_chosen, /declare no color/);
  assert.equal(sent.length, 0);
});

test("the ceiling is honoured, and a ceiling with no room to ask again says which", async () => {
  const colors = colorsOf();
  const spent = await chooseRoles({ shot: "AAAA", colors, call: service({ primary: "1", accent: "2" }).call, ceiling: 2, sent: 2 });
  assert.match(spent.not_chosen, /ceiling of 2 calls per task was reached before a call could be made/);

  const { call, sent } = service({ primary: "9", accent: "2" });
  const tight = await chooseRoles({ shot: "AAAA", colors, call, ceiling: 1 });
  assert.equal(sent.length, 1);
  assert.deepEqual(tight.chosen, {});
  assert.match(tight.not_chosen, /left no room to ask again/);
});

test("a service that will not answer is a reason, not a crash", async () => {
  const { call } = service(new Error("the text-reasoning service is not answering"));
  const out = await chooseRoles({ shot: "AAAA", colors: colorsOf(), call });
  assert.deepEqual(out.chosen, {});
  assert.equal(out.not_chosen, "the text-reasoning service is not answering");

  const { call: nonsense } = service("I had a look and the blue is clearly the one");
  const said = await chooseRoles({ shot: "AAAA", colors: colorsOf(), call: nonsense });
  assert.match(said.not_chosen, /not JSON/);
  assert.equal(jsonIn('```json\n{"primary":"1","accent":"2"}\n```').primary, "1");
});

test("a browser that will not start is a reason with no local path in it", async () => {
  const shot = () => { throw new Error("the browser driver this package's lockfile names is not installed in C:\\Users\\someone\\deps"); };
  const { data, why } = await takePicture(SITE, { shot });
  assert.equal(data, "");
  assert.match(why, /not installed in a local file/);
  assert.doesNotMatch(why, /Users/);
});

test("the picture is taken once, kept where it was asked for, and read as base64", async () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-shot-"));
  try {
    const opened = [];
    const shot = () => ({
      shoot: async (url) => { opened.push(url); return Buffer.from("a picture"); },
      close: async () => {},
    });
    const keepAt = join(dir, "home-page.png");
    const { data, why } = await takePicture(SITE, { shot, keepAt });
    assert.deepEqual(opened, [SITE]);
    assert.equal(why, "");
    assert.equal(Buffer.from(data, "base64").toString(), "a picture");
    assert.equal(readFileSync(keepAt, "utf8"), "a picture");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run from the shell with no key, it writes the record with the reason and exits 0", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-roles-"));
  try {
    const statementsPath = join(dir, "statements.json");
    const observationsPath = join(dir, "observations.json");
    const out = join(dir, "roles.json");
    writeFileSync(statementsPath, JSON.stringify(statements()));
    writeFileSync(observationsPath, JSON.stringify(observations()));
    const r = spawnSync(process.execPath, [script], {
      env: { ...process.env, STATEMENTS: statementsPath, OBSERVATIONS: observationsPath, OUT: out, TEXT_API_KEY: "" },
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(out));
    const record = JSON.parse(readFileSync(out, "utf8"));
    assert.equal(record.roles, "v1");
    assert.equal(record.primary, null);
    assert.equal(record.accent, null);
    assert.equal(record.calls, 0);
    assert.match(record.not_chosen, /the key for the text-reasoning service is not set/);
    assert.equal(record.offered.length, 3);
    assert.match(r.stdout, /The roles were not chosen/);
    // The record travels. Nothing in it names a folder on this machine, and a
    // web address, which looks like a drive letter to a careless rule, survives.
    const text = JSON.stringify(record);
    assert.equal(text.includes(dir.replace(/\\/g, "\\\\")), false);
    assert.equal(text.includes("roles.json"), false);
    assert.doesNotMatch(text, /(^|[\s("'])[A-Za-z]:[\\/]/);
    assert.match(text, /https:\/\/meridian\.example\.com\//);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run from the shell against a site that declares nothing, it says that and writes no roles", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-roles-"));
  try {
    const statementsPath = join(dir, "statements.json");
    const out = join(dir, "roles.json");
    writeFileSync(statementsPath, JSON.stringify({ statements: "v1", site: SITE, color: [], type: [] }));
    const r = spawnSync(process.execPath, [script], {
      env: { ...process.env, STATEMENTS: statementsPath, OUT: out, TEXT_API_KEY: "a key that is never used" },
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    const record = JSON.parse(readFileSync(out, "utf8"));
    assert.deepEqual(record.offered, []);
    assert.match(record.not_chosen, /declare no color, so there was nothing to choose from/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("run from the shell with no settings at all, it refuses and says which are required", () => {
  const r = spawnSync(process.execPath, [script], { env: { ...process.env, STATEMENTS: "", OUT: "" }, encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /refused: STATEMENTS and OUT are required/);
});
