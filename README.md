# AOIC Files

Working files for the Tyler Technologies and Illinois AOIC statewide court analytics program, plus the source for the AOIC Analytics site.

## The Site

The site lives in `site/index.html`, a single static page with no build step. It has two sections, switched from the left rail.

- **Command Center** is the live project dashboard: action items, decisions, workstream health, and status updates. Edits are shared with everyone who opens the site.
- **Onboarding** is the ten-step guided walkthrough for new team members.

Every action, decision, and workstream links to its context in the onboarding guide, and every workstream drawer links back to its open actions.

### How Sharing Works

The Command Center saves to `/api/board`, a Netlify Function in `netlify/functions/board.mts` backed by Netlify Blobs. Each record is stored under its own key, so two people editing different items never overwrite each other. The page polls every 30 seconds while it is open.

The starting picture is `DASH_SEED` near the middle of `site/index.html`. Anything edited on the live site overrides the seed by id, so update the seed only for bulk refreshes. When the page cannot reach the API, for example when opened from a local file, it says "This device only" and saves edits in that browser.

### Publishing

Merge to `main`. Netlify builds the `aoic-onboarding` project from this repository, publishes the `site` folder, and deploys the function. The project must be linked to this repository in the Netlify dashboard under Project configuration, then Build and deploy, then Link repository. A drag-and-drop deploy publishes the page but not the function, so the dashboard falls back to "This device only".

**Keep it internal.** Visitor password protection is on for `aoic-onboarding`, and it also gates the API. `netlify.toml` sends headers that keep search engines from indexing the site.

**Keep it current.** Update `AS_OF` and `DASH_AS_OF` in the page, the date in the rail, and the footer whenever you refresh the content.

## The Program Archive

`AOIC-Files.zip` holds about 1.3 GB of historical program documents, stored with Git LFS. Run `git lfs pull` to download it. Never extract the archive anywhere public.
