# QuickLink TURN credential Worker

This Worker exchanges the private Cloudflare TURN key for 30-minute browser
credentials. The permanent key never enters the Nullscape frontend.

## Abuse protection

- Exact browser-origin allowlist.
- Eight credential requests per visitor per minute.
- 120 credential requests per Cloudflare location per minute as a service-wide
  circuit breaker.
- Anonymous per-visitor usage tags for investigating spikes in TURN Analytics;
  raw IP addresses are not sent to TURN analytics.
- Short-lived credentials, so a copied credential stops working after 30 minutes.

Cloudflare's Worker rate-limit counters are intentionally permissive and local
to each Cloudflare location, so they reduce abuse but are not an exact billing
cap. If TURN usage ever spikes unexpectedly, revoke the `nullscape-quicklink`
TURN key in the Cloudflare dashboard. That is the hard emergency shutoff.

## First deployment

From this directory, install dependencies and generate the binding types:

```bash
npm install
npm run types
```

Add all three values through Wrangler's private prompts:

```bash
npx wrangler secret put TURN_KEY_ID
npx wrangler secret put TURN_KEY_SECRET
npx wrangler secret put ALLOWED_ORIGINS
```

`ALLOWED_ORIGINS` is a comma-separated list of exact site origins, without a
trailing slash. Deploy and copy the public `workers.dev` URL:

```bash
npm run check
npm run deploy
```

Never commit `.dev.vars`, API tokens, TURN keys, or generated credentials.
