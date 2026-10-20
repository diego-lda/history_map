/**
 * OAuth proxy for Decap CMS → GitHub, as a Cloudflare Worker.
 *
 * Why this exists: GitHub's OAuth flow requires a client *secret* to exchange
 * the code for a token. /admin/ is a public static page, so it cannot hold one.
 * This worker is the only piece of server that this project has, and it does
 * exactly one thing — swap a code for a token and hand it back to the CMS tab.
 *
 * It never sees your repo contents; the CMS talks to the GitHub API directly
 * once it has the token.
 *
 * Secrets expected (set with `wrangler secret put`):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET
 * Plain var (set in wrangler.toml):
 *   ALLOWED_ORIGIN   e.g. https://diego-lda.github.io
 */

const AUTHORIZE = 'https://github.com/login/oauth/authorize'
const TOKEN = 'https://github.com/login/oauth/access_token'

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

/**
 * Decap listens for a postMessage handshake from this popup: it first waits for
 * `authorizing:github`, replies, and then expects the result message.
 */
function handshake(payload, origin) {
  return html(`<!doctype html><title>Signing in…</title><script>
  (function () {
    function receive(message) {
      if (message.data !== 'authorizing:github') return
      window.removeEventListener('message', receive, false)
      window.opener.postMessage(
        'authorization:github:${payload.ok ? 'success' : 'error'}:${JSON.stringify(payload.data).replace(/</g, '\\\\u003c')}',
        ${JSON.stringify(origin)}
      )
    }
    window.addEventListener('message', receive, false)
    window.opener.postMessage('authorizing:github', ${JSON.stringify(origin)})
  })()
</script>`)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = env.ALLOWED_ORIGIN

    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !origin) {
      return html('<p>Worker is missing GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET or ALLOWED_ORIGIN.</p>', 500)
    }

    // Step 1 — the CMS opens this, we bounce to GitHub.
    if (url.pathname === '/auth') {
      // CSRF: a random value echoed back by GitHub and checked on return.
      const state = crypto.randomUUID()
      const to = new URL(AUTHORIZE)
      to.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
      to.searchParams.set('redirect_uri', `${url.origin}/callback`)
      to.searchParams.set('scope', url.searchParams.get('scope') || 'repo,user')
      to.searchParams.set('state', state)

      return new Response(null, {
        status: 302,
        headers: {
          Location: to.toString(),
          'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
        },
      })
    }

    // Step 2 — GitHub sends the user back here with a code.
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const expected = (request.headers.get('Cookie') || '').match(/oauth_state=([^;]+)/)?.[1]

      if (!code) return handshake({ ok: false, data: { message: 'No code returned by GitHub' } }, origin)
      if (!state || state !== expected) {
        return handshake({ ok: false, data: { message: 'State mismatch — try signing in again' } }, origin)
      }

      const response = await fetch(TOKEN, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      })

      const data = await response.json()
      if (!response.ok || data.error || !data.access_token) {
        return handshake(
          { ok: false, data: { message: data.error_description || data.error || 'Token exchange failed' } },
          origin,
        )
      }

      return handshake({ ok: true, data: { token: data.access_token, provider: 'github' } }, origin)
    }

    return new Response('Not found', { status: 404 })
  },
}
