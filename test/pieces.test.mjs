// The job folder lists what was delivered, by the step that made it.
//
// What is worth pinning: a finished job becomes a job folder with the draft
// profile and the report under out/, listed in pieces.json in the offering's
// order with the step that made each; a delivery short of either one is refused
// BY NAME and writes no pieces.json at all; a profile that is not readable JSON
// is refused before it is placed, because it is about to be handed to other
// agents as a brand; and the one delivery that is short on purpose, the site
// that states nothing, has to be asked for.
// Run: node --test test/pieces.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PIECES, STEP_OF, fill, plan } from "../scripts/pieces.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "pieces.mjs");

const PROFILE = {
  brand_profile: "v1",
  owner: "meridian.example.com",
  updated: "2026-09-12",
  adopted: false,
  palette: { primary: "#1F6FEB" },
  evidence: { "palette.primary": [{ url: "https://meridian.example.com/a.css", in: ":root { --color-primary }", seen: 4 }] },
};
const REPORT = "# Brand report for meridian.example.com\n\nThis is a draft. Nobody has vouched for it.\n";

/** A records folder as the step before this one leaves it: the draft profile
 *  and the report beside it, and an empty job folder to fill. */
function work() {
  const dir = mkdtempSync(join(tmpdir(), "brand-pieces-"));
  const records = join(dir, "records");
  const job = join(dir, "job");
  mkdirSync(records, { recursive: true });
  mkdirSync(job, { recursive: true });
  const profile = join(records, "brand-profile.json");
  const report = join(records, "brand-report.md");
  writeFileSync(profile, JSON.stringify(PROFILE, null, 2) + "\n");
  writeFileSync(report, REPORT);
  return { dir, records, job, profile, report, drop: () => rmSync(dir, { recursive: true, force: true }) };
}

test("a delivery lists both pieces by the step that made it, and places each under out/", () => {
  const w = work();
  try {
    const listed = fill(w.job, plan({ profilePath: w.profile, reportPath: w.report }));
    assert.deepEqual(listed.map((e) => [e.name, e.step, e.path]), [
      ["brand profile", "write-the-profile", "out/brand-profile.json"],
      ["brand report", "write-the-profile", "out/brand-report.md"],
    ]);
    for (const e of listed) {
      assert.deepEqual(Object.keys(e), ["name", "step", "path", "media_type", "produced_from", "about"]);
      assert.ok(existsSync(join(w.job, e.path)), `${e.path} was not placed`);
      // The sentence travels with the piece and is what the next agent reads,
      // so an empty one is a piece that arrives unexplained.
      assert.ok(e.about && e.about.trim().length > 20, `${e.name} carries no sentence saying what it is`);
    }
    assert.deepEqual(listed.map((e) => e.media_type), ["application/json", "text/markdown"]);
    assert.deepEqual(listed.map((e) => e.produced_from), [["domain"], ["domain", "brand profile"]]);
    assert.deepEqual(JSON.parse(readFileSync(join(w.job, "out", "brand-profile.json"), "utf8")), PROFILE);
    assert.equal(readFileSync(join(w.job, "out", "brand-report.md"), "utf8"), REPORT);
    assert.deepEqual(JSON.parse(readFileSync(join(w.job, "pieces.json"), "utf8")), listed);
    assert.equal(PIECES.length, 2);
    assert.deepEqual(Object.keys(STEP_OF), ["brand profile", "brand report"]);
  } finally {
    w.drop();
  }
});

test("a delivery short of either one is refused by name, and nothing is listed", () => {
  const w = work();
  try {
    assert.throws(() => plan({ reportPath: w.report }), /^Error: the brand profile is missing/);
    assert.throws(() => plan({ profilePath: w.profile }), /^Error: the brand report is missing/);
    assert.throws(() => plan({}), /the brand profile is missing/);
    assert.throws(() => plan({ profilePath: "  ", reportPath: w.report }), /the brand profile is missing/);

    // The profile alone is not a delivery either: the report is where an owner
    // learns which half of their profile is empty and where the site disagrees
    // with itself.
    assert.throws(() => plan({ profilePath: w.profile, reportPath: "" }), /the brand report is missing/);

    // Refused before anything is placed: the folder is left as it was found.
    assert.throws(() => fill(w.job, plan({ profilePath: join(w.records, "no-profile.json"), reportPath: w.report })), /the brand profile is not at /);
    assert.ok(!existsSync(join(w.job, "pieces.json")), "pieces.json was written for a refused delivery");
    assert.ok(!existsSync(join(w.job, "out")), "a piece was placed for a refused delivery");

    assert.throws(() => fill(w.job, plan({ profilePath: w.profile, reportPath: join(w.records, "no-report.md") })), /the brand report is not at /);
    assert.ok(!existsSync(join(w.job, "out")), "a piece was placed for a refused delivery");
  } finally {
    w.drop();
  }
});

test("a profile that is not readable JSON is refused before it is placed", () => {
  const w = work();
  try {
    writeFileSync(w.profile, "{ brand_profile: v1, and this is not JSON");
    assert.throws(() => fill(w.job, plan({ profilePath: w.profile, reportPath: w.report })),
      /the brand profile is not readable as JSON, and it is about to be handed to other agents as a brand/);
    assert.ok(!existsSync(join(w.job, "pieces.json")));
    assert.ok(!existsSync(join(w.job, "out")));
  } finally {
    w.drop();
  }
});

test("the site that states nothing delivers the report alone, and it has to be asked for", () => {
  const w = work();
  try {
    const listed = fill(w.job, plan({ reportPath: w.report, noProfile: true }));
    assert.deepEqual(listed.map((e) => e.name), ["brand report"]);
    assert.deepEqual(listed[0].produced_from, ["domain"], "there is no profile for the report to have been produced from");
    assert.ok(existsSync(join(w.job, "out", "brand-report.md")));
    assert.ok(!existsSync(join(w.job, "out", "brand-profile.json")));
    assert.equal(JSON.parse(readFileSync(join(w.job, "pieces.json"), "utf8")).length, 1);
  } finally {
    w.drop();
  }
});

test("run from the shell, it fills the job folder the adapter reads", () => {
  const w = work();
  try {
    const env = { ...process.env, JOB_DIR: w.job, PROFILE: w.profile, REPORT: w.report };
    const r = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /2 pieces listed .*pieces\.json: out\/brand-profile\.json, out\/brand-report\.md/);
    assert.equal(JSON.parse(readFileSync(join(w.job, "pieces.json"), "utf8")).length, 2);

    const short = spawnSync(process.execPath, [script], { env: { ...env, PROFILE: "" }, encoding: "utf8" });
    assert.equal(short.status, 1);
    assert.match(short.stderr, /^refused: the brand profile is missing/);

    const only = spawnSync(process.execPath, [script], { env: { ...env, PROFILE: "", NO_PROFILE: "1" }, encoding: "utf8" });
    assert.equal(only.status, 0, only.stderr);
    assert.match(only.stdout, /1 pieces listed/);

    const missing = spawnSync(process.execPath, [script], { env: { ...env, JOB_DIR: join(w.dir, "no-such-folder") }, encoding: "utf8" });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /^refused: the job folder does not exist/);

    const nothing = spawnSync(process.execPath, [script], { env: { ...process.env, JOB_DIR: w.job, PROFILE: "", REPORT: "" }, encoding: "utf8" });
    assert.equal(nothing.status, 2);
    assert.match(nothing.stderr, /^refused: JOB_DIR and REPORT are required/);
  } finally {
    w.drop();
  }
});
