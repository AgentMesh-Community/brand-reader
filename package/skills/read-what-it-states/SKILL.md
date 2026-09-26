---
name: read-what-it-states
description: when the pages and stylesheets have been fetched
---

# Read what it states

Part of brand-reader. when the pages and stylesheets have been fetched

## When to use this

when the pages and stylesheets have been fetched

## What this needs

- fetched (application/json, required)

## What a good result looks like

Every statement the site makes about itself, each with the address, the element or rule it was found in, and how many times it was seen: the theme color, the custom properties whose names say brand, the font families the stylesheets name, the mark the site names as its own, the trademark on first mention, and the copyright line.

## What it produces

- statements (application/json, per task)

## When it comes back empty

A site that states nothing is a real answer. Say which of the six were looked for and found nothing, and write no statement that was not found.

## How to do it

A statement is something the site declares about itself, in a place whose purpose is to declare it. references/what-counts.md lists what qualifies for each part of the profile and what does not, and it is the authority here. The one to watch is the favicon: it is on every site, it is a sixteen pixel tab picture, and a brand profile carrying one as the mark looks deliberate and is wrong, which is the exact silent wrongness this step exists to prevent.

Nothing is sampled and nothing is inferred. A color taken out of a logo image, a face guessed from how a heading looks, and a primary color chosen because it appears most are all inferences, and the next step reports them.

The five colors a site sets on its own elements, its ink, its ground, its heading color, its link color and its button, and the two font stacks it asks for on its body and its headings, are statements too, and this step does not collect them. What a rule sets is not what an element comes to: the cascade, the media queries and the specificity decide between them, and the next step opens the pages and settles that. On a site whose stylesheets all sit on another host, that step is the only one that reads a face at all.

## References

- references/what-counts.md
- references/brand-profile.md
