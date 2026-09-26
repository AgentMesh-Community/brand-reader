# The brand profile this agent writes

The shape is the published one at `https://schemas.agentmesh.ai/brand/v1`. It
is carried here so the package is whole on a host with no network, and so the
profile writer and the reader of a delivered profile are looking at the same
field list.

What may go in each field is in references/what-counts.md, which is the
authority on that and is not repeated here. This file is the shape: the field
names, the one thing this agent adds to them, and the rule about absence.

## Absence means not stated

Every field is optional and an absent field means the site stated nothing.
It never means a default. An agent that finds no mono face does not quietly
use its own, and a reader of this profile that fills a gap from somewhere else
is doing the one thing the whole profile exists to prevent.

There are two states, not one. A field that is absent was never stated. A
field set to `null` is a statement that the brand has none of that thing and
none is to be used, which is a sentence only a person can say. This agent
therefore never writes `null`. It writes the value or it writes nothing, and
the report names what it wrote nothing for.

## The fields

```json
{
  "brand_profile": "v1",
  "name": "Meridian Analytics",
  "owner": "meridian.example.com",
  "updated": "2026-09-12",

  "palette": {
    "ink": "#101317",
    "ground": "#FFFFFF",
    "heading": "#0B5CD5",
    "link": "#1F6FEB",
    "button": "#1F6FEB",
    "primary": "#1F6FEB",
    "on_primary": "#FFFFFF",
    "accent": "#E9C46A",
    "theme": "#1F6FEB",
    "contrast_floor": "AAA",
    "never_hue_alone": true
  },

  "type": {
    "heading": { "family": "Space Grotesk", "fallback": "system-ui, sans-serif", "weight": 700 },
    "body":    { "family": "IBM Plex Sans", "fallback": "system-ui, sans-serif", "weight": 400 },
    "mono":    null
  },

  "logo": {
    "mark": { "href": "https://meridian.example.com/brand/mark.svg", "media_type": "image/svg+xml" },
    "min_width_px": 88,
    "never": ["recolor the mark", "stretch it or crop it"]
  },

  "voice": { "narration": "en-GB, low, unhurried", "words_per_second": 2.2 },

  "words": {
    "instead_of": [{ "say": "people", "not": "users" }],
    "never_say": ["cutting edge", "seamless"],
    "sentences": "short"
  },

  "legal": {
    "first_mention": "Meridian Analytics®",
    "credit": "Made with Meridian",
    "footer": "© 2026 Meridian Analytics. All rights reserved."
  }
}
```

## The fields a website can fill

These are the only paths this agent writes, and it writes one when a statement
names it:

`name`, `owner`,
`palette.ink`, `palette.ground`, `palette.heading`, `palette.link`,
`palette.button`, `palette.primary`, `palette.on_primary`,
`palette.accent`, `palette.theme`,
`type.heading.family`, `type.heading.fallback`, `type.heading.weight`,
`type.body.family`, `type.body.fallback`, `type.body.weight`,
`type.mono.family`, `type.mono.fallback`, `type.mono.weight`,
`logo.mark.href`, `logo.mark.media_type`,
`legal.first_mention`, `legal.footer`.

Every other field in the shape is one a person types. They are listed in the
report under what no website carries, so the owner can see the half of their
profile that is theirs to finish.

`palette.ink`, `palette.ground`, `palette.heading`, `palette.link` and
`palette.button` are the five places where the place is the meaning, and
`type.heading` and `type.body` are two more. All seven are filled from what the
site's own CSS sets on the site's own elements, whether that was read out of a
stylesheet or off the page as it renders. A run where no page opened carries
none of them and says so. `palette.primary`,
`palette.secondary` and `palette.accent` are assignments rather than places.
They are filled from a custom property whose name says so, and `palette.primary`
and `palette.accent` have one other route: a model shown a picture of the home
page and the colors the pages declare, which may answer only with one of those
colors or with none. Its choice carries evidence saying a model made it, in
words. `palette.secondary` has no such route, because the shape this agent
writes has no field for it. references/what-counts.md holds the reasoning,
under what a picture is for.

## The one addition, and one field worth explaining

**`evidence`**, a block beside the rest, keyed by the same dotted paths the
`can_use` declaration names in its `reads` list. Each key holds the sightings
behind that value: the address, the place within it, and how many times it was
seen. The published shape has nowhere to put this, and every value in a read
profile needs it, so it sits in its own block rather than wrapping the values
and changing what `palette.primary` returns to a reader.

```json
"evidence": {
  "palette.primary": [
    { "url": "https://meridian.example.com/assets/site.css", "in": ":root declares --color-primary", "seen": 4 }
  ],
  "legal.footer": [
    { "url": "https://meridian.example.com/", "in": "the footer", "seen": 1 }
  ]
}
```

A value with no entry in `evidence` was not read off the site by this agent.
A person who edits the profile owns what they typed and clearing the evidence
key for that field is the honest edit.

**`palette.theme`**, which is kept apart from `palette.primary` on purpose. A
web app manifest's `theme_color` is a statement, it is the color the browser
paints its own bar with, and it is not the same claim as a primary color.
Calling it `palette.primary` would be a guess of exactly the kind this agent
refuses, so it is carried under its own name and the owner decides whether it
is also their primary.

## What this agent will not write

`adopted` is `false` on everything this agent writes, and it stays false until
the owner corrects the profile and adopts it. Adoption is the owner's act. The
profile is not signed, is not called finished and is not published anywhere by
this agent.
