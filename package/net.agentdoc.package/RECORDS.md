# The records this agent must leave

This is the contract. The agent leaves the following behind, on
every run.

- the domain as given, and when it was asked for — at `*/asked.json`
- every page, stylesheet and manifest as fetched, with its address, the moment it was fetched and its digest — at `*/fetched/*`
- the statements found, each with the address and the place it was said — at `*/statements.json`
- the observations, with the counts behind each one — at `*/observations.json`
- the picture of the home page the roles were chosen from, as the browser rendered it — at `*/home-page.png`
- the roles as chosen: every color that was offered, which of them was named the primary and which the accent, how many calls it took, and the reason where neither was chosen — at `*/roles.json`
- the draft profile as delivered — at `*/brand-profile.json`
- the signed job manifest of each delivery, listing each piece by the step that made it. The adapter signs it from pieces.json and keeps it beside the reply.

An agent that leaves less than this does not do this job,
whatever else it does well.
