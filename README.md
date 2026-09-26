# brand-reader

Reads a brand from a domain into a draft brand profile: only what the site states about itself goes in the profile, what it was merely observed doing is reported beside it, and every value says where it was seen. The two values no site declares, which of its colors is the primary and which is the accent, are chosen by a model that is shown a picture of the home page and may only answer with a color the pages declare, and the profile says so on the value.

This is one of the agents AgentMesh provides. It runs on AgentMesh as
`brand-reader.platform@agentmesh.ai`, and this repository is the package that runs there.

## What it does

- **Read a brand.** Turns a domain into a draft brand profile the owner can correct and adopt, with the evidence for every value.

It refuses:

- Putting anything in the profile the site did not state about itself, with one named exception. A color sampled out of an image, a face guessed from how a heading looks, a primary color chosen because it appears most often, and a favicon used as the mark are all guesses, and a guessed brand is worse than a silent one because it is handed to other agents as though the owner had said it. The exception is which of the colors the site DECLARES is its primary and which is its accent, which a model chooses from that list and never supplies itself; the value was still read off an element exactly, the evidence says a model placed it, and none is an answer the choosing makes easy to give.
- Reading a value off a picture. The step that chooses the roles is shown a screenshot of the home page to judge which of the declared colors carries it, and it may answer only with one of those colors or with none. A hex read off a picture has been through antialiasing, an overlay and a gradient, and naming a face from the shape of its letters is not possible at all, so every exact value in the profile is read off the DOM. Vision is for salience only.
- Making a brand decision for the owner. Which of four blues is the primary one is an assignment nobody publishes, and choosing one is not this agent's to do. Where the pages differ about the SAME PLACE, the draft carries the value more of them state and the report names the minority, the counts and which pages stated which, because a count of the owner's own statements is evidence and not a preference; where no value is stated by more pages than another it carries neither.
- Following a link off the domain it was given, fetching anything that is not https, or fetching an address carrying a credential.
- Signing the profile, calling it finished, or publishing it anywhere. What comes out is a draft, and it becomes a profile when the owner corrects it and adopts it.

## What running it needs

- Runtime: node >=22.
- Programs on the machine: chromium.
- Google Gemini API (`generativelanguage.googleapis.com`), a paid service: you bring your own account. Its key is read from `GOOGLE_GENERATIVE_AI_API_KEY`.

## Running your own copy

Take this repository, build the package under `package/`, and deploy it under
your own organisation, where it is bound to your own keys and given an
identity of its own. Your copy is then your own agent, not AgentMesh's.
Changes to this repository come as pull requests and are released through
AgentMesh's own build and review steps.

## License

Apache License 2.0. The full text is in LICENSE.
