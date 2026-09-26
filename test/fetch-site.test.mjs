// The fetch step takes the home page, the pages it links to ON THE SAME HOST,
// the web app manifest and the stylesheets those pages name, and nothing else.
//
// What is worth pinning: a link off the domain is not followed and a link that
// is not https is not followed; another host under the same domain is another
// site, is not followed, and is named in the record where a person will read
// it; a domain that redirects to its www is read and not refused, and the host
// is where the home page landed; a redirect off https is refused; the page cap
// holds; the deadline over all the requests together stops the fetching and
// keeps what did arrive; a home page that is not a web page is refused; and no
// local file path reaches the record, whatever the folders were called.
// Run: node --test test/fetch-site.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  DEFAULT_PAGES, MAX_PAGES, Refusal, TOTAL_MS,
  fetchResource, fetchSite, fileNameFor, linksInPage, nextPages, pageKey,
  pageLimit, registrableDomain, siteHost, siteUrl, summarise, writeFetched,
} from "../scripts/fetch-site.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "fetch-site.mjs");

const HOME = `<!doctype html><html><head>
<title>Meridian Analytics</title>
<link rel="manifest" href="/site.webmanifest">
<link rel="stylesheet" href="/brand.css">
<link rel="stylesheet" href="https://cdn.other.test/base.css">
<link rel="icon" sizes="16x16" href="/favicon.ico">
</head><body>
<header><a class="logo" href="/"><img src="/brand/mark.svg" alt="Meridian Analytics"></a></header>
<a href="/about">About</a>
<a href="/work/">Work</a>
<a href="/about#team">The same page again</a>
<a href="https://blog.meridian.example/notes">Notes on another host of ours</a>
<a href="https://other.test/partners">Somebody else</a>
<a href="http://meridian.example/insecure">Not https</a>
<a href="/brochure.pdf">A file and not a page</a>
<a href="mailto:hello@meridian.example">Mail</a>
<script>document.write('<a href="https://tracker.test/pixel">never followed</a>')</script>
<footer><p>&copy; 2026 Meridian Analytics.</p></footer>
</body></html>`;

const ABOUT = `<!doctype html><html><head><title>About</title>
<link rel="stylesheet" href="/brand.css">
<link rel="stylesheet" href="/about.css">
</head><body><h1>About</h1></body></html>`;

const PLAIN = `<!doctype html><html><head><title>A page</title></head><body><p>Words.</p></body></html>`;
const MANIFEST = JSON.stringify({ name: "Meridian Analytics", theme_color: "#1F6FEB", icons: [] });
const CSS = ":root { --brand-primary: #1F6FEB; }";

/** A site that answers from a table, so every test below runs with no network
 *  at all. Anything not in the table answers the way a name that does not
 *  exist answers. */
function fakeSite(pages, { clockStep = 0 } = {}) {
  const calls = [];
  let clock = Date.parse("2026-09-12T09:00:00.000Z");
  const io = {
    fetch: async (address) => {
      calls.push(address);
      clock += clockStep;
      const found = pages[address] ?? null;
      if (!found) {
        const e = new Error("fetch failed");
        e.cause = { code: "ENOTFOUND" };
        throw e;
      }
      const body = typeof found === "string" ? found : (found.body ?? "");
      const status = typeof found === "string" ? 200 : (found.status ?? 200);
      const type = typeof found === "string" ? "text/html" : (found.type ?? "text/html");
      return {
        ok: status < 400,
        status,
        url: (typeof found === "string" ? null : found.url) ?? address,
        headers: new Headers(type ? { "content-type": type } : {}),
        arrayBuffer: async () => new TextEncoder().encode(body).buffer,
      };
    },
  };
  return { io, calls, now: () => clock };
}

const meridian = (extra = {}) => ({
  "https://meridian.example/": HOME,
  "https://meridian.example/site.webmanifest": { body: MANIFEST, type: "application/manifest+json" },
  "https://meridian.example/brand.css": { body: CSS, type: "text/css" },
  "https://meridian.example/about.css": { body: ".card { color: #101317 }", type: "text/css" },
  "https://meridian.example/about": ABOUT,
  "https://meridian.example/work/": PLAIN,
  "https://blog.meridian.example/notes": PLAIN,
  ...extra,
});

test("the address, the domain it belongs to, and the pages it names", () => {
  assert.equal(siteUrl("meridian.example").href, "https://meridian.example/");
  assert.equal(siteUrl("  https://meridian.example/brand  ").href, "https://meridian.example/brand");
  assert.throws(() => siteUrl("http://meridian.example"), /is not https/);
  assert.throws(() => siteUrl("file:///etc/passwd"), /file addresses are never opened|is a file address/);
  assert.throws(() => siteUrl("https://user:secret@meridian.example"), /carries a sign-in/);
  assert.throws(() => siteUrl("https://localhost:3000"), /names a machine on this network/);
  assert.throws(() => siteUrl("https://10.1.2.3/"), /numbered address/);
  assert.throws(() => siteUrl("   "), /no domain was given/);

  assert.equal(registrableDomain("meridian.example"), "meridian.example");
  assert.equal(registrableDomain("www.meridian.example"), "meridian.example");
  assert.equal(registrableDomain("blog.meridian.example"), "meridian.example");
  assert.equal(registrableDomain("meridian.co.uk"), "meridian.co.uk");
  assert.equal(registrableDomain("shop.meridian.co.uk"), "meridian.co.uk");
  assert.equal(registrableDomain("other.test"), "other.test");

  assert.equal(pageKey("https://meridian.example/about#team"), "https://meridian.example/about");
  assert.equal(pageKey("https://meridian.example/work/"), "https://meridian.example/work");

  const named = linksInPage(HOME);
  assert.equal(named.manifest, "/site.webmanifest");
  assert.deepEqual(named.stylesheets, ["/brand.css", "https://cdn.other.test/base.css"]);
  assert.ok(!named.anchors.includes("https://tracker.test/pixel"), "a link a script writes is not a link the page names");

  assert.equal(pageLimit(undefined), DEFAULT_PAGES);
  assert.equal(pageLimit("2"), 2);
  assert.equal(pageLimit(1), 1, "one page is the home page on its own");
  assert.throws(() => pageLimit(0), /counting the home page/, "the home page is always fetched, so nought is not a count");
  assert.throws(() => pageLimit("nine"), /a whole number/);
  assert.throws(() => pageLimit(MAX_PAGES + 1), /at most/);
});

test("a link off the domain is not followed, and neither is one that is not https", async () => {
  const base = "https://meridian.example/";
  const { take, skipped } = nextPages(linksInPage(HOME).anchors, { base, host: "meridian.example", domain: "meridian.example", limit: 5 });
  assert.deepEqual(take, [
    "https://meridian.example/about",
    "https://meridian.example/work/",
  ], "the host it was given, and other.test and blog.meridian.example are both other sites");
  assert.ok(skipped.some((s) => /links to 1 page off meridian\.example/.test(s)));
  assert.ok(skipped.some((s) => /links to 1 page that is not https/.test(s)));
  assert.ok(skipped.some((s) => /links to 1 file that is not a web page/.test(s)));

  const site = fakeSite(meridian());
  const fetched = await fetchSite({ domain: "meridian.example", now: site.now }, site.io);
  assert.ok(!site.calls.some((c) => /other\.test|tracker\.test|brochure\.pdf|mailto/.test(c)), `nothing off the domain was fetched: ${site.calls.join(", ")}`);
  assert.ok(!fetched.resources.some((r) => /other\.test/.test(r.address)), "a stylesheet on somebody else's host is not fetched either");
  assert.ok(fetched.skipped.some((s) => /1 stylesheet off meridian\.example/.test(s)));

  // What it did take: the home page, the manifest, the two pages on the host it
  // was given and the two stylesheets those pages name, each with the moment it
  // was fetched and a digest so a later step can say where a value was seen.
  assert.deepEqual(fetched.resources.map((r) => [r.id, r.kind, r.address]), [
    ["p1", "page", "https://meridian.example/"],
    ["m1", "manifest", "https://meridian.example/site.webmanifest"],
    ["p2", "page", "https://meridian.example/about"],
    ["p3", "page", "https://meridian.example/work/"],
    ["s1", "stylesheet", "https://meridian.example/brand.css"],
    ["s2", "stylesheet", "https://meridian.example/about.css"],
  ]);
  assert.equal(fetched.resources[0].role, "home");
  assert.equal(fetched.host, "meridian.example");
  assert.deepEqual(fetched.resources.find((r) => r.id === "s1").named_by, ["p1", "p2"]);
  for (const resource of fetched.resources) {
    assert.match(resource.sha256, /^[0-9a-f]{64}$/);
    assert.match(resource.fetched, /^2026-09-12T09:00:00\.000Z$/);
    assert.ok(resource.bytes > 0 && typeof resource.text === "string");
  }
  assert.equal(summarise(fetched), "fetched the home page and 2 pages it links to, the web app manifest, 2 stylesheets from https://meridian.example/");
});

test("another host under the same domain is another site, and the record says it was seen", async () => {
  // The mistake this replaced: blog.meridian.example was read as more pages of
  // meridian.example, so its ground, its ink and its mark came back as a second
  // brand, every field was contested and the profile carried none of them.
  const site = fakeSite(meridian());
  const fetched = await fetchSite({ domain: "meridian.example", now: site.now }, site.io);
  assert.ok(!site.calls.some((c) => /blog\.meridian\.example/.test(c)), "another host was fetched");
  assert.ok(
    fetched.skipped.some((s) => /links to 1 page on another host under meridian\.example \(blog\.meridian\.example\), and another host is another site whose brand is its own, so it was not followed/.test(s)),
    `the record does not say which host was seen and not followed: ${fetched.skipped.join(" | ")}`,
  );

  // www is the site itself, by a convention older than the web.
  assert.equal(siteHost("www.meridian.example"), "meridian.example");
  assert.equal(siteHost("BLOG.Meridian.example."), "blog.meridian.example");
  const both = nextPages(["https://www.meridian.example/about", "https://meridian.example/work/", "https://shop.meridian.example/"], {
    base: "https://www.meridian.example/", host: "www.meridian.example", domain: "meridian.example", limit: 5,
  });
  assert.deepEqual(both.take, ["https://www.meridian.example/about", "https://meridian.example/work/"]);
  assert.ok(both.skipped.some((s) => /shop\.meridian\.example/.test(s)));

  // A domain that sends you to its www is answering, not refusing, and the host
  // everything after the home page is held to is where the home page landed.
  const redirected = fakeSite({
    "https://meridian.example/": { body: `<!doctype html><html><head><title>M</title></head><body><a href="/about">About</a><a href="https://interrupt.meridian.example/x">Elsewhere</a></body></html>`, url: "https://www.meridian.example/" },
    "https://www.meridian.example/about": PLAIN,
  });
  const moved = await fetchSite({ domain: "meridian.example", now: redirected.now }, redirected.io);
  assert.equal(moved.site, "https://www.meridian.example/");
  assert.equal(moved.host, "www.meridian.example");
  assert.deepEqual(moved.resources.map((r) => r.address), ["https://www.meridian.example/", "https://www.meridian.example/about"]);
  assert.ok(moved.skipped.some((s) => /interrupt\.meridian\.example/.test(s)));

  const io = { fetch: async () => { throw new Error("never asked"); } };
  await assert.rejects(
    fetchResource("https://blog.meridian.example/notes", { io, domain: "meridian.example", host: "meridian.example" }),
    /is on a different host from meridian\.example, and another host is another site/,
  );
  const sideways = { fetch: async () => ({ ok: true, status: 200, url: "https://blog.meridian.example/", headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => new TextEncoder().encode(PLAIN).buffer }) };
  await assert.rejects(
    fetchResource("https://meridian.example/about", { io: sideways, domain: "meridian.example", host: "meridian.example" }),
    /redirected to https:\/\/blog\.meridian\.example\/, which is on a different host from meridian\.example, so nothing was read/,
  );
});

test("a redirect off https is refused, and so is every address that is not one", async () => {
  const offHttps = {
    io: { fetch: async () => ({ ok: true, status: 200, url: "http://meridian.example/", headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => new TextEncoder().encode(HOME).buffer }) },
  };
  await assert.rejects(
    fetchResource("https://meridian.example/", { io: offHttps.io }),
    /redirected to http:\/\/meridian\.example\/, which is not https, so nothing was read/,
  );
  await assert.rejects(fetchSite({ domain: "meridian.example" }, offHttps.io), (e) => e instanceof Refusal && /not https/.test(e.message));

  // A redirect that lands on somebody else's domain is the same refusal: the
  // person claimed one domain as theirs and nothing else was claimed at all.
  const offDomain = { fetch: async () => ({ ok: true, status: 200, url: "https://other.test/", headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => new TextEncoder().encode(HOME).buffer }) };
  await assert.rejects(
    fetchResource("https://meridian.example/", { io: offDomain, domain: "meridian.example" }),
    /redirected to https:\/\/other\.test\/, which is off meridian\.example/,
  );

  const io = { fetch: async () => { throw new Error("never asked"); } };
  await assert.rejects(fetchResource("http://meridian.example/", { io }), /is not https/);
  await assert.rejects(fetchResource("file:///etc/passwd", { io }), /file addresses are never opened/);
  await assert.rejects(fetchResource("data:text/html,<h1>hi</h1>", { io }), /data addresses are never opened/);
  await assert.rejects(fetchResource("https://user:secret@meridian.example/", { io }), /carries a sign-in/);
  await assert.rejects(fetchResource("https://meridian.example/x", { io, domain: "other.test" }), /is off other\.test/);

  // The home page is the one fetch a refusal stops the step for: a brand is
  // not read from an error page.
  const answers = (status) => ({ fetch: async (address) => ({ ok: status < 400, status, url: address, headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => new TextEncoder().encode("").buffer }) });
  await assert.rejects(fetchSite({ domain: "meridian.example" }, answers(404)), /answered 404/);
  await assert.rejects(fetchSite({ domain: "meridian.example" }, answers(403)), /asks for a sign-in/);

  const notAPage = { fetch: async (address) => ({ ok: true, status: 200, url: address, headers: new Headers({ "content-type": "application/json" }), arrayBuffer: async () => new TextEncoder().encode("{}").buffer }) };
  await assert.rejects(fetchSite({ domain: "meridian.example" }, notAPage), /which is not a web page, so no brand was read from it/);

  const gone = { fetch: async () => { const e = new Error("fetch failed"); e.cause = { code: "ENOTFOUND" }; throw e; } };
  await assert.rejects(fetchSite({ domain: "meridian.example" }, gone), /there is no web address by that name/);

  const huge = { fetch: async (address) => ({ ok: true, status: 200, url: address, headers: new Headers({ "content-type": "text/html" }), arrayBuffer: async () => new TextEncoder().encode("x".repeat(4000)).buffer }) };
  await assert.rejects(fetchResource("https://meridian.example/", { io: huge, limit: 1024 }), /larger than the 1 kilobytes this step will read/);
});

test("the page cap holds, and what it could not take is said plainly", async () => {
  const links = Array.from({ length: 9 }, (_, i) => `<a href="/page-${i + 1}">Page ${i + 1}</a>`).join("\n");
  const home = `<!doctype html><html><head><title>Many</title></head><body>${links}</body></html>`;
  const table = { "https://meridian.example/": home };
  for (let i = 1; i <= 9; i++) table[`https://meridian.example/page-${i}`] = PLAIN;

  // The count is of pages in total and the home page is one of them, so three
  // means the home page and two it links to.
  const site = fakeSite(table);
  const fetched = await fetchSite({ domain: "meridian.example", pages: 3, now: site.now }, site.io);
  assert.equal(fetched.resources.filter((r) => r.kind === "page").length, 3, "the home page counts towards the three asked for");
  assert.deepEqual(fetched.resources.map((r) => r.address), [
    "https://meridian.example/",
    "https://meridian.example/page-1",
    "https://meridian.example/page-2",
  ]);
  assert.equal(site.calls.length, 3, "no page past the cap is even asked for");
  assert.equal(fetched.pages_asked, 3);
  assert.ok(fetched.skipped.some((s) => /7 pages on meridian\.example past the 3 pages asked for, which were not fetched/.test(s)));
  assert.ok(fetched.skipped.some((s) => /names no web app manifest/.test(s)));

  // One page means the home page alone, which is a real answer and not an error.
  const only = fakeSite(table);
  const alone = await fetchSite({ domain: "meridian.example", pages: 1, now: only.now }, only.io);
  assert.equal(alone.resources.length, 1);
  assert.equal(summarise(alone), "fetched the home page, no web app manifest, no stylesheet from https://meridian.example/");
});

test("a slow site costs the deadline and not the task, and what did arrive is kept", async () => {
  // Every request takes half the deadline, so the home page and the manifest
  // arrive and nothing after them does.
  const site = fakeSite(meridian(), { clockStep: TOTAL_MS / 2 });
  const fetched = await fetchSite({ domain: "meridian.example", now: site.now }, site.io);
  assert.deepEqual(fetched.resources.map((r) => r.kind), ["page", "manifest"], "the home page it did get is still kept");
  assert.ok(fetched.skipped.some((s) => /there was no time left to fetch https:\/\/meridian\.example\/about/.test(s)));
  assert.ok(fetched.skipped.some((s) => /there was no time left to fetch https:\/\/meridian\.example\/brand\.css/.test(s)));
  for (const line of fetched.skipped) assert.ok(!line.includes("—"), "a line a person reads carries no em dash");
});

test("no local path reaches the record, whatever the folders were called", async () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-fetch-"));
  try {
    const site = fakeSite(meridian());
    const fetched = await fetchSite({ domain: "meridian.example", now: site.now }, site.io);
    const out = join(dir, "records", "job-1", "fetched.json");
    const bodies = join(dir, "records", "job-1", "fetched");
    writeFetched(fetched, { out, dir: bodies });

    const written = readFileSync(out, "utf8");
    assert.ok(!written.includes(dir), "the folder the record was written to is in the record");
    assert.ok(!written.includes(dir.replace(/\\/g, "\\\\")), "the folder the record was written to is in the record");
    assert.ok(!written.includes(tmpdir()), "a local path is in the record");

    const record = JSON.parse(written);
    assert.equal(record.fetched, "v1");
    assert.equal(record.site, "https://meridian.example/");
    assert.equal(record.domain, "meridian.example");
    for (const resource of record.resources) {
      assert.ok(!/[\\/]/.test(resource.file), `${resource.file} is a path and not a bare name`);
      assert.equal(resource.file, fileNameFor(resource));
      assert.ok(resource.address.startsWith("https://"), "a resource carries a web address and nothing else");
    }
    assert.equal(record.host, "meridian.example");
    assert.deepEqual(readdirSync(bodies).sort(), ["m1.webmanifest", "p1.html", "p2.html", "p3.html", "s1.css", "s2.css"]);
    assert.equal(readFileSync(join(bodies, "s1.css"), "utf8"), CSS);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("run from the shell, it refuses before it touches the network", () => {
  const dir = mkdtempSync(join(tmpdir(), "brand-fetch-cli-"));
  try {
    const out = join(dir, "fetched.json");
    const run = (env) => spawnSync(process.execPath, [script], { env: { ...process.env, DOMAIN: "", PAGES: "", DIR: "", OUT: out, ...env }, encoding: "utf8" });

    const nothing = run({});
    assert.equal(nothing.status, 2);
    assert.match(nothing.stderr, /^refused: DOMAIN is required/);

    const noOut = run({ DOMAIN: "meridian.example", OUT: "" });
    assert.equal(noOut.status, 2);
    assert.match(noOut.stderr, /^refused: OUT is required/);

    const insecure = run({ DOMAIN: "http://meridian.example" });
    assert.equal(insecure.status, 1);
    assert.match(insecure.stderr, /^refused: the domain http:\/\/meridian\.example\/ is not https/);
    assert.ok(!insecure.stderr.includes("—"), "a refusal a person reads carries no em dash");
    assert.ok(!insecure.stderr.includes(dir), "a refusal never prints where this agent keeps its work");

    const local = run({ DOMAIN: "https://localhost:8080" });
    assert.equal(local.status, 1);
    assert.match(local.stderr, /^refused: the domain https:\/\/localhost:8080\/ was not fetched, because it names a machine on this network/);

    const badCount = run({ DOMAIN: "meridian.example", PAGES: "nine" });
    assert.equal(badCount.status, 2);
    assert.match(badCount.stderr, /^refused: PAGES is how many pages to fetch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
