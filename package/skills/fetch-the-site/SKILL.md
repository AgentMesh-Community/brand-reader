---
name: fetch-the-site
description: when a domain has arrived and nothing has been fetched from it yet
---

# Fetch the site

Part of brand-reader. when a domain has arrived and nothing has been fetched from it yet

## When to use this

when a domain has arrived and nothing has been fetched from it yet

## What this needs

- domain (url, required)
- how many pages (identifier, optional)

## What a good result looks like

The home page, the pages it links to ON THE SAME HOST, five in total counting the home page, the web app manifest, and every stylesheet those pages name, each kept with the address it came from and the moment it was fetched.

## What it produces

- fetched (application/json, per task)

## When it comes back empty

If the domain will not answer, or answers with something that is not a web page, say what happened and stop. Never read a brand from an error page.

## How to do it

Fetch over https and nothing else. Follow links only to THE SAME HOST, never off it, and never to an address carrying credentials. Another host under the same domain is another site: its ground, its ink and its mark are its own, and reading it as more pages of this one puts two brands in one profile, which then carries neither. A link to another host is named in the record and not followed, because a person is owed the fact rather than a silence. The host is the one the home page settled on, so a domain that sends you to its www is read and not refused, and www is not another host. A stylesheet is the one thing read from another host under the same domain, because a stylesheet on somebody's asset host is how the page that named it is painted. Every request has its own timeout and there is a deadline over all of them together, so a site that answers one byte a second costs this job its deadline and not the whole task. Each page, the web app manifest and each stylesheet is kept with its address and a digest, so a later step can say exactly where a value was seen.

Five pages IN TOTAL, counting the home page, and that is the default. A site that disagrees with itself does so on its first five pages, and a sixth costs a fetch to learn nothing.

## References

- references/what-counts.md
