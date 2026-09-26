# The systems this agent needs

Named by what the work needs rather than by product. The access level
is the most this work needs; a deployment that grants more is granting
more than the job requires.

| System | Kind | Access | What the access is for |
|---|---|---|---|
| source-host | service | read | to fetch the pages, the web app manifest and the stylesheets at the domain the person named, over https, and to open those pages in the browser |
| text-reasoning | service | trigger | to choose which of the colors the pages declare is the primary and which is the accent, which is the one judgment in this job that no written rule reaches; credential `text-reasoning-key`, spends per calls, the caller's material is sent to it |

Whoever deploys this agent binds these systems to their own,
and places any named credential. Nothing here names a product.
