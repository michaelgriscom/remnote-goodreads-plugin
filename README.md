# Goodreads

Sync a Goodreads shelf to RemNote

## Setup

### Get Goodreads RSS URL
1. Open Goodreads on a desktop web browser
1. Navigate to the shelf that you want to sync
1. Locate the RSS icon on the bottom right of the page
1. Copy the URL (in Chrome, right click -> Copy Link Address)

### Configure plugin
1. Open RemNote
1. Navigate to Settings -> Plugin Settings
1. Paste the RSS URL from the previous step into the "Goodreads RSS feed" textbox

Optional settings:
- **Simplify book titles** (on by default): omits subtitles, series, and edition info from imported titles
- **Automatic sync interval (minutes)**: how often to sync automatically (default 30; set to 0 to disable)

### Using the plugin

Books are imported under a "Goodreads Import" document, grouped under
"Currently Reading" or "Completed" sections depending on whether they
have a read date. Books move to "Completed" when they gain a read date
or drop out of the feed (e.g. if you're syncing the
currently-reading shelf). Authors live under an "Author" section which also functions as a tag on each book.

To sync manually, either:
- Open the command palette and run the "Fetch Books from Goodreads Shelf" command, or
- Open the "Goodreads" tab in the right sidebar and click "Sync Now"

The sidebar tab also shows the last sync time and the result of the most
recent sync. With an automatic sync interval configured, the shelf also
syncs periodically in the background while RemNote is open.

### Syncing on mobile and web

Browsers only let a website read data from another website if the second
site explicitly allows it (a security rule called CORS), and Goodreads
does not allow it. Syncing therefore fails in the RemNote web and mobile
apps (the desktop app is unaffected). To sync there, enable **Fetch
through a relay (CORS proxy)** in the plugin settings. This routes the
request through a public relay service that fetches the feed on your
behalf and passes it back. The relay service is configurable; the
default is [a purpose-built service for this plugin](https://remnote-goodreads-plugin.js84fwxnvs.workers.dev/) that is open source inside [the same repository](https://github.com/michaelgriscom/remnote-goodreads-plugin/tree/main/cors-proxy).

## Data Privacy

If you enable the relay option, your feed URL is
sent through the configured relay service. This service could log the bookshelf you entered and the access `key` in the URL, allowing them to see your bookshelf and abuse the key.

The default relay for the plugin is open source and does not do any of this, however you can reduce the amount of information sent to third parties. If your Goodreads profile is public, you can remove the `key` in the URL (for example, `https://www.goodreads.com/review/list_rss/12345?shelf=to-read`). You can also run your own relay; services such as Cloudflare allow this for free, and this repository includes a
ready-to-deploy Cloudflare Worker that only proxies Goodreads feeds —
see [cors-proxy/README.md](cors-proxy/README.md).
