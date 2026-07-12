# Goodreads CORS relay

A minimal [Cloudflare Worker](https://developers.cloudflare.com/workers/)
that fetches Goodreads RSS feeds server-side and returns them with CORS
headers, so the RemNote Goodreads plugin can sync on web and mobile
without depending on a third-party relay service.

It only proxies `goodreads.com/review/list_rss/...` URLs; edge-caches responses for
10 minutes to reduce request volume.

## Deploy your own

Requires a free Cloudflare account. From this directory:

```sh
npm install
npx wrangler login
npm run deploy
```

Wrangler prints the deployed URL, e.g.
`https://remnote-goodreads-plugin.<your-subdomain>.workers.dev`.

Alternatively, connect the repository to
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
so pushes deploy automatically. When doing so, set the build's **root
directory** to `/cors-proxy`, and make sure the Cloudflare service name
matches `name` in [wrangler.jsonc](wrangler.jsonc).

## Use with the plugin

In the plugin settings:

1. Enable **Fetch through a relay (CORS proxy)**
2. Set **Relay (CORS proxy) URL** to:

```
https://remnote-goodreads-plugin.<your-subdomain>.workers.dev/?url={url}
```

## Local development

`npm run dev` starts the worker locally via wrangler. Unit tests live in
`src/worker.test.ts` and run with the repository's main test suite
(`npm test` at the repository root).
