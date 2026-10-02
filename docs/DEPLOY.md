# Deploying

The source lives in a **private** GitHub repository. The app is hosted on **Cloudflare Workers** as static assets (free plan, no credit card). Cloudflare builds and deploys every push to `main`.
The source is private; the website itself is public to anyone with the link.

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, unit tests and a build on every push as an independent check.

## How it works

1. Cloudflare clones the repo and runs `npm ci` then the build command, `npm run build`, which writes the app to `apps/web/dist`.
2. The deploy command, `npx wrangler deploy`, reads `wrangler.jsonc` at the repo root and uploads `apps/web/dist`.
3. Unknown paths serve the app shell (`not_found_handling: single-page-application`).

Node 22 comes from `.nvmrc`. No environment variables or secrets are needed.

## One-time setup

1. Sign up at https://dash.cloudflare.com/sign-up (free).
2. **Workers & Pages › Create › Import a repository** (Connect to Git), authorising the Cloudflare GitHub app for **only** the `aletheia` repository.
3. Settings:

   | Setting | Value |
   |---|---|
   | Project (Worker) name | `aletheia`, which must equal `name` in `wrangler.jsonc` |
   | Production branch | `main` |
   | Build command | `npm run build` |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | *(empty: repository root)* |

4. Save and deploy.

The app lives at `https://aletheia.<account-subdomain>.workers.dev/`. The account subdomain is shown in the dashboard under **Workers & Pages › Overview** (right-hand side) and on the Worker's page under **Domains**.

## Checking a deploy locally

```bash
npm run build
npx wrangler deploy --dry-run
```

## Base path

The app is served from the site root. If it is ever hosted under a sub-path, build with `BASE_PATH=/sub/path/`.
