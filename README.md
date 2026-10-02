# AOIC Files

Working files for the Tyler Technologies and Illinois AOIC statewide court analytics program, plus the source for the AOIC Analytics Onboarding site.

## The Onboarding Site

The site lives in `site/index.html`. It is a single static page with no build step. `netlify.toml` tells Netlify to publish the `site` folder and to send headers that keep search engines from indexing it.

**To publish an update,** edit `site/index.html`, open it in a browser to check it, and merge to `main`. Netlify publishes the change once the `aoic-onboarding` project is linked to this repository. That link is a one-time setup in the Netlify dashboard under Project configuration, then Build and deploy, then Link repository. Until then, drag the `site` folder onto the project's Deploys page.

**Keep it current.** The page states the date it was last refreshed in three places: the docket strip, the masthead, and the footer. Update all three whenever the content changes.

**Keep it internal.** The page is meant for Tyler staff. The Netlify project currently has no password, so turn on visitor access protection before you share the link widely.

## The Program Archive

`AOIC-Files.zip` holds about 1.3 GB of historical program documents, stored with Git LFS. Run `git lfs pull` to download it. Several files inside contain vendor credentials, so never extract the archive anywhere public.
