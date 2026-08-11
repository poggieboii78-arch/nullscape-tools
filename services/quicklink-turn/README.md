# QuickLink relay and TURN credential Worker

This Worker exchanges the private Cloudflare TURN key for 30-minute browser
credentials. It also gives each QuickLink session a small Durable Object
WebSocket room so groups use one reliable connection per room instead of an
increasing peer-to-peer mesh. The permanent TURN key never enters the Nullscape
frontend, and room messages remain end-to-end encrypted with the invite secret.

## Abuse protection

- Exact browser-origin allowlist.
- Eight credential requests per visitor per minute.
- 120 credential requests per Cloudflare location per minute as a service-wide
  circuit breaker.
- Anonymous per-visitor usage tags for investigating spikes in TURN Analytics;
  raw IP addresses are not sent to TURN analytics.
- Short-lived credentials, so a copied credential stops working after 30 minutes.
- 32 simultaneous connections per random room.
- 30 relay connection attempts per visitor per minute and 300 per Cloudflare
  location per minute.
- 96 KiB maximum relay messages and 120 messages per connection per minute.

Cloudflare's Worker rate-limit counters are intentionally permissive and local
to each Cloudflare location, so they reduce abuse but are not an exact billing
cap. If TURN usage ever spikes unexpectedly, revoke the `nullscape-quicklink`
TURN key in the Cloudflare dashboard. That is the hard emergency shutoff.

## First deployment or relay migration

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
trailing slash. Deploy and copy the public `workers.dev` URL. Wrangler applies
the `QuickLinkRoom` Durable Object migration automatically on the first relay
deployment:

```bash
npm run check
npm run deploy
```

Never commit `.dev.vars`, API tokens, TURN keys, or generated credentials.
