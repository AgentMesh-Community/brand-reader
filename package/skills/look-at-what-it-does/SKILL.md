---
name: look-at-what-it-does
description: when the statements are collected and the site is to be looked at as a reader sees it
---

# Look at what it does

Part of brand-reader. when the statements are collected and the site is to be looked at as a reader sees it

## When to use this

when the statements are collected and the site is to be looked at as a reader sees it

## What this needs

- fetched (application/json, required)
- statements (application/json, required)

## What a good result looks like

The five colors and the two font stacks the site's own CSS sets on its own elements, each naming the element and the page it was read off, and beside them what the pages render: the faces they resolved to after the fallbacks, the colors by how much of the page they cover, the contrast the site achieves between its text and its grounds, and every place the site disagrees with itself.

## What it produces

- observations (application/json, per task)

## When it comes back empty

If the pages will not open, say so and carry on with the statements alone. An observation missing is a thinner report and a profile short what the site sets on its own elements; an observation invented is a wrong profile.

## How to do it

Open each fetched page in chromium and read it twice over.

First, what the site's own CSS sets on its own elements. Five colors: the color of body text, the color behind body text, the color of headings where it differs from body text, the color of a link in running text, and the background of the main call to action. And two faces: the font stack on body text and the font stack on the page's first heading, which is the stack the site ASKS FOR and not the face this machine happened to have. Those seven are STATEMENTS and they reach the profile, each naming the element and the page it was read off. The place is the meaning in all of them, so no judgment goes into placing them, and a browser is only a better CSS parser: it settles the cascade and hands back what the owner declared. references/what-counts.md is the authority and says which element is read for each.

Second, what the site does: the faces the pages actually rendered in after the fallbacks, the colors by the share of the page they cover, and the contrast ratio between each text color and the ground behind it. Record the disagreements plainly: four blues across five pages, two heading faces, a stated theme color that appears nowhere on any page.

Nothing in that second half enters the profile, because placing any of it would take a decision the owner never published. The value of it is the report: an owner who learns their site uses four blues has learned something worth the job on its own.

## Scripts

Run these from this skill's folder; each one says what it needs at the top.

- scripts/observe.mjs
- scripts/package.json
- scripts/package-lock.json

## References

- references/what-counts.md
