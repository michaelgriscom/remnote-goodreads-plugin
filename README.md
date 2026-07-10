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

## Data Privacy

Whenever a sync is performed, a request is made to the RSS feed that you enter. Please be sure the URL you enter into the text box is correct.
