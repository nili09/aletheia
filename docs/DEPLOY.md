# Deploying

The source lives in a **private** GitHub repository. The app is hosted on **Cloudflare Pages** (free plan, no credit card), which builds and deploys every push to `main`.
The source is private; the website itself is public to anyone with the link.

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, unit tests and a build on every push as an independent check.

## One-time setup

1. Sign up at https://dash.cloudflare.com/sign-up (free).
2. In the dashboard: **Workers & Pages › Create › Pages › Connect to Git**.
3. Authorise the Cloudflare GitHub app for **only** the `aletheia` repository, then select it.
4. Build settings:

   | Setting | Value |
   |---|---|
   | Project name | `aletheia` (becomes `aletheia.pages.dev`; if taken, Cloudflare suggests another) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `apps/web/dist` |
   | Root directory | *(leave empty: repository root)* |

   Node 22 is picked up from `.nvmrc`. No environment variables are needed.

5. **Save and Deploy.** The first build takes a minute or two.

After that, every `git push` to `main` deploys to production, and every other branch gets its own preview URL.

## Base path

The app is served from the site root. If it is ever hosted under a sub-path, build with `BASE_PATH=/sub/path/`.
