---
name: read-a-brand
description: when somebody wants a brand profile for a site and does not want to fill one in by hand
---

# Read a brand

Part of brand-reader. when somebody wants a brand profile for a site and does not want to fill one in by hand

## When to use this

when somebody wants a brand profile for a site and does not want to fill one in by hand

## What this needs

- domain (url, required)
- how many pages (identifier, optional)

## What a good result looks like

A draft brand profile carrying only what the site states about itself, every value naming where it was seen, and beside it a report of what the site was observed doing, what could not be read from a website at all, and every place the site disagrees with itself.

## What it produces

- brand profile (application/json, per task)
- brand report (text, per task)

## When it comes back empty

If the site states nothing about itself, say so and write no profile. A profile of guesses is worse than no profile, because the guesses would be handed to other agents as though the owner had said them.

## How to do it

Run the five steps in order. Each reads what the one before it wrote. Stop at the first step that cannot finish and say which one and why, except the two that may be skipped: look-at-what-it-does and choose-the-roles each cost the profile something the report then names, and neither ends the job.

The one rule that decides every other decision in this job: what the OWNER DECLARED goes in the profile, and what was INFERRED goes in the report and never in the profile. How a thing was read says nothing about who said it, so a color the site's own CSS sets on its own headings is a statement whether it was matched in a stylesheet or read off the page in a browser, which is only a better CSS parser. A theme color in the web app manifest is a statement. The color that covers the most pixels is an inference. A font-family the stylesheet names is a statement. The face a heading renders in after four fallbacks is a fact about the reader's machine as much as the site's, so it is not. The difference is not pedantry: the profile is about to be handed to other agents as though the owner had written it, so anything in it that the owner did not say is a lie told on their behalf.

Every value in the profile carries where it was seen, so a person correcting it can see why this step thought that. A value with no evidence is not written.

There is ONE value in the profile the site did not say, and it is named as one. Which of a site's colors is its primary and which is its accent is an assignment rather than a place: no site declares it anywhere a reader can find, so no rule reaches it and no page states it. The step that chooses the roles shows a model a picture of the home page and the colors the pages DECLARE, and asks which of those fills each role. The model may answer only with one of those colors or with none, it never supplies a color, and the evidence on the value says a model chose it and the site did not. That is the whole of the intelligence in this job, and every other step is a program.

What comes out is a DRAFT. It is not signed, it is not called finished, and the reply says plainly that the owner corrects it and adopts it. A website is one expression of a brand, it is often older than the guidelines and often built by somebody else, so a site that disagrees with itself is reported as disagreeing. Where the pages differ about the same place, the draft carries the value more of them state and the report names the minority with the counts and the pages, which reads the evidence rather than resolving anything; where the pages are split evenly it carries neither.

Every message arrives with a line `job folder: <absolute path>` naming a folder for that message's job. The profile and the report are the pieces, written under that folder's out/ and listed in pieces.json. The pages as fetched, the statements, the observations, the picture of the home page and the roles as chosen are records under records/<job>/ and never go in pieces.json.

## Scripts

Run these from this skill's folder; each one says what it needs at the top.

- scripts/read-brand.mjs
- scripts/fetch-site.mjs
- scripts/statements.mjs
- scripts/observe.mjs
- scripts/choose-roles.mjs
- scripts/profile.mjs
- scripts/pieces.mjs
- scripts/package.json
- scripts/package-lock.json

## References

- references/brand-profile.md
- references/what-counts.md
