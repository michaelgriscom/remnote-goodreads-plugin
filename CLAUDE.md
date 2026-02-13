# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A RemNote plugin that syncs books from a Goodreads RSS feed into RemNote as Rem documents. Built with TypeScript, React, and the RemNote Plugin SDK (https://plugins.remnote.com/). This project follows Conventional Commits standards.

## Development Commands

- `npm run dev` - Start development server with hot reload on port 8080
- `npm run build` - Full production build (validates plugin, builds, and creates PluginZip.zip)
- `npm run check-types` - Run TypeScript type checking

## Architecture

### Data Flow

The sync process follows this pipeline:

1. **fetchRss** ([src/fetchRss.ts](src/fetchRss.ts)) - Fetches XML from Goodreads RSS feed via proxy
2. **parseBooks** ([src/parseRss.ts](src/parseRss.ts)) - Parses XML into `GoodreadsBook` objects
3. **cleanupBookTitle** ([src/cleanupBookTitle.ts](src/cleanupBookTitle.ts)) - Optionally simplifies titles (removes subtitles, series info, editions)
4. **createRemForBook** ([src/widgets/index.tsx](src/widgets/index.tsx)) - Creates Rem documents in RemNote

### Entry Point

[src/widgets/index.tsx](src/widgets/index.tsx) is the main plugin file that:
- Registers plugin settings (`feedUrl`, `cleanupTitles`)
- Registers the "Fetch Books from Goodreads Shelf" command
- Orchestrates the sync workflow in `fetchGoodreads()`

### Proxy Configuration

In development mode, webpack proxies `/goodreads/*` requests to `https://www.goodreads.com` to work around CORS restrictions. See [webpack.config.js](webpack.config.js) lines 118-128.

The production plugin must be loaded in RemNote's environment which handles CORS differently.

### Deduplication

Before creating a Rem, the plugin checks if one with the same title already exists using `plugin.rem.findByName()`. This prevents duplicate entries on repeated syncs.

### Tags and Author Linking

The plugin creates "Book" and "Author" tag Rems under "Goodreads Import". A custom powerup (`bookPowerup`) defines an "Author(s)" slot on the Book tag. When a book is imported:
- The book Rem is tagged with "Book" and given the `bookPowerup` powerup
- An author Rem is created (if not already existing) and tagged with "Author"
- The book's "Author(s)" property is set to a Rem reference pointing to the author

Author Rems are deduplicated by name, so multiple books by the same author share a single author Rem.

### Unused Data

The RSS parser extracts comprehensive book metadata (cover URL, ratings, read dates, shelves, etc.) beyond what is currently used (title, author). This data is available for future enhancements.

## RemNote Plugin SDK

This plugin uses `@remnote/plugin-sdk` to interact with RemNote:
- `plugin.rem.createRem()` - Creates new Rem documents
- `plugin.rem.findByName()` - Searches for existing Rems
- `rem.addTag()` - Tags a Rem with another Rem
- `rem.addPowerup()` / `rem.setPowerupProperty()` - Adds powerup slots and sets their values
- `plugin.richText.rem().value()` - Builds rich text containing Rem references
- `plugin.app.registerPowerup()` - Registers a custom powerup with named slots
- `plugin.settings.registerStringSetting()` / `registerBooleanSetting()` - Adds user-configurable settings
- `plugin.app.registerCommand()` - Registers commands in RemNote's command palette
- `plugin.app.toast()` - Shows user notifications

## Key Files

- [src/widgets/index.tsx](src/widgets/index.tsx) - Main plugin logic and RemNote SDK integration
- [src/parseRss.ts](src/parseRss.ts) - RSS XML parsing and `GoodreadsBook` interface
- [src/fetchRss.ts](src/fetchRss.ts) - HTTP fetch with proxy URL handling
- [src/cleanupBookTitle.ts](src/cleanupBookTitle.ts) - Title simplification logic
- [public/manifest.json](public/manifest.json) - Plugin metadata and permissions
