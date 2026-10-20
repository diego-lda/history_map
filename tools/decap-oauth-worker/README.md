# CMS login proxy

Decap CMS signs you in with your own GitHub account. GitHub's OAuth flow needs
a client **secret**, and `/admin/` is a public static page, so the exchange has
to happen somewhere else. This worker is that somewhere — the only server this
project has, and it does nothing but swap a code for a token.

Free tier is far more than enough: it runs once per sign-in.

## Setup, once

Deploy the worker **first**. Its URL is the OAuth app's callback, and GitHub
rejects a placeholder — the callback field must be a real, valid URL.

**1. Deploy the worker**

```bash
cd tools/decap-oauth-worker
npx wrangler login
npx wrangler deploy
```

Wrangler prints the deployed URL, something like
`https://history-map-cms-auth.yourname.workers.dev`. Keep it.

It will not work yet — without the secrets it serves a "missing config" page.
That is expected at this stage.

**2. Create a GitHub OAuth app**

github.com → Settings → Developer settings → **OAuth Apps** → New OAuth App

| Field | Value |
|---|---|
| Application name | `History Map CMS` |
| Homepage URL | `https://diego-lda.github.io/history_map/` |
| Authorization callback URL | the worker URL from step 1, **plus `/callback`** |

So the callback is e.g.
`https://history-map-cms-auth.yourname.workers.dev/callback`. It must match
exactly — no trailing slash, and https.

Keep the **Client ID**, then generate a **Client secret**.

**3. Give the worker its secrets**

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

Both are prompted for, so they never reach your shell history or git.

**4. Point the CMS at the worker**

In `public/admin/config.yml`, replace the placeholder:

```yaml
backend:
  base_url: https://history-map-cms-auth.yourname.workers.dev
```

Commit and push. `https://diego-lda.github.io/history_map/admin/` will then let
you sign in.

## Who can edit

Anyone who can push to `diego-lda/history_map`. The `/admin/` page being public
is fine — it is a login screen, and every write goes through the GitHub API as
*you*, with your permissions. There is no separate password to leak.

`ALLOWED_ORIGIN` in `wrangler.toml` restricts which site the token can be handed
to; update it if you move to a custom domain.
