# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A RemNote plugin that syncs books from a Goodreads RSS feed into RemNote as Rem documents. Built with TypeScript, React, and the RemNote Plugin SDK (https://plugins.remnote.com/). This project follows Conventional Commits standards.

## Development Commands

- `npm run dev` - Start development server with hot reload on port 8080
- `npm run build` - Full production build (validates plugin, builds, and creates PluginZip.zip)
- `npm run check-types` - Run TypeScript type checking
- `npm test` - Run the vitest suite

## Architecture

### Data Flow

The sync process follows this pipeline:

1. **fetchRss** ([src/fetchRss.ts](src/fetchRss.ts)) - Validates the feed URL and fetches XML from the Goodreads RSS feed via proxy
2. **parseBooks** ([src/parseRss.ts](src/parseRss.ts)) - Parses XML into `GoodreadsBook` objects; malformed feed items are skipped and counted rather than failing the sync
3. **cleanupBookTitle** ([src/cleanupBookTitle.ts](src/cleanupBookTitle.ts)) - Optionally simplifies titles (removes subtitles, series info, editions)
4. **upsertBookRem** ([src/sync.ts](src/sync.ts)) - Creates or updates Rem documents in RemNote

`performSync` in [src/sync.ts](src/sync.ts) orchestrates the pipeline. `runSyncWithStatus` wraps it with the session-storage status bookkeeping (`STORAGE_KEYS`) that the sidebar widget renders from; the command palette entry, the periodic sync timer, and the widget's Sync Now button all go through it.

### Entry Point

[src/widgets/index.tsx](src/widgets/index.tsx) is the main plugin file that:
- Registers the `Goodreads Book` powerup
- Registers plugin settings (`feedUrl`, `cleanupTitles`, `syncIntervalMinutes`)
- Registers the "Fetch Books from Goodreads Shelf" command
- Registers the right-sidebar widget ([src/widgets/goodreads_widget.tsx](src/widgets/goodreads_widget.tsx))
- Starts the periodic sync timer and restarts it when the interval setting changes (via `AppEvents.SettingChanged`)

### Proxy Configuration

In development mode, webpack proxies `/goodreads/*` requests to `https://www.goodreads.com` to work around CORS restrictions. See [webpack.config.js](webpack.config.js). `fetchRss` always fetches the relative `/goodreads/...` path, so syncing only works where that path is proxied (the webpack dev server).

### Data Model

Imported data lives under a "Goodreads Import" document containing "Books" and "Authors" container Rems.

Each book Rem is created under "Books" and tagged with the `goodreadsBook` powerup (registered in [src/widgets/index.tsx](src/widgets/index.tsx)), which has these property slots:
- `bookId` - hidden, programmatic-only; stores the Goodreads book id
- `authors` - multi-select relation; holds Rem references to author Rems
- `dateRead` / `dateAdded` - date properties holding references to daily documents, so books appear as backlinks on those dates

Author Rems are created under "Authors", tagged with the `goodreadsAuthor` powerup, and deduplicated by name, so multiple books by the same author share a single author Rem. Powerups are used (rather than plain tag Rems) so there are no bare tag rems in the user's document tree to accidentally delete.

The manifest requests the `All` scope because powerup Rems and daily documents live outside the "Goodreads Import" subtree.

### Deduplication / Upsert

Sync is an upsert: previously imported books are found via the `bookId` powerup slot (see `buildBookIndex` in [src/sync.ts](src/sync.ts)) and their properties are updated in place. Title matching under the "Books" container is only a fallback for Rems without a stored id.

### Unused Data

The RSS parser extracts more metadata (cover URL, ratings, shelves, publication year) than is currently written to Rems (title, author, dates). This data is available for future enhancements.

## RemNote Plugin SDK

This plugin uses `@remnote/plugin-sdk` (0.0.46) to interact with RemNote:
- `plugin.app.registerPowerup()` - Registers the book powerup with typed property slots
- `rem.addPowerup()` / `rem.setPowerupProperty()` / `rem.getPowerupProperty()` - Powerup tagging and properties
- `plugin.powerup.getPowerupByCode()` + `powerup.taggedRem()` - Enumerate previously imported books
- `plugin.rem.createRem()` / `plugin.rem.findByName()` - Create and find Rems
- `rem.addTag()` - Tags a Rem with another Rem
- `plugin.richText.rem().value()` - Builds rich text containing Rem references
- `plugin.settings.registerStringSetting()` / `registerBooleanSetting()` / `registerNumberSetting()` - User-configurable settings
- `plugin.event.addListener(AppEvents.SettingChanged, ...)` - React to setting changes
- `plugin.app.registerCommand()` / `plugin.app.registerWidget()` / `plugin.app.toast()`

## Key Files

- [src/widgets/index.tsx](src/widgets/index.tsx) - Plugin entry point: registrations and periodic sync
- [src/sync.ts](src/sync.ts) - Sync engine: fetch, parse, upsert Rems, powerup properties
- [src/widgets/goodreads_widget.tsx](src/widgets/goodreads_widget.tsx) - Right-sidebar widget (manual sync + status)
- [src/parseRss.ts](src/parseRss.ts) - RSS XML parsing and `GoodreadsBook` interface
- [src/fetchRss.ts](src/fetchRss.ts) - URL validation and HTTP fetch with proxy URL handling
- [src/cleanupBookTitle.ts](src/cleanupBookTitle.ts) - Title simplification logic
- [public/manifest.json](public/manifest.json) - Plugin metadata and permissions
