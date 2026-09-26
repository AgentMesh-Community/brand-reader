# What counts as a statement, and what is only an observation

The whole agent turns on one line. A statement is something the OWNER
DECLARED. An observation is something WE INFERRED. Statements go in the
profile. Observations go in the report and never in the profile.

The reason is not tidiness. The profile is handed to other agents as though
the owner had written it, so a value in it that the owner never said is a lie
told on their behalf, and it will be applied to their materials by something
that has no way to know it was a guess. Preferring nothing over a guess is the
rule, everywhere, every time.

## The axis is who said it, not how we read it

An earlier version of this file drew the line in a different place. A value
parsed out of a stylesheet was a statement, and a value read off a rendered
page was an observation, because reading it needed a browser. That was the
wrong axis, and the mistake is worth keeping on the page rather than quietly
correcting.

How we read a thing says nothing about who said it. A browser is a better CSS
parser, and that is all it is doing here: it settles the cascade, the media
queries and the specificity that a pattern over a stylesheet gets wrong, and
it gives back the color the site's own CSS sets on the site's own elements.
The owner declared that color either way. Calling it an observation because a
browser was in the room confuses the reading with the thing read.

langchain.com is the evidence. Run against it, the version that drew the line
at static versus rendered found no colors at all and wrote no profile at all,
because a modern marketing site declares no custom property whose name says
what it is. Nothing about that site was missing. Its colors were in what its
own CSS sets on its own body, its own headings and its own buttons, which the
old line called an observation and dropped on the floor.

Every statement is kept with three things: the address it was found at, the
place within that address, and how many times it was seen. A statement with no
evidence is not written.

Five pages IN TOTAL, counting the home page, is what is read, and it is the
default the person can change. A site that disagrees with itself does so on its
first five pages, and a sixth costs a fetch to learn nothing.

## The mark

Only an image the site NAMES as its own mark counts:

1. an organisation record on the page (schema.org Organization) whose `logo`
   names it,
2. an element the page marks as the logo, by its own class, id or alt text
   saying so, inside the header and linking to the root,
3. an icon in the web app manifest at 180 pixels or more,
4. the apple touch icon, which is 180 by 180 by convention.

Everything else is reported and not used.

**The favicon is the one to watch.** It is on every site, it is a sixteen
pixel tab picture, and a profile carrying one as the mark looks deliberate and
is wrong. That silent wrongness is the reason this file exists.

**A share image is not a mark.** og:image and twitter:image are social cards,
usually a screenshot or a banner with words on it.

**A color is never taken out of the mark.** Sampling a logo is the most
tempting guess available and it is still a guess.

## Color

Stated:

- `theme_color` in the web app manifest,
- the `theme-color` meta tag on the page,
- a CSS custom property whose NAME says what it is: `--brand-*`, `--color-primary`,
  `--accent`, `--ink`, `--ground`, `--blue-400` and the like, declared on
  `:root` or `html`. The name is the statement, whether it names the role the
  color fills or names which color it is. A custom property called `--c3` is
  not one.
- the color the site's own CSS sets on the site's own elements, in the five
  places below, however we came to read it.

### The five places where the place is the meaning

These five are definitional. No judgment goes into placing them, because the
place is the meaning, and a site that sets one has stated it:

- `palette.ink` is the color of body text,
- `palette.ground` is the color behind body text,
- `palette.heading` is the color of headings where it differs from body text,
- `palette.link` is the color of a link in running text,
- `palette.button` is the background of the main call to action.

Each is read off ONE element on ONE page, and the evidence names both, so a
person can open that page and check it. The browser step does the reading,
because the cascade decides these and only a browser settles the cascade on a
real site.

What the reading holds itself to, so that it stays a reading and does not
become a taste:

- The ink is what the `body` element's own color comes to, which is what
  everything on the page inherits unless it says otherwise.
- The ground is what `body` paints, or what `html` paints when `body` paints
  nothing. A page that paints neither has stated no ground: the white a
  browser falls back to is the browser's white and not the site's.
- The heading is the first heading on the page that sits on the page's own
  ground, and it is a statement only where its color differs from the ink. A
  heading inside a dark band is that band's color and not the brand's heading
  color, which is why the ground it sits on is part of the test.
- The link is the first link with WORDS BESIDE IT in its own element, on the
  page's own ground, and outside the header, the navigation and the footer.
  Running text is words with a link among them, and a link alone in its
  wrapper is a button or a card whatever its tag says. Asking for a link
  inside a `p` would have been simpler and finds nothing on a site that writes
  its text in divs, which is most of them.
- The button is the first call to action on the page that paints an opaque
  background of its own, which is the one a reader meets first.
- A color set at less than full opacity is taken as the color it paints over
  the ground behind it, because that is the color of the text.

The five places are read on each of the pages. A site whose pages agree has
stated one color, and the profile carries it with every page it was seen on. A
site whose pages disagree has stated two, and the profile carries the one MORE
OF THEM STATE, with the minority and the counts in the report and in the
evidence. Where no color is stated by more pages than another, the profile
carries neither. The section below argues that rule, because it looks like
resolving a disagreement and it is not.

### A custom property's name is a second route, and a narrower one

**Stating a color and filling a role are two different things**, and only the
second reaches the profile.

The test for a role is that the NAME is unambiguous about which role it fills
to somebody reading the name alone, knowing nothing about the site.
`--color-background` passes that test. `--color-surface` does not, because
surface is a role in some systems and a shade in others, and a wrong guess here
is worse than a silence: a profile that puts a card color in ground gets
applied to a whole page by something with no way to know it was a guess. That
test is the rule, and the list below is what it currently admits.

A name fills a role when what is left of it, once the words that say only "this
is a brand color" are taken off the front, is one of `primary`, `secondary`,
`accent`, `ink` (also `text`, `foreground`, `fg`), `ground` (also `background`,
`bg`), or the word `on` and one of those. So `--brand-primary` and
`--color-primary` fill primary, `--color-on-primary` fills on_primary, and
`--bg` fills ground. `text` and `background` are in because hardly anybody
writes `--ink` or `--ground` and nearly everybody writes `--color-text` and
`--color-background`, so leaving them out would empty the profile in the two
places it is most obviously wrong to be empty. Nothing else is in: no
`surface`, `canvas`, `muted`, `subtle`, `base` or `default`, because placing
any of those takes a taste and this step has none.

`heading`, `link` and `button` are not on that list either, and that is not an
oversight. The name route and the place route are different routes: a property
called `--heading` might be a color or a face or a size, and a property called
`--link` says nothing about whether the site uses it on its links. The color of
a heading is read off a heading.

`--blue-400`, `--color-gray-500` and `--primary-500` fill no role, because a
step on a ramp is not a role, and neither is a state like
`--brand-primary-hover`.

A color that fills no role is still a statement. It is kept, with its address
and its place, and it goes in the report. It never goes in the profile, because
writing it there would say the owner chose that color for something, and they
did not. A site with two hundred palette variables states two hundred colors
and fills five roles, and should come out of this as a small profile and a long
report. Both counts are carried in the statements, so the report can say that
the site states two hundred colors and names five of them, which is the kind
of finding this job exists to produce.

### Inferred, and therefore reported only

A color is inferred when placing it takes a decision the owner never
published:

- which of several colors is `primary`, `secondary` or `accent`,
- any color sampled from an image,
- the color covering the most of a page, and the colors by the share of the
  page they cover,
- the contrast the site achieves, which is a fact about the site and not the
  floor the brand requires. Those are different things and the report says
  which one it is reporting.

`primary`, `secondary` and `accent` are assignments rather than places. Which
of a site's colors is the primary one is a decision the owner takes and does
not publish anywhere a reader can find it, so those three are never filled from
what a page renders, and never from a count. The color covering the most of the
page is the most tempting guess available and it is still a guess.

Two of the three, `primary` and `accent`, have a second route, and it is the
only place in this agent where a model is asked anything. The section below on
what a picture is for says what it may do, which is choose between colors that
were already read exactly, and what it may never do, which is supply one.
`secondary` has no such route: the shape has no field for it, and a role with
nowhere to go is reported rather than chosen.

## Type

Stated: a `font-family` a stylesheet declares for headings or for body text,
with its whole fallback stack, which comes free and is worth carrying.

And, by the same rule as the five colors, the font stack the site's own CSS
sets on its own `body` and on the first heading of the page, read off the page
as it renders. A computed `font-family` is the STACK the site ASKS FOR and not
the face the machine happened to have, so it is the owner's word however we
came to read it. This is the only way a face is read at all on a site whose
stylesheets all sit on somebody else's host, which is most of the modern ones,
and langchain.com is one: the browser has the stack in hand while a reader of
the fetched files has nothing. The heading is read whatever ground it sits on,
because a dark band changes a color and not a face. Pages that ask for
different stacks have stated two, and the profile carries the stack more of
them ask for, by the same count as the five colors. Pages split evenly have
stated two and the profile carries neither.

A stack written through a variable is stated too, and it is followed ONE STEP.
`font-family: var(--brand-font)` with `--brand-font: "Space Grotesk",
system-ui` declared on `:root` is one statement written in two places, so
following it is reading and not inferring. One step and no further: a variable
whose value is another variable, and a variable declared nowhere and given no
fallback, state no face and are counted in the report.

The families a stylesheet ADDRESS names in itself are stated as well. A link to
`https://fonts.googleapis.com/css2?family=Space+Grotesk&family=IBM+Plex+Sans`
names both families on the site's own page, so they are read out of the address
with nothing fetched. That matters, because a stylesheet off the registrable
domain is never fetched and a font service is always off it. An address carries
no fallback stack and says nothing about headings or body text, so the family
alone is the statement.

Inferred: the face the browser actually RESOLVED after the fallbacks, which is
a fact about the reader's machine as much as the site's. That is the one type
reading a browser makes and the owner did not, so it stays in the report.
Report it when it disagrees with what was declared, because a site asking for
a face nobody has is worth knowing about.

A site that declares no face states none. It does not thereby state the
browser default.

## What a picture is for

A picture of the home page is looked at ONCE, for one question: which of the
colors this site declares is its primary, and which is its accent. That is the
one thing in a brand nobody writes down and no rule reaches. Everything else in
this file is read off the DOM, and that does not change because there is now a
screenshot in the room.

The reason is not caution about models. It is that a picture cannot answer the
other questions at all.

A hex read off a picture is not the hex the site declared. By the time a color
reaches a screenshot it has been through antialiasing, which invents colors at
every edge; through whatever overlay, scrim or shadow sits on top of it; and
through a gradient, if the band it is in has one, so the same declared color
arrives as fifty. Sampling it back out gives a color no stylesheet contains, and
the profile would then carry a value the owner could search their whole codebase
for and never find.

A face cannot be named from its shape. Two grotesques at sixteen pixels are the
same picture. A model asked what face this is will answer with a plausible
famous name, and it will be wrong often enough that a profile carrying it is
worse than one carrying nothing, since the next agent along will set a customer's
materials in a face they do not license.

So the picture is shown, and the model is handed the colors that were already
read. It answers with one of them, by number, or with the word none. It never
supplies a value, which is a rule about the SHAPE of the answer and not a request
for restraint: there is no way to name a color it was not given. A model that
answers with a color of its own, or with a number outside the list, is refused,
told what was wrong and asked once more, and after that the roles are simply not
chosen and the report says so.

None is a real answer and the asking is built to make it easy. A page of black
text on white with one grey button has no accent, and a model pressed to pick
the closest thing would put a color in somebody's brand profile that nobody
chose, which is the whole failure this file exists to prevent. It does not
become acceptable because a model made it.

What is chosen says in its evidence that it was chosen, in words a person reads:
chosen from the colors these pages declare, by a model reading the home page,
and the site does not say so itself. A role the site states for itself is never
chosen for it, and a role the site states two ways is left where the rest of
this file leaves a disagreement. The profile is whole without either: a run with
no key, no browser or no answer leaves both out and names the reason, and two
values missing is a thinner draft a person finishes in a minute, where two
values guessed is a wrong one they find out about later.

Salience is what eyes are for, and it is all they are used for here.

## The legal lines

Stated: the copyright line in the footer, and a trademark symbol on the
organisation's name at its first mention on the home page. Both are lines the
site wrote about itself and both are the exact text, never a rewording.

## What no website carries

These are named in the report for a person to type, and no amount of reading a
site will produce them:

- the narration voice,
- the words the brand will not say,
- the things that must never be done to the mark,
- the contrast floor the brand REQUIRES, as opposed to the one it achieves,
- which of two colors is primary when the site uses both everywhere, which a
  model now takes a first go at from a picture of the home page, out of the
  colors the site declares. That is a draft of the owner's decision and not the
  decision, so it stays on this list and the report says a model made it.

Saying this plainly is part of the job. An owner who is told their profile is
half empty and exactly which half can finish it in ten minutes. An owner handed
a full-looking profile with five guessed fields in it will find out later, from
a video with the wrong blue in it.

## Where the pages differ, the count is evidence

When the pages disagree about a value, the profile carries the value MOST OF
THEM STATE. The minority is named in the report with its own count and its
own pages, and the evidence beside the carried value says in words that it was
the one most pages stated and what the others stated instead. Where no value is
stated by more pages than another, the profile carries nothing, which is the
older rule and is the right one for a genuine tie.

This looks like resolving a disagreement and it is not. Two different things
wear the same coat, and telling them apart is the whole of this file.

**Which of a site's colors is primary is an ASSIGNMENT.** Nobody publishes it.
No element carries it, no count reaches it, and no amount of reading will: a
color that covers half of every page may be a background, and the color a brand
is known by may appear once, small, on one page. Counting there would be
inventing a decision the owner never took, and it stays refused. Nothing in
this section reaches `primary`, `secondary` or `accent`: how many pages state a
color says nothing about which color the owner calls the primary one, and
weighing the pages is not a route to an assignment.

**Four pages saying the heading is one color and one page saying another is a
FACT WITH WEIGHT.** Both values are the owner's word. Both were read in the
same place by the same test. Nothing has to be assigned, invented or preferred;
the only question is which of the owner's own words the profile carries, and
four is more than one. A reader that throws that away is not declining to
guess, because there is no guess in front of it. It is discarding evidence and
calling the result caution.

What that cost, once. On langchain.com the heading color is `#7FC8FF` on four
of the five pages read and `#E5F4FF` on the home page alone. The old rule saw
two values, dropped the field, and dropped the heading face beside it for the
same reason. `#7FC8FF` is the blue that brand is known by, it was in hand, it
was stated four times, and the page built from that profile came out in nobody's
blue and looked like every other page built from a profile with no colors in it.
The rule that produced that is not careful. It is lossy.

Nothing is hidden by counting. The report says both values, how many pages
stated each, and which pages those were, so an owner who thinks the home page
is the one that is right can see the count that went against it and correct the
draft. A draft that is wrong in a way the report explains is worth more than a
draft that is empty for a reason the report calls caution.

A part whose leaves disagree still carries none of its leaves. Two pages asking
for two heading faces behind the same fallback agree about the fallback, and a
face with a fallback and no family is not a face: it is the half of a contested
part that happened to match, and anything reading the profile would take the
half for the whole. Under this rule that only happens when the majority is a
tie.

## Disagreement is a finding, not a problem to solve

A site that uses four blues across five pages is reported as using four blues.
Picking one would be making a brand decision that belongs to the owner, and it
would be made silently, on evidence the owner never sees. Counting the pages
that state one value in one place is a different act, argued above: it settles
nothing the owner has to settle, and it is reported with its counts.

The disagreements worth naming: more than one color in the same role, more
than one heading face, a stated theme color that appears on no page, a mark
that differs between pages, and a copyright line that names a different
organisation from the one the page does.
