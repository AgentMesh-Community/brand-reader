---
name: choose-the-roles
description: when the colors have been read and the two nobody declares, the primary and the accent, are still empty
---

# Choose the roles

Part of brand-reader. when the colors have been read and the two nobody declares, the primary and the accent, are still empty

## When to use this

when the colors have been read and the two nobody declares, the primary and the accent, are still empty

## What this needs

- statements (application/json, required)
- observations (application/json, optional)

## What a good result looks like

One of the colors these pages declare named as the primary and one named as the accent, or the word none for either, chosen by a model that was shown a picture of the home page and that list, with the choice carried into the profile in words that say a model made it and the site did not.

## What it produces

- roles (application/json, per task)

## When it comes back empty

No key, no browser, a site that declares no color, or a model that will not choose is a real answer. Write the record with the reason in it, leave both roles empty and say so. The profile is whole without them, and two values guessed is worse than two values missing.

## How to do it

This is the one step in this agent that calls a model, and it calls it for one thing. Which of a site's colors is its primary and which is its accent is an ASSIGNMENT rather than a place: the site never declares it anywhere a reader can find, so no rule reaches it and the four other steps, which are programs applying written rules, find nothing to apply. Run against a site whose blue is the entire reason anyone can tell it apart, this agent read every color exactly and wrote a profile with no accent in it, indistinguishable from a default. Salience is what eyes are for.

THE MODEL MAY ONLY CHOOSE FROM COLORS ALREADY READ. It is shown a picture of the home page and the colors the pages DECLARE, numbered, and it answers with a number or with the word none. It never supplies a color. A picture gives a hex that antialiasing, an overlay or a gradient has already moved, so a color read off a picture is not the color the site declared, and one a model made up is not the site's at all. Every value in the list was read exactly, off the element the site sets it on. A model that answers with a color of its own, or with a number that is not in the list, is refused, told what was wrong and asked once more, and then this step yields nothing.

NONE IS A REAL ANSWER and the asking makes it easy to give. A page of black text on white with one grey button has no accent, and a model pressed to pick the closest thing would put a color in somebody's brand profile that nobody chose, which is the exact failure the rest of this agent exists to prevent.

A role the site states for itself is not chosen for it, and a role the site states two ways is left contested and not chosen either: choosing between two things the owner published would be resolving a disagreement, which this agent refuses.

The choice reaches the profile with evidence in words a person reads, saying it was chosen from the colors these pages declare, by a model reading the home page, and that the site does not say so itself. Vision is for salience only. Every exact value in the profile, every color and every font stack, is read off the DOM and none of it is read off a picture.

## Scripts

Run these from this skill's folder; each one says what it needs at the top.

- scripts/choose-roles.mjs
- scripts/package.json
- scripts/package-lock.json

## References

- references/what-counts.md
