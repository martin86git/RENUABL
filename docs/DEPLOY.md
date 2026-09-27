# Deploying RENUABL to Vercel

RENUABL is hosted on [Vercel](https://vercel.com). Once connected, Vercel deploys automatically:

- **Every push** to any branch gets its own preview link.
- **The production branch** (the repo's default branch) is served at the main project URL.

The repo already contains what Vercel needs:

| File                       | Purpose                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `vercel.json`              | Runs server code in Sydney (`syd1`) — Vercel's only Australian region and ~10 ms from Melbourne, so it serves the Victorian launch market well. |
| `.github/workflows/ci.yml` | Runs typecheck, lint, tests, format check and build on every push, so broken changes are caught before deploy.                                  |
| `.env.example`             | Lists the environment variables the app reads.                                                                                                  |
| `src/lib/config.ts`        | Preview mode: shows a "sample data" banner and blocks search engines until launch.                                                              |

## One-time setup (about 5 minutes)

1. Go to <https://vercel.com/signup> and choose **Continue with GitHub**. Sign in with the GitHub account that owns `RENUABL`.
2. Choose a plan. **Hobby** (free) is fine for trying it out. Vercel's Hobby plan is for non-commercial use, so switch to **Pro** before real customers use it.
3. On the dashboard, click **Add New… → Project**.
4. Under **Import Git Repository**, find `RENUABL`. If it isn't listed, click **Adjust GitHub App Permissions** and give Vercel access to that repository.
5. Click **Import**. Vercel detects Next.js automatically — leave the build settings as they are.
6. Click **Deploy**. The first build takes 1–2 minutes.
7. When it finishes, you get a link like `renuabl.vercel.app`. Open it on your phone.

That's it. From then on, each push updates the site on its own.

## Useful links once deployed

- Customer experience: `/`
- My RENUABL (post-install): `/my`
- Installer portal: `/installer` (on a phone this is the field app)

## Settings to know about

**Environment variables** — Vercel → your project → **Settings → Environment Variables**.

| Variable                           | Default           | When to change                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_PREVIEW_MODE`         | on (when unset)   | Set to `false` only at launch, once real pricing, payments and legal terms are live. Redeploy after changing.                                                                                                                                                                                                                  |
| `NEXT_PUBLIC_HUBSPOT_MEETINGS_URL` | unset             | Your HubSpot Meetings link for the 15-minute confirmation call (HubSpot → Library → Meetings → copy link, e.g. `https://meetings.hubspot.com/your-team/confirmation-call`). Customers then book the call themselves on the confirmation screen. Until it's set, that screen says "We'll be in touch". Redeploy after changing. |
| `ANTHROPIC_API_KEY`                | unset             | Claude API key used to read customers' electricity bills on the "About your home" step (console.anthropic.com → API keys). Server-side only: never prefix it with `NEXT_PUBLIC_`. Without it, preview deployments use a sample bill and production shows "We can't read bills right now".                                      |
| `ANTHROPIC_MODEL`                  | `claude-opus-5-5` | Optional. The Claude model that reads bills.                                                                                                                                                                                                                                                                                   |

**Protecting previews** — to keep the site private while you test, go to **Settings → Deployment Protection** and turn on **Vercel Authentication**. Only people you invite to the Vercel team can then open it.

**Custom domain** — **Settings → Domains → Add**, enter e.g. `renuabl.com.au`, and follow the DNS instructions shown for your domain registrar.

## Production branch

Vercel serves the repository's default branch as production. The recommended setup is:

1. Create a `main` branch from the current work and make it the default branch on GitHub (**Settings → General → Default branch**).
2. In Vercel, confirm **Settings → Git → Production Branch** is `main`.
3. Do new work on feature branches; each gets a preview link, and merging to `main` updates the live site.
