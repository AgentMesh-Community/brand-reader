// Choose the roles: which of the colors these pages declare is the site's
// primary, and which is its accent.
//   needs: node >= 22, the browser driver this package's lockfile names and the
//   host's chromium (to take one picture of the home page), network to the
//   text-reasoning service,
//   TEXT_API_KEY (the credential named text-reasoning-key, placed by the host),
//   CEILING_TEXT_REASONING (calls per task, when the owner set one)
//   STATEMENTS=records/<job>/statements.json [OBSERVATIONS=records/<job>/observations.json]
//   OUT=records/<job>/roles.json [SHOT=records/<job>/home-page.png] node choose-roles.mjs
//
// WHY THERE IS A MODEL HERE AND NOWHERE ELSE IN THIS AGENT. Every other
// judgment in this job is settled in references/what-counts.md as a rule a
// program can apply: what is a mark, what is a stated color, what face the site
// named. Primary and accent are the two that are not. They are assignments
// rather than places: no site declares which of its colors it considers its
// primary anywhere a reader can find, and the rules find nothing to apply. Run
// against a site whose blue is the entire reason anyone can tell it apart, this
// agent read every color exactly and wrote a profile with no accent in it,
// indistinguishable from a default. Salience is what eyes are for, so this step
// has eyes.
//
// WHAT THE MODEL MAY DO, AND WHAT IT MAY NOT. It is shown a picture of the home
// page and the colors the pages DECLARE, numbered, and it answers with a number
// or with the word none. It never supplies a color. The values in the list were
// read exactly, off the elements the site sets them on; the picture has been
// through antialiasing, an overlay and a gradient on its way out, so a hex read
// off it is not the hex the site declared, and one the model made up is not the
// site's at all. A model that answers with a color, or with a number that is
// not in the list, is refused, told what was wrong and asked once more, and
// then this step yields nothing and says so.
//
// NONE IS A REAL ANSWER, and it is the one this step is built to make easy. A
// page of black text on white with one grey button has no accent, and a model
// pressed to pick the closest thing would put a color in somebody's brand
// profile that nobody chose. That is the exact failure the rest of this agent
// exists to prevent, and it does not become acceptable because a model made it.
//
// THE STEP IS SKIPPABLE. No key, no browser, a site that declares no color, or
// a model that answers nothing, and the roles are simply not chosen: this
// writes its record saying which and why, exits 0, and the profile is written
// without them and is whole. Exit codes: 0 done, whether or not a role was
// chosen; 2 the settings are not right; 1 the record could not be written.
//
// No local file path is ever written into the record. It travels to the step
// after this one and into the report a person reads, and neither has any use
// for where this host keeps its work.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromiumShot, withoutPaths } from "./observe.mjs";

export const ROLES = "v1";
export const MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

// The two the site does not declare. Nothing else is ever chosen: ink, ground,
// heading, link and button are places, and the place is the meaning, so they
// are read and never judged.
export const ROLE_NAMES = ["primary", "accent"];
export const NONE = "none";

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const count = (n) => (n < WORDS.length ? WORDS[n] : String(n));
const listed = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const trim = (text) => String(text ?? "").trim();
const firstLine = (text) => String(text ?? "").split("\n")[0].trim();

// ------------------------------------------------------- what may be chosen

/** A color as the profile writes one, or null. Only a plain six digit hex can
 *  be offered: it is what the shape holds and what a number in the list has to
 *  stand for. */
export function hexOf(value) {
  const v = trim(value).toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v.slice(1).split("").map((c) => c + c).join("")}`.toUpperCase();
  return null;
}

/** What a color is called, in words a person reads. The five the pages set on
 *  their own elements arrive already named that way; a custom property is named
 *  by the site and is quoted as the site wrote it. */
export function saysOf(name) {
  const n = trim(name);
  if (!n) return "";
  if (n.startsWith("--")) return `the color the site calls ${n}`;
  if (n === "theme_color" || n === "theme-color") return "the color the site names as its theme color";
  return n;
}

/** The colors that may be chosen from: every color the site DECLARED, whether
 *  its own CSS set it on its own elements or a custom property named it, each
 *  once, with what it is called and where it was seen.
 *
 *  The pages come first because they are what a reader met, and the order is
 *  the numbering the model answers with, so it has to be settled here and not
 *  depend on which of two records was read first. Nothing is added to this list
 *  and nothing is invented for it: a site that declares no color offers nothing
 *  to choose from, which is an answer and not a failure. */
export function candidates({ statements = {}, observations = null } = {}) {
  const lists = [
    Array.isArray(observations?.statements?.color) ? observations.statements.color : [],
    Array.isArray(statements?.color) ? statements.color : [],
  ];
  const by = new Map();
  for (const list of lists) {
    for (const c of list) {
      const value = hexOf(c?.hex ?? c?.value);
      if (!value) continue;
      const found = by.get(value);
      if (found) {
        found.pages += Number(c?.count) || 1;
        continue;
      }
      by.set(value, {
        value,
        says: saysOf(c?.name),
        url: trim(c?.where),
        in: trim(c?.place),
        pages: Number(c?.count) || 1,
      });
    }
  }
  return [...by.values()];
}

/** The roles the site states for itself, which are not chosen for it. A site
 *  that names its own primary has said so, and a model choosing one anyway
 *  would be a second opinion on a settled thing. */
export function statedRoles(statements = {}) {
  const list = Array.isArray(statements?.color) ? statements.color : [];
  return ROLE_NAMES.filter((r) => list.some((c) => trim(c?.role).toLowerCase() === r));
}

/** The home page to take a picture of: the first page that opened, or failing
 *  that the address the site was read at. */
export function homePage({ statements = {}, observations = null } = {}) {
  const opened = Array.isArray(observations?.pages) ? observations.pages : [];
  return trim(opened[0]?.url) || trim(statements?.site) || "";
}

// ------------------------------------------------------------- the request

const INSTRUCTION = (n) => [
  "The picture is the home page of this site as a reader sees it. The list is the colors the site's own CSS declares, numbered.",
  "",
  "Say which ONE of those colors is the site's PRIMARY: the color the site is built out of, the one a person would name if asked what color this company is.",
  "And say which ONE is its ACCENT: the color used sparingly to pull the eye, on a button, a link or a highlight, often the only saturated color on the page.",
  "",
  `Answer with the NUMBER of a color from the list. The numbers 1 to ${n} and the word none are the only answers there are.`,
  "Never write a color of your own: not a hex, not an rgb value, not the name of a color. The colors in the list were read exactly, off the elements the site sets them on. The picture has been through antialiasing, an overlay and a gradient on its way to you, so a color read off the picture is not the color the site declared, and a color you supply is not one the site declared at all.",
  "Never write a number that is not in the list.",
  "",
  "Answer none when no color in the list fills that role. None is a real answer and it is often the right one: a page of black text on white with one grey button has no accent, and naming one would put a color in this company's brand profile that nobody chose. Say none rather than the closest thing.",
  "The two roles are answered separately. A site can have a primary and no accent, an accent and no primary, or neither.",
  "",
  "Answer as one JSON object:",
  '{"primary": "<a number from the list, or none>", "accent": "<a number from the list, or none>", "why": "<one sentence saying what in the picture decided it>"}',
].join("\n");

/** The numbered list the answer is given against. The number is the whole of
 *  the answer, which is what keeps a color the site never declared out of a
 *  brand profile: there is no way to name one. */
export function colorLines(colors) {
  return [
    "The colors this site declares, numbered. These are the only colors there are to choose from:",
    ...colors.map((c, i) => [
      `${i + 1}. ${c.value}`,
      c.says ? `, ${c.says}` : "",
      c.pages > 1 ? `, seen ${c.pages} times` : "",
    ].join("")),
  ].join("\n");
}

// The shape of the answer, so what comes back is an object with the two roles
// in it. What each one is allowed to SAY is checked here rather than declared
// to the service: this is one binding of the text-reasoning role and another
// service would bind it differently, and the rule that a model may only choose
// from colors already read is this agent's and not a setting on somebody's API.
const SCHEMA = {
  type: "OBJECT",
  properties: {
    primary: { type: "STRING" },
    accent: { type: "STRING" },
    why: { type: "STRING" },
  },
  required: ["primary", "accent"],
};

/** One request: the picture, the numbered colors, the instruction, and on a
 *  second ask what was wrong with the first answer. This is one binding of the
 *  text-reasoning role, not the role itself. */
export function rolesRequest({ shot = "", colors = [], page = "", faults = [], model = MODEL } = {}) {
  const parts = [];
  parts.push({ text: `The next picture is the home page${page ? ` of ${page}` : ""}, as a browser rendered it.` });
  parts.push({ inline_data: { mime_type: "image/png", data: shot } });
  parts.push({ text: colorLines(colors) });
  parts.push({ text: INSTRUCTION(colors.length) });
  if (faults.length) {
    parts.push({
      text: `You were asked this already and the answer could not be used: ${listed(faults)}. Answer with the number of a color from the list, or the word none, and nothing else in those two fields.`,
    });
  }
  return {
    url: `${ENDPOINT}/${model}:generateContent`,
    body: { contents: [{ role: "user", parts }], generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA } },
  };
}

/** The JSON object in an answer that was asked for one. A model told to answer
 *  with an object sometimes wraps it in a code fence or puts a sentence in
 *  front of it, and the answer itself is still in there. */
export function jsonIn(text) {
  const t = trim(text);
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  const tries = [t, fenced?.[1]];
  const open = t.indexOf("{"), close = t.lastIndexOf("}");
  if (open >= 0 && close > open) tries.push(t.slice(open, close + 1));
  for (const candidate of tries) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch { /* the next shape */ }
  }
  return null;
}

/** The service's answer, as the two things that were asked for and the sentence
 *  it gave for them. Nothing is read from it here beyond that: what the two
 *  answers are ALLOWED to be is the next function's business. */
export function answerFrom(body) {
  const text = (body?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text).filter(Boolean).join("");
  if (!trim(text)) throw new Error("the text-reasoning service answered with no text");
  const parsed = jsonIn(text);
  if (!parsed) throw new Error("the text-reasoning service answered with something that is not JSON");
  return { primary: parsed.primary, accent: parsed.accent, why: trim(parsed.why) };
}

/** What one answer means, against the list it was given.
 *
 *  A missing or empty answer is NONE rather than a refusal, because none is
 *  what this step wants said when nothing fills the role and a model that says
 *  it by saying nothing has still said it. Everything else is either a number
 *  in the list or a refusal: a color of any kind, in any notation, is refused
 *  even where it happens to match the list, because the answer this step asked
 *  for is a number and a model that supplies colors is one that can supply a
 *  color the site never declared. */
export function pickOf(said, colors = []) {
  const raw = trim(said);
  const t = raw.toLowerCase().replace(/[.\s]+$/, "");
  if (!t || t === NONE || t === "null" || t === "none of them" || t === "no") return { at: null, bad: null };
  if (/#|rgba?\(|hsla?\(/.test(t)) {
    return { at: null, bad: `it answered with a color of its own, "${raw}", where a number was asked for` };
  }
  const n = /^(?:color\s*|number\s*)?(\d+)$/.exec(t);
  if (!n) return { at: null, bad: `it answered "${raw}", which is neither a number from the list nor none` };
  const at = Number(n[1]);
  if (!(at >= 1 && at <= colors.length)) {
    return { at: null, bad: `it answered with color ${at}, and there ${colors.length === 1 ? "is only one color" : `are only ${count(colors.length)} colors`} in the list` };
  }
  return { at: at - 1, bad: null };
}

/** Both answers, read against the list. A run where either one is refused is
 *  refused whole: a model that supplies a color after being told not to has not
 *  earned the benefit of the doubt on the other role. */
export function picksOf(answer, colors = []) {
  const picked = {};
  const faults = [];
  for (const role of ROLE_NAMES) {
    const { at, bad } = pickOf(answer?.[role], colors);
    if (bad) faults.push(`for the ${role}, ${bad}`);
    picked[role] = at === null ? null : colors[at];
  }
  return { picked, faults };
}

// ------------------------------------------------------------- the choosing

/** The words the evidence carries, which is the whole of what a person is told
 *  about where this value came from. It says who chose it and it says the site
 *  did not, because a reader of a brand profile has no other way to tell this
 *  value apart from the ones the site declared, and every other value in the
 *  profile is the owner's own word. */
export const chosenIn = (n) =>
  `chosen from the ${count(n)} colors these pages declare, by a model reading the home page; the site does not say so itself`;

/** Ask which of the colors fills each role. One call, and one more when the
 *  answer breaks the one rule this step has. Never a third: a model that
 *  supplies a color after being shown the fault supplies colors, and the answer
 *  to that is to yield nothing, which costs a profile two fields it never had.
 *
 *  `call` sends one request, so a test drives all of this with no network and
 *  no key. Every call counts against the ceiling and a call that would pass it
 *  is not made. */
export async function chooseRoles({ shot, colors = [], call, page = "", stated = [], ceiling = null, sent = 0, model = MODEL } = {}) {
  const none = { chosen: {}, why: "", asked: 0, faults: [] };
  if (!colors.length) return { ...none, not_chosen: "these pages declare no color, so there was nothing to choose from" };
  if (!trim(shot)) return { ...none, not_chosen: "the home page could not be opened to take a picture of it" };
  const left = ROLE_NAMES.filter((r) => !stated.includes(r));
  if (!left.length) return { ...none, not_chosen: "the site states its own primary and its own accent, so neither was chosen for it" };

  const per = `the ceiling of ${ceiling} calls per task`;
  const afford = (n) => ceiling === null || sent + n <= ceiling;
  if (!afford(1)) return { ...none, not_chosen: `${per} was reached before a call could be made` };

  const ask = async (faults) => {
    try {
      const answer = answerFrom(await call(rolesRequest({ shot, colors, page, faults, model })));
      return { ...picksOf(answer, colors), why: answer.why, bad: null };
    } catch (e) {
      return { picked: {}, faults: [], why: "", bad: withoutPaths(firstLine(e?.message ?? e)) };
    }
  };

  let asked = 1;
  let { picked, faults, why, bad } = await ask([]);
  if (bad) return { ...none, asked, not_chosen: bad };
  if (faults.length) {
    if (!afford(asked + 1)) return { ...none, asked, faults, not_chosen: `${per} left no room to ask again, and the answer named a color of its own` };
    asked += 1;
    ({ picked, faults, why, bad } = await ask(faults));
    if (bad) return { ...none, asked, not_chosen: bad };
    if (faults.length) {
      return {
        ...none, asked, faults,
        not_chosen: `the model was asked twice and both answers went outside the colors these pages declare, so neither role was chosen (${listed(faults)})`,
      };
    }
  }

  // A role the site states for itself keeps what the site said. The model was
  // shown both because the pair is one judgment, and its answer for a role the
  // owner already published is dropped here rather than carried to the step
  // that writes the profile, where it would look like a value with two claims
  // on it.
  const chosen = {};
  for (const role of left) if (picked[role]) chosen[role] = { ...picked[role], in: chosenIn(colors.length) };
  // The roles it was asked about and declined, which is never a role the site
  // states for itself: that one was not up for choosing and saying the model
  // declined it would be untrue.
  const said = left.filter((r) => !chosen[r]);
  const roles = left.length === ROLE_NAMES.length ? "either role" : `the ${listed(left)}`;
  return {
    chosen, why, asked, faults: [],
    ...(said.length === left.length
      ? { not_chosen: `the model looked at the home page and said none of the colors these pages declare fills ${roles}` }
      : {}),
    ...(said.length && said.length < left.length
      ? { none_for: said, not_chosen_for: `the model said none of these colors is the ${listed(said)}` }
      : {}),
  };
}

/** The record this step leaves: what was offered, what was chosen, what it
 *  cost, and, where nothing was chosen, why. The why is the point of the
 *  record: the step after this one writes it into the report, and a person
 *  reading a profile with no accent in it is owed the reason. */
export function rolesRecord({ page = "", colors = [], stated = [], out, model = MODEL, ceiling = null, now = () => new Date() } = {}) {
  const one = (role) => {
    const c = out?.chosen?.[role];
    return c ? { value: c.value, in: trim(c.in), ...(trim(page) ? { url: trim(page) } : {}) } : null;
  };
  return {
    roles: ROLES,
    chosen_at: now().toISOString(),
    home_page: trim(page),
    model: out?.asked ? model : null,
    calls: Number(out?.asked) || 0,
    ceiling,
    offered: colors.map((c) => ({ value: c.value, ...(c.says ? { says: c.says } : {}), ...(c.url ? { url: c.url } : {}), ...(c.in ? { in: c.in } : {}) })),
    stated_by_the_site: stated,
    primary: one("primary"),
    accent: one("accent"),
    ...(trim(out?.why) ? { why: trim(out.why) } : {}),
    ...(out?.faults?.length ? { refused: out.faults } : {}),
    ...(trim(out?.not_chosen) ? { not_chosen: trim(out.not_chosen) } : {}),
    ...(trim(out?.not_chosen_for) ? { not_chosen_for: trim(out.not_chosen_for) } : {}),
  };
}

/** What this step printed, for the reply. It says what was chosen or what was
 *  not, and never says a role was chosen when it was not. */
export function saidLine(record) {
  const chosen = ROLE_NAMES.filter((r) => record?.[r]);
  const offered = `${count(record?.offered?.length ?? 0)} ${record?.offered?.length === 1 ? "color" : "colors"}`;
  if (!chosen.length) {
    return `The roles were not chosen: ${trim(record?.not_chosen) || "no reason was given"}. The profile carries no primary and no accent, and it is whole without them`;
  }
  const values = chosen.map((r) => `${record[r].value} as the ${r}`);
  return `A model read the home page and chose ${listed(values)}, out of the ${offered} these pages declare${trim(record?.not_chosen_for) ? `, and ${trim(record.not_chosen_for)}` : ""}`;
}

async function callService(request, key) {
  const res = await fetch(request.url, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(request.body),
  });
  if (!res.ok) {
    // The body goes to the log and never into the record. What a service says
    // when it refuses is written for whoever holds the account, and the person
    // who asked for a brand profile reads one sentence about what happened.
    const body = await res.text().catch(() => "");
    console.error(`text-reasoning service ${res.status}: ${body.slice(0, 1000)}`);
    const said = body.toLowerCase();
    if (res.status === 401 || res.status === 403 || (res.status === 400 && (said.includes("api key") || said.includes("api_key") || said.includes("unauthenticated")))) {
      throw new Error("the text-reasoning service refused the key this agent was given, which is for whoever runs this agent to put right");
    }
    if (res.status === 429) throw new Error("the text-reasoning service is not taking more calls just now");
    if (res.status >= 500) throw new Error("the text-reasoning service is not answering");
    throw new Error(`the text-reasoning service answered ${res.status}`);
  }
  return res.json();
}

/** The picture of the home page, as base64, and the reason there is none. The
 *  browser is reached exactly as the step before this one reaches it, so a host
 *  without one fails the same way twice and the job carries on both times. */
export async function takePicture(page, { shot = chromiumShot, keepAt = "" } = {}) {
  if (!trim(page)) return { data: "", why: "there was no home page address to open" };
  let camera;
  try {
    camera = shot();
  } catch (e) {
    return { data: "", why: withoutPaths(firstLine(e?.message ?? e)) };
  }
  try {
    const bytes = await camera.shoot(trim(page));
    if (!bytes?.length) return { data: "", why: "the browser gave back no picture of the home page" };
    if (trim(keepAt)) {
      mkdirSync(dirname(resolve(trim(keepAt))), { recursive: true });
      writeFileSync(trim(keepAt), bytes);
    }
    return { data: Buffer.from(bytes).toString("base64"), why: "" };
  } catch (e) {
    return { data: "", why: withoutPaths(firstLine(e?.message ?? e)) };
  } finally {
    await camera.close().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const { STATEMENTS, OBSERVATIONS, OUT, SHOT, TEXT_API_KEY } = process.env;
  if (!STATEMENTS || !OUT) { console.error("refused: STATEMENTS and OUT are required"); process.exit(2); }
  const ceiling = trim(process.env.CEILING_TEXT_REASONING) ? Number(process.env.CEILING_TEXT_REASONING) : null;
  if (ceiling !== null && !(ceiling > 0)) { console.error(`refused: CEILING_TEXT_REASONING is not a number: ${process.env.CEILING_TEXT_REASONING}`); process.exit(2); }

  const read = (file, what, required) => {
    if (!trim(file) || (!required && !existsSync(trim(file)))) return null;
    try {
      return JSON.parse(readFileSync(trim(file), "utf8"));
    } catch {
      if (!required) return null;
      console.error(`refused: the ${what} could not be read as the step before it wrote it`);
      process.exit(1);
    }
  };
  const statements = read(STATEMENTS, "statements record", true);
  const observations = read(OBSERVATIONS, "observations record", false);
  const colors = candidates({ statements, observations });
  const stated = statedRoles(statements);
  const page = homePage({ statements, observations });

  // Every road that ends in no roles ends the same way: the record is written
  // with the reason in it and this exits 0. The profile is written without a
  // primary and an accent and is whole, and the report says which two values
  // are missing and why, which is the answer a person can act on.
  let out;
  if (!colors.length) {
    out = { chosen: {}, asked: 0, faults: [], not_chosen: "these pages declare no color, so there was nothing to choose from" };
  } else if (!trim(TEXT_API_KEY)) {
    out = { chosen: {}, asked: 0, faults: [], not_chosen: "the key for the text-reasoning service is not set on this host, so nothing was asked" };
  } else {
    const { data, why } = await takePicture(page, { keepAt: SHOT });
    out = data
      ? await chooseRoles({ shot: data, colors, page, stated, ceiling, call: (req) => callService(req, TEXT_API_KEY) })
      : { chosen: {}, asked: 0, faults: [], not_chosen: `the home page could not be opened to take a picture of it: ${why}` };
  }

  const record = rolesRecord({ page, colors, stated, out, ceiling });
  try {
    mkdirSync(dirname(resolve(trim(OUT))), { recursive: true });
    writeFileSync(trim(OUT), `${JSON.stringify(record, null, 2)}\n`);
  } catch (e) {
    console.error(`refused: the roles record could not be written: ${withoutPaths(firstLine(e?.message ?? e))}`);
    process.exit(1);
  }
  console.log(`${saidLine(record)}. Roles at ${OUT}`);
}
