// Read a brand: one command, five steps, one call to a model.
//   needs: node >= 22, network to the domain the person named, the browser
//   driver the host installed from the lockfile beside this script, and the
//   host's chromium (for the third and fourth steps only; without it the job
//   still delivers, with a thinner report), network to the text-reasoning
//   service and TEXT_API_KEY (for the fourth step only; without it the job
//   still delivers, without a primary and an accent),
//   WORK=<work folder> RECORDS=<records folder> [JOB_DIR=<job folder>, else MESH_JOB_DIR]
//   DOMAIN=<the address>
//   [PAGES=<n, five by default, counting the home page>]
//   node read-brand.mjs
//
// As a declared command:
//   node read-brand.mjs --job <dir> --records <dir> --work <dir>
//                       [--text-file <path>] [--file <path>::<media_type>]
//
// WHY THERE IS ONE MODEL IN THIS AGENT, AND ONLY ONE. Every judgment this job
// could need is settled in references/what-counts.md as a rule: what is a mark,
// what is a stated color, what is a face the site named. A step that calls a
// model to apply a written rule is the shape that fails, and the rules here are
// written, so four of the five steps are programs and call nothing.
//
// The one that is not is which of a site's colors is its primary and which is
// its accent. Those are assignments rather than places: no site declares them
// anywhere a reader can find, so there is no rule to apply and nothing to read.
// Run against a site whose blue is the entire reason anyone can tell it apart,
// this agent read every color exactly and wrote a profile with no accent in it,
// indistinguishable from a default. Salience is what eyes are for, so one step
// has eyes: it shows a model a picture of the home page and the colors the
// pages declare, and asks which of those fills each role. The model may answer
// only with one of those colors or with none. It never supplies a value, and
// no other step calls it.
//
// It prints one JSON object with a `reply` field. Exit codes: 0 done; 2 the
// settings are not right; 3 the job stops and the reply says why, which the
// harness sends as it stands; 1 failed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const STEPS = ["fetch-the-site", "read-what-it-states", "look-at-what-it-does", "choose-the-roles", "write-the-profile"];

// Five pages in total, counting the home page. A site that disagrees with
// itself does so on its first five, and a sixth costs a fetch to learn nothing.
export const DEFAULT_PAGES = 5;

// The variables the scripts this one runs read for themselves. Cleared before
// each child so a value meant for one step cannot leak into another: OUT is
// the one that would do real damage, since every step writes to it and the
// one left over would be overwritten by the next.
const CHILD_VARS = ["DOMAIN", "PAGES", "OUT", "DIR", "FETCHED", "STATEMENTS", "OBSERVATIONS",
  "CHOSEN", "SHOT", "PROFILE", "REPORT", "NO_PROFILE", "JOB_DIR", "MESH_JOB_DIR"];

const trim = (text) => String(text ?? "").trim();
const sentence = (text) => {
  const t = trim(text);
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

/** What the reply says when nobody named a domain. */
export const NO_DOMAIN = [
  "There is no domain to read a brand from, so none was read.",
  "This job takes the web address of a site, and your word that the site is yours.",
  "Send those and I will read what it states about itself.",
].join(" ");

/** Run one step in its own process, with the environment it reads and nothing
 *  else of ours. Returns the code and both streams rather than throwing: a
 *  step that refuses has something to say and the reply says it. */
export function runScript({ here, script, env = {} }) {
  const child = { ...process.env };
  for (const k of CHILD_VARS) delete child[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined && v !== null && `${v}` !== "") child[k] = String(v);
  const r = spawnSync(process.execPath, [join(here, script)], { env: child, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { code: 1, stdout: r.stdout ?? "", stderr: r.error.message };
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** The line a refusing step printed, for the reply. A step says `refused: `
 *  and one sentence; anything else it printed is for the log. */
export function refusalIn(text) {
  const line = String(text ?? "").split(/\r?\n/).map(trim).find((l) => l.startsWith("refused:"));
  return line ? trim(line.slice("refused:".length)) : "";
}

/** The last line a step printed, which is the one that says what it did. */
export const lastLine = (text) => String(text ?? "").split(/\r?\n/).map(trim).filter(Boolean).pop() ?? "";

/** A step's own line with every local path cut down to a bare file name.
 *
 *  A step prints where it wrote, which is right for a log and wrong for the
 *  reply: the reply goes to the person as the agent's words, and the first
 *  live run put `C:\Users\...\AppData\...\brand-profile.json` in front of them
 *  twice. That is the same thing this agent refuses to write into a profile
 *  and the AgentDoc refuses to publish, and it is worse in a reply, because it
 *  names a folder on a machine the reader has no access to and cannot make
 *  sense of. The file name still tells them which file is meant, and the files
 *  themselves arrive with the job. */
export function withoutPaths(line) {
  // Both rules require a real boundary before the path, and the first version
  // of the Windows one did not. `s://agentmesh.ai/` matches a drive letter, a
  // colon and a slash perfectly well, so "from https://agentmesh.ai/" came out
  // as "from http". A web address is the one thing in these lines that MUST
  // survive: it is what the person gave us and what the evidence points at.
  const bare = (p) => p.split(/[\\/]/).filter(Boolean).pop() ?? "";
  return trim(line)
    .replace(/(^|[\s("'])([A-Za-z]:[\\/][^\s,;)]+)/g, (_m, lead, p) => `${lead}${bare(p)}`)
    .replace(/(^|[\s("'])(\/[^\s,;)]*\/[^\s,;)/]+)/g, (_m, lead, p) => `${lead}${bare(p)}`);
}

/** A whole number of pages, or the default. A person's typo is theirs to fix
 *  and is worth saying out loud rather than rounding away. */
export function pagesFrom(value) {
  const v = trim(value);
  if (!v) return { pages: DEFAULT_PAGES, bad: null };
  if (!/^\d+$/.test(v) || Number(v) < 1) return { pages: null, bad: `how many pages is a whole number of at least one, and this one is ${v}` };
  return { pages: Number(v), bad: null };
}

// A public page is read by anybody with a browser, so reading one asks nobody's
// permission. An earlier version of this job refused a domain the requester had
// not named as their own, which was wrong twice over: it made the agent useless
// for the ordinary case, an agency reading a client's brand, and it protected
// nothing, since the claim could not be checked and only recorded. What guards
// against misuse is elsewhere and stays: the profile says adopted false, the
// report says plainly that nobody has vouched for it, the ceilings keep this
// from hammering anybody's site, and the record says who asked and when.

const json = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

/** The reply, in the order a person reads it: what was read, what the profile
 *  carries, what the site was only observed doing, and what nobody can read
 *  from a website and has to be typed. */
export function replyText({ domain, fetched, statements, observed, chose = null, profile, report, profiled = true, url = null }) {
  const lines = [];
  lines.push(profiled
    ? `I read ${domain} and wrote a draft brand profile from what the site states about itself.`
    : `I read ${domain} and it states nothing about itself that a brand profile can be written from, so there is no profile and there is a report saying what is missing.`);
  if (fetched) lines.push(sentence(withoutPaths(fetched)));
  if (statements) lines.push(sentence(withoutPaths(statements)));
  if (!observed) {
    lines.push("The pages could not be opened in a browser, so the profile is missing what the site sets on its own elements, the five colors and the two faces, and the report does not say what the site renders.");
  } else {
    lines.push(sentence(withoutPaths(observed)));
  }
  // The one place the reply says a model was involved. A person handed a brand
  // profile is owed the fact that two of its values were chosen for them, in
  // the reply and not only in the report, because the reply is the part
  // everybody reads.
  lines.push(chose
    ? sentence(withoutPaths(chose))
    : "The primary and the accent were not chosen, because the step that chooses them did not run, so the profile carries neither.");
  if (profile) lines.push(sentence(withoutPaths(profile)));
  if (report) lines.push(sentence(withoutPaths(report)));
  lines.push(profiled
    ? "This is a draft and nobody has vouched for it. It becomes your profile when you have corrected it and adopted it."
    : "Everything a brand profile needs can be typed in one sitting, and the report names each part and where it would go.");
  if (url) lines.push(url);
  return lines.join(" ");
}

/** The whole job. Every step is a program, and the one that calls a model calls
 *  it at a named point and keeps control, so this is a sequence and not a loop:
 *  each step reads what the one before it wrote, and the first one that cannot
 *  finish stops the job and says which. Two of the five may fail without
 *  stopping it, the browser step and the seeing step, and both of them cost the
 *  profile something the report then names. */
export async function readBrand({ env, here }) {
  const RECORDS = trim(env.RECORDS);
  const WORK = trim(env.WORK);
  const JOB_DIR = trim(env.JOB_DIR) || trim(env.MESH_JOB_DIR);
  const domain = trim(env.DOMAIN);
  const stop = (reply) => ({ ok: false, reply, code: 3, profile: null, report: null, observed: false, chose: false });

  if (!domain) return stop(NO_DOMAIN);
  const { pages, bad } = pagesFrom(env.PAGES);
  if (bad) return stop(`${sentence(bad)} Say a number and I will read that many, counting the home page.`);

  mkdirSync(RECORDS, { recursive: true });
  mkdirSync(WORK, { recursive: true });

  // Written before anything is fetched, so the record of what was asked for
  // exists whether or not the fetching goes well.
  json(join(RECORDS, "asked.json"), {
    asked: "v1", domain, pages, at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
  });

  const fetchedPath = join(RECORDS, "fetched.json");
  const statementsPath = join(RECORDS, "statements.json");
  const observationsPath = join(RECORDS, "observations.json");
  const rolesPath = join(RECORDS, "roles.json");
  // The picture the roles were chosen from, kept as a record. A person told a
  // model chose their accent will want to see what it was looking at.
  const shotPath = join(RECORDS, "home-page.png");
  const profilePath = join(RECORDS, "brand-profile.json");
  const reportPath = join(RECORDS, "brand-report.md");

  const step1 = runScript({ here, script: "fetch-site.mjs", env: { DOMAIN: domain, PAGES: pages, OUT: fetchedPath, DIR: join(RECORDS, "fetched") } });
  if (step1.code !== 0 || !existsSync(fetchedPath)) {
    const why = refusalIn(step1.stderr) || trim(step1.stderr) || "the site could not be fetched";
    return stop(`Nothing was read, and this is the step that stopped: fetch-the-site. ${sentence(why)}`);
  }

  const step2 = runScript({ here, script: "statements.mjs", env: { FETCHED: fetchedPath, OUT: statementsPath } });
  if (step2.code !== 0 || !existsSync(statementsPath)) {
    const why = refusalIn(step2.stderr) || trim(step2.stderr) || "the pages could not be read";
    return stop(`The site was fetched and this is the step that stopped: read-what-it-states. ${sentence(why)}`);
  }

  // The browser step is the one that may fail without ending the job. An
  // observation missing is a thinner report; an observation invented is a
  // wrong profile. Chromium not being there costs the report its second half,
  // and it costs the profile the five colors and the two faces a site sets on
  // its own elements, which are statements and are read by opening the page. A
  // thinner profile that says what it went without is the right answer;
  // filling those in from somewhere else would not be.
  const step3 = runScript({ here, script: "observe.mjs", env: { FETCHED: fetchedPath, STATEMENTS: statementsPath, OUT: observationsPath } });
  const observed = step3.code === 0 && existsSync(observationsPath);
  if (!observed) console.error(`look-at-what-it-does did not run: ${refusalIn(step3.stderr) || trim(step3.stderr) || "no reason given"}`);

  // The seeing step, which is the other one that may fail without ending the
  // job, and the only one that calls a model. It writes its record either way,
  // with the reason in it when nothing was chosen, so the report can say which
  // of no key, no browser, a site that declares no color, and a model that
  // chose none it was. Only a crash leaves no record at all, and then the
  // profile is written with neither role and the report says the step did not
  // run. Two values missing is a thinner profile a person finishes in a moment;
  // two values guessed is a wrong one they find out about later.
  const step4 = runScript({
    here, script: "choose-roles.mjs",
    env: { STATEMENTS: statementsPath, OBSERVATIONS: observed ? observationsPath : "", OUT: rolesPath, SHOT: shotPath },
  });
  const chose = step4.code === 0 && existsSync(rolesPath);
  if (!chose) console.error(`choose-the-roles did not run: ${refusalIn(step4.stderr) || trim(step4.stderr) || "no reason given"}`);

  const step5 = runScript({
    here, script: "profile.mjs",
    env: {
      STATEMENTS: statementsPath, OBSERVATIONS: observed ? observationsPath : "",
      CHOSEN: chose ? rolesPath : "", OUT: profilePath, REPORT: reportPath,
    },
  });
  if (step5.code !== 0 || !existsSync(reportPath)) {
    const why = refusalIn(step5.stderr) || trim(step5.stderr) || "the profile could not be written";
    return stop(`The site was read and this is the step that stopped: write-the-profile. ${sentence(why)}`);
  }

  // A report with no profile beside it is a DELIVERY, not a failure. It is what
  // a site that states nothing about itself produces, and the spec says so:
  // say so and write no profile, because a profile of guesses is worse than
  // none. Reading the missing file as a broken step would turn the most useful
  // answer this job can give, your site says nothing about itself and here is
  // what is missing, into an error the person cannot act on.
  const profiled = existsSync(profilePath);

  // The pieces, last, because a reply sent without pieces.json carries no job.
  const filed = runScript({
    here, script: "pieces.mjs",
    env: { JOB_DIR, PROFILE: profiled ? profilePath : "", REPORT: reportPath, NO_PROFILE: profiled ? "" : "1" },
  });
  if (JOB_DIR && filed.code !== 0) {
    const why = refusalIn(filed.stderr) || trim(filed.stderr) || "the job folder could not be filled";
    return stop(`The profile and the report are written and this is the step that stopped: filing them. ${sentence(why)} Both are in the records, so nothing is lost.`);
  }

  return {
    ok: true,
    code: 0,
    observed,
    chose,
    profiled,
    profile: profiled ? profilePath : null,
    report: reportPath,
    reply: replyText({
      domain,
      fetched: lastLine(step1.stdout),
      statements: lastLine(step2.stdout),
      observed: observed ? lastLine(step3.stdout) : null,
      chose: chose ? lastLine(step4.stdout) : null,
      profile: lastLine(step5.stdout),
      profiled,
      report: null,
    }),
  };
}

/** The flags a declared command carries, mapped to the names this script and
 *  its steps read. A declared command carries the job in its arguments; a
 *  person running it by hand carries it in the environment; both must work,
 *  and arguments win where they were given. */
export function fromArgv(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const val = () => argv[i + 1] ?? "";
    if (a === "--job") { out.JOB_DIR = val(); i += 1; }
    else if (a === "--records") { out.RECORDS = val(); i += 1; }
    else if (a === "--work") { out.WORK = val(); i += 1; }
    else if (a === "--text-file") { out.MESSAGE_FILE = val(); i += 1; }
    // --file is accepted and ignored: no attachment feeds this job, since a
    // domain arrives as an address in the message. Skipping its value keeps it
    // from being read as the next flag.
    else if (a === "--file") { i += 1; }
  }
  // The domain rides in the message rather than in a file: a person sends an
  // address and asks for its brand. The first web address in the message is the
  // domain.
  if (out.MESSAGE_FILE && existsSync(out.MESSAGE_FILE)) {
    let said = "";
    try { said = readFileSync(out.MESSAGE_FILE, "utf8"); } catch { /* the message is unreadable; the reply will say there is no domain */ }
    const found = /\bhttps?:\/\/[^\s<>"']+/i.exec(said) ?? /\b([a-z0-9-]+\.)+[a-z]{2,}\b/i.exec(said);
    if (found) out.DOMAIN = found[0];
  }
  return out;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const fromArgs = fromArgv(process.argv.slice(2));
  const ENV = { ...process.env, ...fromArgs };
  const JOB_DIR = trim(ENV.JOB_DIR) || trim(ENV.MESH_JOB_DIR);
  if (!trim(ENV.WORK) || !trim(ENV.RECORDS) || !JOB_DIR) {
    console.error("WORK, RECORDS and JOB_DIR are required");
    process.exit(2);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const out = await readBrand({ env: { ...ENV, JOB_DIR }, here });
    const { code, ...rest } = out;
    console.log(JSON.stringify(rest, null, 2));
    // Set and let the process end on its own. Calling exit here tears the
    // process down while the last connection is still closing, and node
    // aborts on the way out with the reply already printed and an exit code
    // that says something else entirely.
    process.exitCode = code;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
