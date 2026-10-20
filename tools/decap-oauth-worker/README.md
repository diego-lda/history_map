# CMS login proxy

Decap CMS signs you in with your own GitHub account. GitHub's OAuth flow needs
a client **secret**, and `/admin/` is a public static page, so the exchange has
to happen somewhere else. This worker is that somewhere — the only server this
project has, and it does nothing but swap a code for a token.

Free tier is far more than enough: it runs once per sign-in.

## Setup, once

**1. Create a GitHub OAuth app**

github.com → Settings → Developer settings → **OAuth Apps** → New OAuth App

| Field | Value |
|---|---|
| Application name | `History Map CMS` |
| Homepage URL | `https://diego-lda.github.io/history_map/` |
| Authorization callback URL | `https://history-map-cms-auth.<your-subdomain>.workers.dev/callback` |

You won't know the worker URL until step 2 — put a placeholder, deploy, then
come back and correct it. The callback must match exactly.

Keep the **Client ID**, and generate a **Client secret**.

**2. Deploy the worker**

```bash
cd tools/decap-oauth-worker
npx wrangler login
npx wrangler deploy
```

Wrangler prints the URL. Then set the two secrets — they are prompted for, so
they never land in your shell history or in git:

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

**3. Point the CMS at it**

In `public/admin/config.yml`, replace the placeholder:

```yaml
backend:
  base_url: https://history-map-cms-auth.<your-subdomain>.workers.dev
```

Commit and push. `https://diego-lda.github.io/history_map/admin/` will then let
you sign in.

## Who can edit

Anyone who can push to `diego-lda/history_map`. The `/admin/` page being public
is fine — it is a login screen, and every write goes through the GitHub API as
*you*, with your permissions. There is no separate password to leak.

`ALLOWED_ORIGIN` in `wrangler.toml` restricts which site the token can be handed
to; update it if you move to a custom domain.
