# Goodreads

Sync a Goodreads shelf to RemNote

## Usage

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

### Use the plugin

Books are imported under a "Goodreads Import" document, grouped under
"Currently Reading" or "Completed" sections depending on whether they
have a read date. Books move to "Completed" when they gain a read date
or drop out of the feed (e.g. finishing a book removes it from a
currently-reading shelf). Authors live under an "Author" section and
are tagged with it. Each book is tagged with the "Goodreads Book"
powerup, which provides an Author(s) property.

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
default is [AllOrigins](https://allorigins.win).

## Data Privacy

Whenever a sync is performed, a request is made to the RSS feed that you enter. Please be sure the URL you enter into the text box is correct.

If you enable the relay option, your feed URL is sent through the
configured relay service. The private `key` in the URL is stripped before
the request, so the relay only sees your public shelf address, not a
credential it could reuse. (Feeds from private Goodreads profiles, which
need the key, won't sync this way.) You can also point the setting at a
relay you run yourself.
