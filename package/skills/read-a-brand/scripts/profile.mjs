// Write the draft profile from the statements, and the report from everything
// else.
//   needs: node >= 22, no network and no browser
//   STATEMENTS=records/<job>/statements.json [OBSERVATIONS=records/<job>/observations.json,
//   which carries what the pages set on their own elements as well as
//   everything that was only observed] [CHOSEN=records/<job>/roles.json, the
//   primary and the accent as the step before this one chose them]
//   OUT=records/<job>/brand-profile.json REPORT=records/<job>/brand-report.md node profile.mjs
// Exit: 0 written, whether or not there was a profile to write; 1 refused, and
// the one sentence saying why is printed; 2 the settings are not right.
//
// THE PROFILE IS STATEMENTS ONLY, WITH ONE NAMED EXCEPTION. Every value in it
// is something the OWNER DECLARED, and every value names where it was seen.
// What the site's own CSS sets on its own body, its own headings, its own links
// and its own call to action is one of those, colors and font stacks alike, and
// it arrives here from the browser step, because how a thing was read says
// nothing about who said it. What was INFERRED never reaches the profile: the
// color covering the most of a page, a color sampled from an image, and the
// face a browser resolved after the fallbacks.
//
// The exception is `palette.primary` and `palette.accent`, which arrive chosen.
// They are assignments rather than places, nothing on a page states them, and
// the step before this one shows a model the home page and the colors the site
// DECLARES and asks which of those fills each role. The model may answer only
// with one of those colors or with none, so the value in the profile was still
// read off an element exactly; what the model supplied is the placing. The
// evidence says so in words, a role the site states itself is never overwritten
// by a choice, a role the site states two ways is left contested and not
// chosen, and a profile whose only value is a choice is not written at all.
//
// A part with no statement behind it is left out entirely, never written as
// null and never filled in from what the pages happened to look like, because
// absence in a profile means not stated and must never mean a default somebody
// else fills in. The profile is about to be handed to other agents as though
// the owner had written it.
//
// A part the site states TWICE AND DIFFERENTLY is carried as the value MORE OF
// THE PAGES STATE, and the report names the minority with the counts and the
// pages that stated each. Where no value is stated by more pages than another
// the profile carries neither, which is the right answer for a genuine tie.
// references/what-counts.md argues that at length, because it looks like
// resolving a disagreement and it is not: which of a site's colors is primary
// is an assignment nobody publishes and no count can reach, and that stays
// refused, while four pages saying the heading is one color and one page
// saying another is a fact with weight, and dropping it discards evidence
// rather than declining to guess.
//
// THE REPORT SAYS FOUR THINGS IN THIS ORDER: what was found and where, what the
// site was observed doing that did not go in the profile, what cannot be read
// from a website at all and has to be typed by a person, and every place the
// site disagrees with itself. The last two are the parts an owner actually
// wants. An owner told their profile is half empty and exactly which half can
// finish it in ten minutes; an owner handed a full looking profile with five
// guessed fields in it finds out later, from a video with the wrong blue in it.
//
// No local file path is ever written into the profile or the report. Both
// travel to the person, and the profile travels further than that.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const PROFILE = "v1";

// The parts of the published shape a website can fill, in the order the shape
// writes them, each with the plain words the report calls it by. A part with
// leaves is one field in the shape holding several values.
export const PARTS = [
  { path: "name", says: "the organisation's name" },
  { path: "owner", says: "the domain the profile belongs to" },
  { path: "palette.ink", says: "the ink color" },
  { path: "palette.ground", says: "the ground color" },
  { path: "palette.heading", says: "the color of headings" },
  { path: "palette.link", says: "the color of a link in running text" },
  { path: "palette.button", says: "the background of the main call to action" },
  { path: "palette.primary", says: "the primary color" },
  { path: "palette.on_primary", says: "the color of text on the primary" },
  { path: "palette.accent", says: "the accent color" },
  { path: "palette.theme", says: "the theme color" },
  { path: "type.heading", says: "the heading face", leaves: ["family", "fallback"] },
  { path: "type.body", says: "the body face", leaves: ["family", "fallback"] },
  { path: "type.mono", says: "the mono face", leaves: ["family", "fallback"] },
  { path: "logo.mark", says: "the mark", leaves: ["href", "media_type"] },
  { path: "legal.first_mention", says: "the name with its trademark, on first mention" },
  { path: "legal.footer", says: "the copyright line" },
];

export const PROFILE_PATHS = PARTS.flatMap((p) => (p.leaves ? p.leaves.map((l) => `${p.path}.${l}`) : [p.path]));
const SAYS = Object.fromEntries(PARTS.map((p) => [p.path, p.says]));

// What no website carries, from references/what-counts.md, which is the
// authority, each with the fields of the shape it would fill. These are named
// in the report every time, whether or not anything else was found: no amount
// of reading a site will produce them, and an owner who is not told that will
// assume the silence means the profile is finished.
export const TYPED_BY_A_PERSON = [
  { says: "the narration voice", fields: ["voice.narration", "voice.words_per_second"] },
  { says: "the words the brand will not say", fields: ["words.never_say", "words.instead_of", "words.sentences"] },
  { says: "the things that must never be done to the mark", fields: ["logo.never", "logo.min_width_px"] },
  { says: "the contrast floor the brand requires, as against the one it achieves", fields: ["palette.contrast_floor", "palette.never_hue_alone"] },
  { says: "which of two colors is primary when the site uses both everywhere", fields: ["palette.primary"] },
];

// The four routes that name an image as the mark, in the order
// references/what-counts.md numbers them. The best route present is the one the
// profile carries: a manifest icon and an apple touch icon are usually the same
// picture at two sizes, and taking the first route that named one is reading
// the authority rather than choosing between two claims.
export const MARK_ROUTES = ["organisation-record", "header-logo", "manifest-icon", "apple-touch-icon"];

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const count = (n) => (n < WORDS.length ? WORDS[n] : String(n));
const times = (n) => (n === 2 ? "twice" : `${count(n)} times`);
const upper = (text) => String(text).replace(/^./, (c) => c.toUpperCase());
const listed = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const trim = (text) => String(text ?? "").trim();
const day = (date) => date.toISOString().slice(0, 10);

class Refusal extends Error {}
const refuse = (why) => { throw new Refusal(why); };

/** The domain a profile belongs to, from the address the site was read at. */
export function hostOf(site) {
  try {
    return new URL(trim(site)).hostname;
  } catch {
    return trim(site).replace(/^https?:\/\//i, "").split("/")[0] || null;
  }
}

// WHAT IS NOT HERE, AND WHY. This step once read a custom property's NAME a
// second time, to work out which role it filled, with a test of its own: any
// name holding the word `background` anywhere filled ground. The step before
// this one already answers that question, and answers it carefully, by taking
// the words that say only "this is a brand color" off the front and requiring
// what is left to be exactly one role word. Two answers to one question is how
// a careful rule becomes a loose one, and the loose one won here because it
// came last: `--plyr-video-background` is a video player's variable, fills no
// role by the careful test, and was written into a real profile as the brand's
// ground, black, because it has the word background in it.
//
// So the role is decided ONCE, upstream, and travels on the statement. A color
// that carries no role is not placed at all: it goes in the report, which is
// what references/what-counts.md has said all along. The only map left here
// goes from a ROLE to a field, never from a name.

/** The field a ROLE fills, which is a different question from what a name
 *  says. A role arrives already read: the five definitional places carry
 *  theirs, and a custom property carries the role its own name named. Nothing
 *  is guessed here, which is why this is a table and not a test.
 *
 *  `secondary` is in the table nowhere, because the shape this agent writes
 *  has no field for it, and a color with no field is reported beside the
 *  profile rather than bent into a field it does not fill. */
export const ROLE_FIELDS = {
  ink: "palette.ink", ground: "palette.ground", heading: "palette.heading",
  link: "palette.link", button: "palette.button",
  primary: "palette.primary", on_primary: "palette.on_primary",
  accent: "palette.accent", theme: "palette.theme",
};
export const fieldOfRole = (role) => ROLE_FIELDS[trim(role).toLowerCase()] ?? null;

/** The only two fields a role can be CHOSEN for, and the step that chooses
 *  them is the only thing in this agent that may. Everything else in the shape
 *  is read: a place whose meaning is the place, a name that says which role it
 *  fills, or a line the site wrote about itself. */
export const CHOSEN_FIELDS = { primary: "palette.primary", accent: "palette.accent" };

/** The statements, with what the browser step read off the pages added to them:
 *  the five colors a site sets on its own elements and the two font stacks it
 *  asks for.
 *
 *  They are statements like any other. What a site's own CSS sets on its own
 *  elements is the owner's word, and the browser is the thing that settled the
 *  cascade and nothing more. A run where no page opened has none of them, and
 *  the report says which part of the profile went missing with them. */
export function withReadStatements(statements, observations) {
  const base = statements && typeof statements === "object" ? statements : {};
  const read = observations?.statements ?? {};
  const merge = (key) => {
    const more = Array.isArray(read[key]) ? read[key] : [];
    return more.length ? { [key]: [...(Array.isArray(base[key]) ? base[key] : []), ...more] } : {};
  };
  return { ...base, ...merge("color"), ...merge("type") };
}

// One sighting, in the shape the published profile writes evidence in. It
// takes only the three fields that shape allows, so what is carried alongside
// them here for the counting, the pages a statement was read off, stays out of
// the file.
const sighting = (at) => ({ url: trim(at?.url), ...(trim(at?.in) ? { in: trim(at.in) } : {}), ...(Number(at?.seen) > 1 ? { seen: Number(at.seen) } : {}) });
const at = (e) => ({
  url: trim(e?.where),
  in: trim(e?.place),
  seen: Number(e?.count) || 1,
  // The pages a statement was read off, which only the browser step knows and
  // only it sends. Its presence is also what says these sightings ARE pages,
  // so a count of them can be reported as pages and a count of declarations in
  // a stylesheet is never called that.
  ...(Array.isArray(e?.pages) ? { pages: e.pages.map(trim).filter(Boolean) } : {}),
});

/** Every statement, placed at the field of the published shape it fills.
 *
 *  Returns the values by field, each carrying where it was seen, and the
 *  statements that fill no field of the shape. The second list is not a
 *  failure: a site stating `--color-danger` has stated something true about
 *  itself that this shape has nowhere to put, and the report says so rather
 *  than quietly dropping it or bending it into a field it does not fill. */
export function placeStatements(statements) {
  const s = statements && typeof statements === "object" ? statements : {};
  const list = (k) => (Array.isArray(s[k]) ? s[k] : []);
  const values = new Map();
  const unplaceable = [];
  const put = (path, value, where) => {
    if (value === undefined || value === null || trim(value) === "") return;
    values.set(path, [...(values.get(path) ?? []), { value, at: where }]);
  };

  const owner = hostOf(s.site);
  if (owner) put("owner", owner, { url: trim(s.site), in: "the domain the job was given, and claimed as its own", seen: 1 });

  for (const c of list("color")) {
    // A color carries a role when the step before this one could place it: the
    // five definitional places carry theirs, the manifest's theme color carries
    // theme, and a custom property carries the role its own name named, by the
    // careful test that lives there. No role means that step read the name and
    // found none, so `--blue-400` and `--plyr-video-background` name colors
    // without naming a role and are reported rather than placed. The name is
    // not read again here: see above for the profile that cost.
    const field = fieldOfRole(c?.role);
    const value = trim(c?.hex) || trim(c?.value);
    if (!value) continue;
    if (!field) { unplaceable.push({ says: `the color the site calls ${trim(c?.name)}`, value, at: at(c) }); continue; }
    put(field, value, at(c));
  }

  for (const t of list("type")) {
    const family = trim(t?.family);
    if (!family) continue;
    // A family the site named without saying where it goes fills no field. A
    // font service link names its families in the address and says nothing
    // about their use, and writing one in as the body face would put a face in
    // the profile that the site never said was the body face.
    const role = t?.role === "heading" ? "heading" : t?.role === "body" ? "body" : null;
    if (!role) {
      unplaceable.push({ says: "a font family the site names without saying whether it is for headings or for body text", value: family, at: at(t) });
      continue;
    }
    put(`type.${role}.family`, family, at(t));
    const fallback = trim(t?.stack).split(",").slice(1).join(",").trim();
    if (fallback) put(`type.${role}.fallback`, fallback, at(t));
  }

  const marks = list("mark").filter((m) => trim(m?.value));
  const route = MARK_ROUTES.find((r) => marks.some((m) => trim(m?.route) === r));
  for (const m of marks.filter((m) => trim(m?.route) === route)) {
    put("logo.mark.href", trim(m.value), at(m));
    if (trim(m?.media_type)) put("logo.mark.media_type", trim(m.media_type), at(m));
  }
  for (const m of marks.filter((m) => trim(m?.route) !== route)) {
    unplaceable.push({ says: `an image the site names as its mark by a second route, ${trim(m.route)}`, value: trim(m.value), at: at(m), beside: true });
  }

  for (const l of list("legal")) {
    const text = trim(l?.text);
    if (!text) continue;
    if (l?.kind === "copyright") put("legal.footer", text, at(l));
    else if (l?.kind === "trademark") put("legal.first_mention", text, at(l));
  }
  return { values, unplaceable };
}

/** Two addresses that are the same address. A home page is written with its
 *  trailing slash in one record and without it in another, and naming the home
 *  page as the dissenter turns on the two matching. */
const sameAddress = (a, b) => {
  const bare = (t) => trim(t).replace(/\/+$/, "").toLowerCase();
  return !!bare(a) && bare(a) === bare(b);
};

/**
 * The values stated at one field, each with how many statements said it, the
 * addresses they were said at, and whether every one of them was read off a
 * page. Heaviest first, and values of equal weight keep the order they were
 * stated in.
 *
 * This is the counting the majority rule turns on, and it is kept apart from
 * the rule so a test can check the arithmetic without a profile around it.
 */
export function byWeight(seen = []) {
  const by = new Map();
  for (const e of seen ?? []) {
    const value = trim(e?.value);
    if (!value) continue;
    const key = value.toLowerCase();
    const found = by.get(key) ?? { value, count: 0, where: [], pages: true };
    found.count += Math.max(1, Number(e?.at?.seen) || 1);
    const said = Array.isArray(e?.at?.pages) ? e.at.pages : [trim(e?.at?.url)];
    for (const url of said) if (url && !found.where.includes(url)) found.where.push(url);
    if (!Array.isArray(e?.at?.pages)) found.pages = false;
    by.set(key, found);
  }
  return [...by.values()].sort((a, b) => b.count - a.count);
}

/** The addresses a value was stated at, in words, with the home page called
 *  the home page, because that is what a person reading the report calls it. */
const whereWords = (where, home) => listed((where ?? []).map((u) => (sameAddress(u, home) ? "the home page" : u)));

/**
 * The line the evidence carries when a value was carried because more of the
 * pages state it. Something a person can read: seen at four of five pages; the
 * home page states #E5F4FF instead.
 *
 * The report writes the same sentence with the values in ticks, so the two say
 * the same thing in the two places they are read.
 */
export function majorityNote(said, { ticks = false } = {}) {
  if (!said) return "";
  const tick = (value) => (ticks ? `\`${value}\`` : value);
  const mine = said.pages
    ? `seen at ${count(said.count)} of ${count(said.total)} pages`
    : `seen in ${count(said.count)} of ${count(said.total)} statements`;
  const others = (said.minority ?? []).map((m) => {
    const where = whereWords(m.where, said.home);
    return `${where || (m.count === 1 ? "one other statement" : `${count(m.count)} others`)} states ${tick(m.value)} instead`;
  });
  return others.length ? `${mine}; ${listed(others)}` : mine;
}

const setAt = (obj, path, value) => {
  const keys = path.split(".");
  let node = obj;
  for (const k of keys.slice(0, -1)) node = node[k] ??= {};
  node[keys[keys.length - 1]] = value;
};

/** The draft profile, and what it could not carry.
 *
 *  A field with one stated value is written with its evidence. A field the
 *  site states more than one value for is written with the value MORE OF THE
 *  PAGES STATE, named in `majority` and carrying a line of evidence that says
 *  the count and what the minority stated. A field whose values are stated by
 *  the same number of pages is left out and named in `contested`, because
 *  nothing in a tie says which one the owner meant. A field with no statement
 *  at all is left out and named in `missing`. Nothing is written that no
 *  statement put there, so `adopted` is false and stays false until the owner
 *  adopts it.
 *
 *  The observations are read for one thing only: the colors the pages set on
 *  their own elements, which are statements. Everything else in that record is
 *  what the site was observed doing and belongs to the report. */
export function buildProfile({ statements, observations = null, chosen = null, now = () => new Date() } = {}) {
  const said = withReadStatements(statements, observations);
  const { values, unplaceable } = placeStatements(said);
  const home = trim(said.site);
  const body = {};
  const evidence = {};
  const written = [];
  const contested = [];
  const majority = [];

  const settled = [];
  for (const path of PROFILE_PATHS) {
    const seen = values.get(path) ?? [];
    if (!seen.length) continue;
    const ranked = byWeight(seen);
    if (!ranked.length) continue;
    const [top, next] = ranked;
    // A tie is the one case nothing can settle. Four pages against one is not
    // a tie, and treating them alike was the blunt part of the older rule: it
    // threw away four fifths of the evidence and called it caution.
    if (next && next.count >= top.count) {
      contested.push({
        path,
        values: ranked.map((r) => r.value),
        counts: ranked.map((r) => r.count),
        where: [...new Set(ranked.flatMap((r) => r.where))],
      });
      continue;
    }
    settled.push({
      path,
      value: top.value,
      seen: seen.filter((e) => trim(e.value).toLowerCase() === top.value.toLowerCase()),
      said: next
        ? {
          path, value: top.value, count: top.count, pages: ranked.every((r) => r.pages), home,
          total: ranked.reduce((n, r) => n + r.count, 0),
          where: top.where,
          minority: ranked.slice(1).map((r) => ({ value: r.value, count: r.count, where: r.where })),
        }
        : null,
    });
  }

  // A part with one leaf contested carries none of them. Two pages asking for
  // two heading faces behind the same fallback agree on the fallback, and a
  // heading face written as a fallback with no family is not a face: it is the
  // half of a contested part that happened to match, and anything reading the
  // profile would take it for the whole. Under the majority rule this only
  // fires on a tie, since a leaf the pages differ about otherwise settles.
  const partOf = (path) => PARTS.find((p) => path === p.path || path.startsWith(`${p.path}.`))?.path ?? path;
  const contestedParts = new Set(contested.map((c) => partOf(c.path)));
  for (const { path, value, seen, said: byCount } of settled) {
    if (contestedParts.has(partOf(path))) continue;
    setAt(body, path, value);
    // The sightings of the value that was carried, and then, where the pages
    // differed, one line saying so. That line carries no address because it is
    // not a place the value was seen: it is what the count was, and the shape
    // the profile is written in leaves the address off and keeps the words.
    evidence[path] = [...seen.map((e) => sighting(e.at)), ...(byCount ? [{ in: majorityNote(byCount) }] : [])];
    written.push(path);
    if (byCount) majority.push(byCount);
  }

  // The two values no site declares. Which of a site's colors is its primary
  // and which is its accent is an assignment rather than a place, so no rule
  // finds it and no page states it, and the step before this one asks a model
  // which of the colors the site DOES declare fills each. It arrives already
  // chosen and already checked against that list, so nothing is decided here:
  // a role the site stated itself keeps what the site said, a role the site
  // stated two ways stays out and is reported, and what is written carries
  // evidence that says a model chose it and the site did not. A run without
  // that step passes nothing here and the profile is written without the two,
  // which is what it has always done.
  const chose = [];
  for (const [role, path] of Object.entries(CHOSEN_FIELDS)) {
    const pick = chosen?.[role];
    const value = trim(pick?.value);
    const inWords = trim(pick?.in);
    if (!value || !inWords) continue;
    if (written.includes(path) || contestedParts.has(partOf(path))) continue;
    setAt(body, path, value);
    evidence[path] = [{ ...(trim(pick?.url) ? { url: trim(pick.url) } : {}), in: inWords }];
    written.push(path);
    chose.push(path);
  }

  const has = (part) => written.some((p) => p === part.path || p.startsWith(`${part.path}.`));
  const inContest = (part) => contested.some((c) => c.path === part.path || c.path.startsWith(`${part.path}.`));
  const missing = PARTS.filter((p) => !has(p) && !inContest(p));

  const profile = {
    brand_profile: PROFILE,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.owner !== undefined ? { owner: body.owner } : {}),
    updated: day(now()),
    adopted: false,
    ...(body.palette ? { palette: body.palette } : {}),
    ...(body.type ? { type: body.type } : {}),
    ...(body.logo ? { logo: body.logo } : {}),
    ...(body.legal ? { legal: body.legal } : {}),
    ...(written.length ? { evidence } : {}),
  };
  // The owner is the domain the person named, not something the site said about
  // itself, so a profile carrying only that is a profile of nothing. A chosen
  // role is not a statement either: a profile whose only value is a model's
  // choice is exactly the profile of guesses this agent refuses to write, so
  // the two are counted out of `stated` and a site that states nothing else
  // still gets the report alone.
  const stated = written.filter((p) => p !== "owner" && !chose.includes(p));
  const parts = PARTS.filter(has);
  return { profile, written, stated, chosen: chose, parts, missing, contested, majority, unplaceable };
}

// ------------------------------------------------------------------ the report

const percent = (share) => `${Math.round(share * 100)} percent`;
const pageWord = (n) => `${count(n)} ${n === 1 ? "page" : "pages"}`;

const sightingSentence = (e) => {
  const where = trim(e.url) || "the site";
  const place = trim(e.in);
  const often = Number(e.seen) > 1 ? `, ${times(Number(e.seen))}` : "";
  return place ? `${where} in ${place}${often}` : `${where}${often}`;
};

/** What was found, and where: one line per part of the shape the profile
 *  carries, naming the part, the value and the place the site said it. A value
 *  the pages differed about says so on the same line, with the count and what
 *  the minority stated, so a person reading only this part of the report is
 *  never shown a majority as though it were agreed. */
export function foundLines(built) {
  const lines = [];
  for (const part of PARTS) {
    const leaves = built.written.filter((p) => p === part.path || p.startsWith(`${part.path}.`));
    if (!leaves.length) continue;
    const values = leaves.map((p) => {
      const leaf = p === part.path ? null : p.slice(part.path.length + 1).replace(/_/g, " ");
      return `${leaf ? `its ${leaf} ` : ""}\`${valueAt(built.profile, p)}\``;
    });
    // A chosen role says so on its own line. It was not seen anywhere: it was
    // picked out of the colors that were, and the line has to read as a choice
    // or a person skimming the report takes it for another value the site
    // stated.
    if ((built.chosen ?? []).includes(part.path)) {
      const e = (built.profile.evidence[part.path] ?? [])[0] ?? {};
      lines.push(`- ${upper(part.says)}, \`${part.path}\`: ${listed(values)}. ${upper(trim(e.in))}.${trim(e.url) ? ` The home page it read is ${trim(e.url)}.` : ""}`);
      continue;
    }
    const seen = [...new Map(leaves.flatMap((p) => built.profile.evidence[p] ?? []).map((e) => [JSON.stringify(e), e])).values()]
      .filter((e) => trim(e.url));
    const counted = (built.majority ?? []).filter((m) => leaves.includes(m.path)).map((m) => {
      const leaf = m.path === part.path ? null : m.path.slice(part.path.length + 1).replace(/_/g, " ");
      const note = majorityNote(m, { ticks: true });
      return leaf ? ` Its ${leaf} is ${note}.` : ` ${upper(note)}.`;
    });
    lines.push(`- ${upper(part.says)}, \`${part.path}\`: ${listed(values)}. Seen at ${listed(seen.map(sightingSentence))}.${counted.join("")}`);
  }
  return lines;
}

const valueAt = (obj, path) => path.split(".").reduce((node, k) => (node == null ? node : node[k]), obj);

// What a run without a browser costs, said in the report where an owner will
// read it. It costs the report its second half, and it costs the profile the
// five colors and the two faces a site sets on its own elements, which are
// statements and are read by opening the page. Saying the profile is the same
// either way would be a comfortable sentence and a false one.
const WITHOUT_A_BROWSER = [
  "The profile carries what the stylesheets and the web app manifest state on their own.",
  "It does not carry what the site sets on its own elements, the five colors and the two faces, because those are read by opening the page.",
  "Nothing that was only observed would have gone in it either way.",
].join(" ");

/** What the site was observed doing, which is in the report and in no profile.
 *  When the pages did not open this says so, and says what the profile went
 *  without because of it. */
export function observedLines(observations) {
  if (!observations) return [`The pages were not opened, so there is nothing here. ${WITHOUT_A_BROWSER}`];
  if (!observations.opened) {
    const why = trim(observations.why) || "they would not open";
    return [`The pages were not opened, so there is nothing here. The reason given was: ${why}. ${WITHOUT_A_BROWSER}`];
  }
  const lines = [];
  const pages = Array.isArray(observations.pages) ? observations.pages.length : 0;
  const faces = observations.faces ?? { heading: [], body: [] };
  const facesLine = (role, list) => {
    if (!list?.length) return null;
    if (list.length === 1) return `- ${upper(role)} text renders in ${list[0].face} across ${pageWord(pages)}.`;
    return `- ${upper(role)} text renders in ${count(list.length)} faces: ${listed(list.map((f) => `${f.face} on ${pageWord(f.pages.length)}`))}.`;
  };
  for (const line of [facesLine("heading", faces.heading), facesLine("body", faces.body)]) if (line) lines.push(line);

  const colors = (observations.colors ?? []).filter((c) => c.share > 0.005).slice(0, 6);
  if (colors.length) {
    lines.push(`- The colors by the share of the page they cover: ${listed(colors.map((c) => `${c.color} at ${percent(c.share)}`))}.`);
  }
  const contrast = (observations.contrast ?? []).filter((c) => typeof c.ratio === "number");
  if (contrast.length) {
    const worst = contrast[0];
    const best = contrast[contrast.length - 1];
    lines.push(`- The contrast the site achieves between its text and its grounds runs from ${worst.ratio} to ${best.ratio}, over ${count(contrast.length)} pairings. The lowest is ${worst.text} on ${worst.ground}. This is the contrast the site achieves and it is not the floor the brand requires, which is a different thing and is below.`);
  }
  const shut = (observations.not_opened ?? []).length;
  if (shut) lines.push(`- ${upper(pageWord(shut))} would not open, so nothing was read from ${shut === 1 ? "it" : "them"}.`);
  return lines;
}

/** What the report says about the two roles nobody declares.
 *
 *  It says one of two things and never nothing. Where a role was chosen it says
 *  a model chose it, out of which colors, and that the site did not say so, so
 *  that a person reading a profile can tell the one value in it that is a
 *  reading of their page from the ones that are their own word. Where no role
 *  was chosen it says which reason, because a person looking at a profile with
 *  no accent in it is owed whether their site has none, or the key was missing,
 *  or the model would not answer, and those are three different things to do
 *  next. */
export function rolesLines(built, chosen = null) {
  const picked = (built?.chosen ?? []).filter(() => (built?.stated?.length ?? 0) > 0);
  if (picked.length) {
    const words = listed(picked.map((p) => `\`${p}\``));
    return [
      `${upper(words)} ${picked.length === 1 ? "is the one value here" : "are the two values here"} the site did not say. Which of a site's colors it treats as its primary, and which as its accent, is a decision an owner takes and publishes nowhere a reader can find, so a model was shown a picture of the home page and the colors these pages declare, and asked which of those fills each role. It answers with one of those colors or with none, it never supplies a color of its own, and the value carries that in its evidence.`,
      ...(trim(chosen?.not_chosen_for) ? ["", `${upper(trim(chosen.not_chosen_for))}, so that one is left out.`] : []),
      "", `Check ${picked.length === 1 ? "it" : "them"} first. ${picked.length === 1 ? "It is" : "They are"} a reading of your own page rather than your word, and correcting ${picked.length === 1 ? "it" : "them"} is one edit.`,
    ];
  }
  const why = trim(chosen?.not_chosen) || "the step that chooses them did not run";
  return [
    `The primary and the accent were not chosen: ${why}. Those two are the values no website declares anywhere a reader can find, so they are left out rather than guessed, and everything else here stands without them.`,
  ];
}

/** The whole report, in the four parts and in this order. */
export function report({ statements = {}, built, observations = null, chosen = null, now = () => new Date() } = {}) {
  const site = trim(statements.site);
  const owner = hostOf(site) ?? "this site";
  const out = [];
  const push = (...lines) => out.push(...lines, "");

  push(`# Brand report for ${owner}`, "", `Read on ${day(now())} from ${site || "the site"}. The draft profile is beside this report.`);

  push("## What was found, and where");
  if (built.stated.length) {
    const n = built.parts.length;
    push(`The draft profile carries ${count(n)} ${n === 1 ? "part" : "parts"} of the shape. Each one is something the site states about itself, and each one names where it was seen.`, "", ...foundLines(built));
  } else {
    const looked = Array.isArray(statements.looked_for) ? statements.looked_for : [];
    push("The site states nothing about itself that this shape has a field for, so no profile was written. A profile of guesses would be worse than none, because the guesses would be handed to other agents as though you had said them.",
      ...(looked.length ? ["", `These were looked for: ${listed(looked)}.`] : []));
  }
  push(...rolesLines(built, chosen));
  const beside = built.unplaceable.filter((u) => !u.beside);
  if (beside.length) {
    push("The site also states these, and the profile shape has no field for them, so they are here and not in it:", "",
      ...beside.map((u) => `- \`${u.value}\`, ${u.says}. Seen at ${sightingSentence(sighting(u.at))}.`));
  }

  push("## What the site was observed doing");
  push("None of this is in the profile. Placing any of it would take a decision you never published, and the profile carries only what you did.", "", ...observedLines(observations));
  const skipped = Array.isArray(statements.skipped) ? statements.skipped : [];
  const second = built.unplaceable.filter((u) => u.beside);
  if (skipped.length || second.length) {
    push("What was looked at and not taken as a statement:", "",
      ...skipped.map((s) => `- ${upper(s)}.`.replace(/\.\.$/, ".")),
      ...second.map((u) => `- ${u.value} is ${u.says}, and the profile carries the mark from the route that names it first.`));
  }
  // What was never fetched at all, in the fetch step's own words. A page on
  // another host that was seen and not followed is a fact worth knowing rather
  // than a silence, and this is the only place a person would read it.
  const notFetched = Array.isArray(statements.not_fetched) ? statements.not_fetched.filter((s) => trim(s)) : [];
  if (notFetched.length) {
    push("What was not fetched:", "", ...notFetched.map((s) => `- ${upper(trim(s))}.`.replace(/\.\.$/, ".")));
  }

  push("## What no website carries");
  push("A person has to type these. No amount of reading a site will produce them, and they are the half of a brand that decides what other agents do with it.", "",
    ...TYPED_BY_A_PERSON.map((t) => {
      const line = `- ${upper(t.says)}, which ${t.fields.length === 1 ? "fills" : "fill"} ${listed(t.fields.map((f) => `\`${f}\``))}.`;
      // The one of these a model now takes a first go at. Leaving the line as
      // it stands would tell a person to type a field the profile in their
      // hand already carries, and they would have no way to tell which of the
      // two to believe.
      return t.fields.every((f) => (built.chosen ?? []).includes(f))
        ? `${line} A model has chosen one from the colors the site declares, and it is in the draft as a choice for you to keep or change.`
        : line;
    }));
  if (built.missing.length) {
    push(`These parts of the shape had no statement behind them, so the draft leaves them out rather than guessing: ${listed(built.missing.map((p) => `${p.says} (\`${p.path}\`)`))}.`,
      "", "An absent field means the site stated nothing. It never means a default, and nothing reading this profile may fill one in.");
  }
  if (built.contested.length) {
    push(`And the site states more than one value for ${listed(built.contested.map((c) => `\`${c.path}\``))}, with no value stated by more pages than another, so the draft leaves ${built.contested.length === 1 ? "that one" : "those"} out as well. The last part of this report says what the values were.`);
  }

  push("## Where the site disagrees with itself");
  const counted = built.majority ?? [];
  const found = [
    ...counted.map((m) => {
      const each = [{ value: m.value, count: m.count, where: m.where }, ...m.minority]
        .map((v) => `\`${v.value}\` at ${count(v.count)}${v.where.length ? ` (${whereWords(v.where, m.home)})` : ""}`);
      return `- The site states ${count(m.minority.length + 1)} values for \`${m.path}\`, over ${count(m.total)} ${m.pages ? "pages" : "statements"}: ${listed(each)}. The draft carries \`${m.value}\`, the one more of them state, and the evidence beside it says so. Nothing is resolved by that: both values are here, with which pages stated which, and the draft is yours to correct.`;
    }),
    ...built.contested.map((c) => `- The site states ${count(c.values.length)} values for \`${c.path}\`: ${listed(c.values.map((v, i) => `\`${v}\`${c.counts ? ` at ${count(c.counts[i])}` : ""}`))}, and no value is stated by more than another, so the draft carries neither. ${c.where.length ? `Seen at ${listed(c.where)}.` : ""}`.trim()),
    ...((observations?.disagreements ?? []).map((d) => `- ${trim(d.says)} ${d.where?.length ? `Seen at ${listed(d.where)}.` : ""}`.trim())),
  ];
  if (found.length) {
    push(["Nothing in this section is resolved for you. Four blues are reported as four blues. Where a primary or an accent was chosen, it says so on the value itself and names what did the choosing.",
      counted.length ? "Where the pages differ about one place and most of them say the same thing, the draft carries what most of them say, because a count of the owner's own statements is evidence and not a preference, and the line below names the minority and the counts." : "",
    ].filter(Boolean).join(" "), "", ...found);
  } else if (!observations || !observations.opened) {
    push("Nothing the site states disagrees with anything else it states. The pages were not opened, so what the site renders was not compared with what it says.");
  } else {
    push("Nothing that was read disagrees with anything else that was read.");
  }

  out.push("This is a draft. Nobody has vouched for it. It becomes your brand profile when you correct it and adopt it.", "");
  return out.join("\n");
}

/** Write the profile and the report. The profile is not written at all when the
 *  site stated nothing, because a file holding only the day and the domain
 *  would be read by the next thing along as a brand. */
export function writeProfile(built, text, { out, reportTo } = {}) {
  if (!trim(reportTo)) refuse("REPORT is required: the file to write the brand report to");
  mkdirSync(dirname(resolve(trim(reportTo))), { recursive: true });
  writeFileSync(trim(reportTo), text);
  if (!built.stated.length) return { profile: false, report: true };
  if (!trim(out)) refuse("OUT is required: the file to write the draft profile to");
  mkdirSync(dirname(resolve(trim(out))), { recursive: true });
  writeFileSync(trim(out), `${JSON.stringify(built.profile, null, 2)}\n`);
  return { profile: true, report: true };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const { STATEMENTS, OBSERVATIONS, CHOSEN, OUT, REPORT } = process.env;
  if (!STATEMENTS || !OUT || !REPORT) { console.error("refused: STATEMENTS, OUT and REPORT are required"); process.exit(2); }
  const read = (file, what, required) => {
    if (!trim(file)) return null;
    try {
      return JSON.parse(readFileSync(trim(file), "utf8"));
    } catch {
      if (!required) return null;
      console.error(`refused: the ${what} could not be read as the step before it wrote it`);
      process.exit(1);
    }
  };
  try {
    const statements = read(STATEMENTS, "statements record", true);
    const observations = read(OBSERVATIONS, "observations record", false);
    // Not required, and never fatal. The step that chooses the roles is the one
    // step of this job that can be skipped whole: no key, no browser, or a
    // model that chose nothing, and the profile is written without a primary
    // and an accent and is whole.
    const chosen = read(CHOSEN, "roles record", false);
    const built = buildProfile({ statements, observations, chosen });
    const text = report({ statements, built, observations, chosen });
    const done = writeProfile(built, text, { out: OUT, reportTo: REPORT });
    const disagreements = built.contested.length + built.majority.length + (observations?.disagreements?.length ?? 0);
    if (!done.profile) {
      // Stdout says what was written and stderr says why it is short, so a
      // caller that reads only the reason has a true one. This is not a
      // refusal: a site that states nothing is a real answer, and the report
      // is the answer.
      console.error("the site states nothing this shape has a field for, so no profile was written, and the report names which parts were looked for");
      console.log(`brand report at ${REPORT}, and no profile`);
      process.exit(0);
    }
    const chose = built.chosen.length ? `, ${built.chosen.length} of them chosen from the colors the site declares rather than stated by it` : "";
    console.log(`${built.parts.length} parts in the draft profile at ${OUT}${chose}, ${built.missing.length} left out for want of a statement, ${disagreements} disagreements. Report at ${REPORT}`);
  } catch (e) {
    console.error(`refused: ${e.message}`);
    process.exit(e instanceof Refusal ? 2 : 1);
  }
}
