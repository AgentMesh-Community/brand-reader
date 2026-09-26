// Fill a job folder from what the last step wrote: every delivered piece under
// out/, and pieces.json, the list the adapter reads when the reply is sent, one
// entry per piece with the step that made it. The adapter signs the job
// manifest from that list; a reply with no pieces.json carries no job.
//   needs: node >= 22; the draft profile and the report the step before wrote
//   [JOB_DIR=<job folder>, else MESH_JOB_DIR from the host] PROFILE=records/<job>/brand-profile.json REPORT=records/<job>/brand-report.md node pieces.mjs
//   NO_PROFILE=1: the one delivery that is short on purpose, the site that
//   states nothing, so the report goes on its own. Nothing sets it by default
//   and PROFILE is required without it.
//
// The offering has two outputs and they go together. A profile handed over
// without the report is the half that looks finished and is not: the report is
// where an owner learns which half of their profile is empty, what their site
// was seen doing, and where it disagrees with itself. A report handed over
// without the profile is the reading with nothing to correct and adopt. So a
// missing piece is refused by name and pieces.json is not written: a delivery
// short a piece should fail where it can be fixed, not arrive looking whole.
//
// The one delivery that is short on purpose is the site that states nothing.
// There is no profile to write then, and NO_PROFILE says so, because a short
// delivery has to be asked for: silence is a refusal.
//
// The profile is read before it is placed. It is about to be handed to other
// agents as a brand, so a file that is not readable JSON is refused here rather
// than delivered and discovered later.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** Place a piece by its BYTES, never with copyFileSync.
 *
 *  copyFileSync carries the source file's mode to the destination, and a
 *  destination on a mount does not always accept one: a job folder reached
 *  through gcsfuse is served with a fixed file mode and the chmod that
 *  copyFileSync performs is not the mount's to grant. On a host the two are
 *  indistinguishable, which is exactly why this was written the other way and
 *  only came apart the first time a container filed its own pieces.
 *
 *  Writing the bytes moves the content and asks for nothing else, which is all
 *  a delivered piece ever needed. */
const placeBytes = (dest, body) => {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
};

// The two outputs the offering names, in the order it names them, both made by
// the step that writes them. What each was produced from is said in names the
// person knows: the domain they gave, and the profile the report reads back.
// Each carries a sentence saying what it is. Whoever gets this next sees that
// sentence beside the file and nothing else of this folder, so it is written
// for a reader who was not here: what the thing is, and what it is not.
export const PIECES = [
  { name: "brand profile", step: "write-the-profile", media_type: "application/json", produced_from: ["domain"],
    about: "The brand's colours, type and voice as read off its own pages, as data meant to be used by something that renders. Every value is observed, not chosen: where the site says nothing, the profile says nothing." },
  { name: "brand report", step: "write-the-profile", media_type: "text/markdown", produced_from: ["domain", "brand profile"],
    about: "The same reading written for a person, with what was found, where on the site it was found, and what could not be read. Read this to judge the profile; use the profile to build with." },
];
export const STEP_OF = Object.fromEntries(PIECES.map((p) => [p.name, p.step]));

const of = (name) => PIECES.find((p) => p.name === name);
const trim = (text) => String(text ?? "").trim();

/** What to list and what to copy. Pure, so it can be checked without a folder;
 *  the caller does the copying. */
export function plan({ profilePath, reportPath, noProfile = false } = {}) {
  const entries = [];
  const copies = [];

  if (!trim(profilePath) && !noProfile) {
    throw new Error("the brand profile is missing: PROFILE names the draft profile to deliver, and NO_PROFILE says when there is none because the site stated nothing");
  }
  if (!trim(reportPath)) {
    throw new Error("the brand report is missing: REPORT names the report that says what was found, what was only observed, what a person has to type, and where the site disagrees with itself");
  }

  if (trim(profilePath)) {
    const to = `out/${basename(trim(profilePath))}`;
    copies.push({ from: trim(profilePath), to, what: "the brand profile", json: true });
    entries.push({ ...of("brand profile"), path: to });
  }
  const reportTo = `out/${basename(trim(reportPath))}`;
  copies.push({ from: trim(reportPath), to: reportTo, what: "the brand report" });
  entries.push({
    ...of("brand report"),
    path: reportTo,
    produced_from: trim(profilePath) ? of("brand report").produced_from : ["domain"],
  });

  return { entries: entries.map((e) => ({ name: e.name, step: e.step, path: e.path, media_type: e.media_type, produced_from: e.produced_from, about: e.about })), copies };
}

/** Place the files and write the list. Returns the entries as written. Nothing
 *  is written at all until every file has been read and checked, so a refused
 *  delivery leaves no half filled folder behind it. */
export function fill(jobDir, { entries, copies }) {
  const bodies = new Map();
  for (const c of copies) {
    if (!existsSync(c.from)) throw new Error(`${c.what} is not at ${c.from}`);
    const body = readFileSync(c.from);
    if (c.json) {
      try {
        JSON.parse(body.toString("utf8"));
      } catch {
        throw new Error(`${c.what} is not readable as JSON, and it is about to be handed to other agents as a brand`);
      }
    }
    bodies.set(c.to, body);
  }
  for (const c of copies) placeBytes(join(jobDir, c.to), bodies.get(c.to));
  writeFileSync(join(jobDir, "pieces.json"), JSON.stringify(entries, null, 2) + "\n");
  return entries;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const { PROFILE, REPORT, NO_PROFILE } = process.env;
  // The job folder the host prepared for THIS message. It arrives in the
  // environment so that nothing has to copy a path out of a prompt: an agent
  // that read the path from its instructions and wrote its manifest into a
  // folder of its own once handed over finished work as nothing. An explicit
  // JOB_DIR still wins, for a hand run.
  const JOB_DIR = process.env.JOB_DIR || process.env.MESH_JOB_DIR;
  if (!JOB_DIR || !REPORT) { console.error("refused: JOB_DIR and REPORT are required"); process.exit(2); }
  if (!existsSync(JOB_DIR) || !statSync(JOB_DIR).isDirectory()) { console.error(`refused: the job folder does not exist: ${JOB_DIR}`); process.exit(2); }
  try {
    const listed = fill(JOB_DIR, plan({ profilePath: PROFILE, reportPath: REPORT, noProfile: trim(NO_PROFILE) !== "" && trim(NO_PROFILE) !== "0" }));
    console.log(`${listed.length} pieces listed at ${join(JOB_DIR, "pieces.json")}: ${listed.map((e) => e.path).join(", ")}`);
  } catch (e) {
    console.error(`refused: ${e.message}`);
    process.exit(1);
  }
}
