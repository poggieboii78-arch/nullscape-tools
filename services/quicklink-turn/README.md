# QuickLink TURN credential Worker

This Worker exchanges the private Cloudflare TURN key for one-hour browser
credentials. The permanent key never enters the Nullscape frontend.

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
