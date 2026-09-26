// The orchestrator: four steps in order, no model anywhere, and the two
// refusals that have to fire before anything is fetched.
//
// What is worth pinning here: a job with no domain and a job whose domain
// nobody claimed both stop BEFORE the network, because the claim is what makes
// the fetch allowed; a claim is a phrase somebody actually said and not merely
// the absence of the word no, or the refusal never fires through the declared
// command, where the claim arrives as the whole message; a refusing step's one
// sentence reaches the reply and its other output does not; and the reply says
// plainly when the browser step did not run, because a thinner report is a fact
// the person should get rather than a silence.
// Run: node --test test/read-brand.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PAGES, NO_DOMAIN, STEPS,
  fromArgv, lastLine, pagesFrom, readBrand, refusalIn, replyText, withoutPaths,
} from "../scripts/read-brand.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, "..", "scripts");

// Awaited, deliberately. Written synchronously this swept the folder away the
// moment an async body returned its promise, so every assertion about a file
// ran against a directory that had already been deleted: the one test that
// looked for a file failed, and the two that checked a file was ABSENT passed
// for the wrong reason, which is the worse outcome of the two.
async function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), "brand-reader-"));
  try { return await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("the five steps are the spec's five, in order", () => {
  assert.deepEqual(STEPS, ["fetch-the-site", "read-what-it-states", "look-at-what-it-does", "choose-the-roles", "write-the-profile"]);
});

test("a job with no domain stops before anything is fetched", async () => {
  await withTemp(async (dir) => {
    const out = await readBrand({ env: { RECORDS: join(dir, "r"), WORK: join(dir, "w"), JOB_DIR: join(dir, "j") }, here: scripts });
    assert.equal(out.ok, false);
    assert.equal(out.code, 3);
    assert.equal(out.reply, NO_DOMAIN);
    // Nothing was written, because nothing was decided.
    assert.equal(existsSync(join(dir, "r", "asked.json")), false);
  });
});

test("what was asked for is recorded before anything is fetched", async () => {
  await withTemp(async (dir) => {
    // The fetch step will refuse this address, which is what we want: the
    // record must already exist by the time it does.
    await readBrand({
      env: {
        RECORDS: join(dir, "r"), WORK: join(dir, "w"), JOB_DIR: join(dir, "j"),
        DOMAIN: "not a domain at all",
      },
      here: scripts,
    });
    const asked = JSON.parse(readFileSync(join(dir, "r", "asked.json"), "utf8"));
    assert.equal(asked.domain, "not a domain at all");
    assert.equal(asked.pages, DEFAULT_PAGES);
    assert.match(asked.at, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test("a page count that is not a whole number is the person's typo, said out loud", async () => {
  assert.deepEqual(pagesFrom(""), { pages: DEFAULT_PAGES, bad: null });
  assert.deepEqual(pagesFrom("3"), { pages: 3, bad: null });
  assert.equal(pagesFrom("2.5").pages, null);
  assert.match(pagesFrom("2.5").bad, /whole number/);
  assert.equal(pagesFrom("0").pages, null);
  await withTemp(async (dir) => {
    const out = await readBrand({
      env: { RECORDS: join(dir, "r"), WORK: join(dir, "w"), JOB_DIR: join(dir, "j"), DOMAIN: "acme.example", PAGES: "lots" },
      here: scripts,
    });
    assert.equal(out.code, 3);
    assert.match(out.reply, /whole number/);
  });
});

test("a refusing step's one sentence reaches the reply and its other output does not", () => {
  const printed = [
    "fetched 1 of 5",
    "refused: acme.example answered with something that is not a web page",
    "TypeError: whatever, at line 41",
  ].join("\n");
  assert.equal(refusalIn(printed), "acme.example answered with something that is not a web page");
  assert.equal(refusalIn("nothing was refused here"), "");
  assert.equal(lastLine(printed), "TypeError: whatever, at line 41");
  assert.equal(lastLine(""), "");
});

test("the reply says when the browser step did not run, and always says it is a draft", () => {
  const withBrowser = replyText({
    domain: "acme.example", fetched: "fetched 5 pages", statements: "found 9 statements",
    observed: "looked at 5 pages", profile: "wrote 4 of 6 parts",
  });
  assert.match(withBrowser, /^I read acme\.example/);
  assert.match(withBrowser, /looked at 5 pages/);
  assert.match(withBrowser, /draft and nobody has vouched for it/);

  const without = replyText({
    domain: "acme.example", fetched: "fetched 5 pages", statements: "found 9 statements",
    observed: null, profile: "wrote 4 of 6 parts",
  });
  assert.match(without, /could not be opened in a browser/);
  // What that costs, said plainly: the report loses its second half and the
  // profile loses the five colors a site sets on its own elements.
  assert.match(without, /the profile is missing what the site sets on its own elements, the five colors and the two faces/);
  assert.match(without, /the report does not say what the site renders/);
  assert.match(without, /draft and nobody has vouched for it/);

  for (const said of [withBrowser, without]) assert.ok(!/—/.test(said), "an em dash reached the person");
});

test("a declared command carries the job in its arguments, and the message carries the domain", async () => {
  await withTemp(async (dir) => {
    const message = join(dir, "message.txt");
    writeFileSync(message, "Could you read https://acme.example/ for us? It is our site.\n");
    const got = fromArgv(["--job", "/j", "--records", "/r", "--work", "/w", "--text-file", message, "--file", "/tmp/x.pdf::application/pdf"]);
    assert.equal(got.JOB_DIR, "/j");
    assert.equal(got.RECORDS, "/r");
    assert.equal(got.WORK, "/w");
    assert.equal(got.DOMAIN, "https://acme.example/");
    // --file is accepted and its value skipped, so it is never read as a flag.
    assert.equal(got["/tmp/x.pdf::application/pdf"], undefined);
  });

  await withTemp(async (dir) => {
    const message = join(dir, "message.txt");
    writeFileSync(message, "Please read acme.example. It belongs to a supplier of ours... actually no.\n");
    const got = fromArgv(["--text-file", message]);
    // A bare domain with no scheme is still the domain.
    assert.equal(got.DOMAIN, "acme.example");
  });

  await withTemp(async (dir) => {
    const message = join(dir, "message.txt");
    writeFileSync(message, "Hello, can you help with something?\n");
    const got = fromArgv(["--text-file", message]);
    assert.equal(got.DOMAIN, undefined, "a message with no address named no domain");
  });
});

// No local path reaches the person. A step prints where it wrote, which is
// right for a log and wrong for a reply: the first live run put an AppData
// path in front of the reader twice. This is the same rule the profile and the
// AgentDoc both hold, and it is worse in a reply, because the folder is on a
// machine the reader cannot see.
test("no local path reaches the reply", () => {
  assert.equal(withoutPaths(String.raw`wrote C:\Users\someone\AppData\Local\Temp\r\brand-profile.json`), "wrote brand-profile.json");
  assert.equal(withoutPaths("report at /var/lib/agents/records/j1/brand-report.md"), "report at brand-report.md");
  assert.equal(withoutPaths("read 6 statements from https://agentmesh.ai/"), "read 6 statements from https://agentmesh.ai/");
  assert.equal(withoutPaths("4 parts in the profile, 10 left out"), "4 parts in the profile, 10 left out");

  const said = replyText({
    domain: "acme.example",
    fetched: String.raw`fetched 5 pages, wrote C:\Users\someone\AppData\Local\Temp\r\fetched.json`,
    statements: "read 6 statements from https://acme.example/",
    observed: null,
    profile: "4 parts in the draft profile at /var/records/j1/brand-profile.json, 10 left out",
  });
  // A drive path, not a URL scheme: "https:/" matches a bare letter-colon-slash
  // and this guard said so, which made it fail on the one thing that has to
  // survive. A real path starts a word.
  assert.ok(!/(^|[\s("'])[A-Za-z]:[\/]/.test(said), `a windows path reached the person: ${said}`);
  assert.ok(!/\/var\//.test(said), `a posix path reached the person: ${said}`);
  assert.match(said, /brand-profile\.json/, "the file name is still worth saying");
  // A web address is not a local path and must survive.
  assert.match(said, /https:\/\/acme\.example\//);
});
