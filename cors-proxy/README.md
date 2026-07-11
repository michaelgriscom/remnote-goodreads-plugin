# Goodreads CORS relay

A minimal [Cloudflare Worker](https://developers.cloudflare.com/workers/)
that fetches Goodreads RSS feeds server-side and returns them with CORS
headers, so the RemNote Goodreads plugin can sync on web and mobile
without depending on a third-party relay service.

It only proxies `goodreads.com/review/list_rss/...` URLs, so it can't be
abused as a general-purpose open proxy, and it edge-caches responses for
10 minutes to keep request volume to Goodreads low.

The plugin's default relay URL points at the official instance of this
worker. Deploy your own if you'd rather not route your feed through it.

## Deploy your own

Requires a free Cloudflare account. From this directory:

```sh
npm install
npx wrangler login
npm run deploy
```

Wrangler prints the deployed URL, e.g.
`https://remnote-goodreads-plugin.<your-subdomain>.workers.dev`.

### Deploy from CI

Two options for deploying on push instead of by hand:

- **GitHub Actions** (`.github/workflows/deploy-cors-proxy.yml`): runs
  `wrangler deploy` on demand and on pushes to `main` that touch
  `cors-proxy/`. Add two repository secrets — `CLOUDFLARE_API_TOKEN` (a
  token with the "Edit Cloudflare Workers" permission) and
  `CLOUDFLARE_ACCOUNT_ID`.
- **Cloudflare [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)**:
  connect the repository with **root directory** `/cors-proxy`, and make
  sure the Cloudflare service name matches `name` in
  [wrangler.jsonc](wrangler.jsonc). Create the service through the
  repository-import flow rather than attaching Builds to a service that
  was already deployed manually, which can fail to initialize.

## Use with the plugin

In the plugin settings:

1. Enable **Fetch through a relay (CORS proxy)**
2. Set **Relay (CORS proxy) URL** to:

```
https://remnote-goodreads-plugin.<your-subdomain>.workers.dev/?url={url}
```

## Costs and limits

The Cloudflare free tier allows 100,000 requests/day. Even 1,000 users
syncing every 30 minutes around the clock stays under half of that, and
edge caching reduces it further. No credit card is required.

## Local development

`npm run dev` starts the worker locally via wrangler. Unit tests live in
`src/worker.test.ts` and run with the repository's main test suite
(`npm test` at the repository root).
