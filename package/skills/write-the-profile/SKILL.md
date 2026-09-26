---
name: write-the-profile
description: when the statements and the observations are both in hand, and the roles have been chosen or have not
---

# Write the profile

Part of brand-reader. when the statements and the observations are both in hand, and the roles have been chosen or have not

## When to use this

when the statements and the observations are both in hand, and the roles have been chosen or have not

## What this needs

- statements (application/json, required)
- observations (application/json, optional)
- roles (application/json, optional)

## What a good result looks like

A draft brand profile in the published shape carrying only statements, every value naming where it was seen, and a report saying what was found, what the site was observed doing, what cannot be read from a website at all, and where the site disagrees with itself.

## What it produces

- brand profile (application/json, per task)
- brand report (text, per task)

## When it comes back empty

With no statements there is no profile. Write the report alone and say which parts were looked for.

## How to do it

Write the profile in the shape references/brand-profile.md gives. A part with no statement behind it is left out entirely, and the report names it under what could not be read, because absence in the profile means not stated and must never mean a default somebody else will fill in.

A part the site states more than one value for is carried as the value MORE OF THE PAGES STATE, with the counts and the minority in the report and a line of evidence beside the value saying so. A part whose values are stated by the same number of pages is left out, because nothing in a tie says which one the owner meant, and a part whose leaves are tied carries none of its leaves. references/what-counts.md argues that rule, and the argument matters: which of a site's colors is primary is an assignment no count can reach, while four pages saying the heading is one color and one saying another is a fact with weight, and dropping it discards evidence rather than declining to guess.

The primary and the accent arrive from the step before this one already chosen and already checked against the colors the site declares, so nothing is decided here. A role the site states itself keeps what the site said. A role the site states two ways stays out and is reported. What is written carries the evidence that says a model chose it and the site did not, and a profile whose ONLY value is a choice is not written at all, because that is a profile of guesses. Where the roles were not chosen the report says which of no key, no browser, a site that declares no color and a model that chose none it was, since those are four different things for a person to do next.

The report says four things in this order: what was found and where, what the site was observed doing that did not go in the profile, what cannot be read from a website at all and has to be typed by a person, and every place the site disagrees with itself. The last two are the parts an owner actually wants. Say plainly in the closing line that this is a draft, that nobody has vouched for it, and that it becomes their profile when they correct it and adopt it.

## Scripts

Run these from this skill's folder; each one says what it needs at the top.

- scripts/profile.mjs
- scripts/pieces.mjs

## References

- references/brand-profile.md
