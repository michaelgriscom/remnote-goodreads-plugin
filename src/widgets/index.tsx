import { declareIndexPlugin, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import '../App.css';

function doLog(msg: string) {
  console.log(`[Goodreads] ${msg}`);
}

function doError(msg: string) {
  console.error(`[Goodreads] ${msg}`);
}

// TODO: add a setting for this (default to true)
function cleanupBookTitle(title: string): string {
  // Remove text after colon (typically subtitle)
  let cleanTitle = title.split(':')[0];
  
  // Remove series information in parentheses
  cleanTitle = cleanTitle.replace(/\s*\([^)]*\)\s*$/, '');
  
  // Remove edition information like "1st Edition", "Revised Edition", etc.
  cleanTitle = cleanTitle.replace(/\s*(\d+(?:st|nd|rd|th)\s+Edition|Revised Edition|Special Edition)\s*$/i, '');
  
  // Remove trailing spaces
  cleanTitle = cleanTitle.trim();
  
  return cleanTitle;
}

// TODO: boolean setting to allow periodic fetch (default to true)
async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerStringSetting({
    id: 'feedUrl',
    title: 'Goodreads RSS feed',
  });

  await plugin.settings.registerStringSetting({
    id: 'prefix',
    title: 'Rem Prefix',
    description: '(optional) Prefix for created rems'
  });

  // TODO: use this to tag new rems
  await plugin.settings.registerStringSetting({
    id: 'tags',
    title: 'Tags',
    description: '(optional) Tags to apply to created rems. Enter one per line.',
    multiline: true
  });

  // Register a command to fetch books from Goodreads
  await plugin.app.registerCommand({
    id: 'fetch-goodreads-shelf',
    name: 'Fetch Books from Goodreads Shelf',
    action: async () => {
      let remsCreated = 0;
      try {
        const feedUrl: string = await plugin.settings.getSetting('feedUrl');
        doLog(`Creating proxy for ${feedUrl}`);
        
        // Use a CORS proxy to work around Goodreads not permitting it
        const corsProxy = 'https://api.allorigins.win/raw?url=';
        const proxyUrl = corsProxy + encodeURIComponent(feedUrl);
        
        // Fetch and parse the RSS feed
        doLog(`Fetching from ${proxyUrl}`);
        const response = await fetch(proxyUrl);
        const text = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        
        // Get all book items from the feed
        const items = xmlDoc.getElementsByTagName('item');
        doLog(`Found ${items.length} book(s) in feed`);

        
        // Process each book
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          
          // Extract book information
          let title = item.getElementsByTagName('title')[0].textContent;
          if(!title) {
            doError(`Failed to parse title for item: ${item}`);
            continue;
          }

          title = cleanupBookTitle(title);
          const prefix: string = await plugin.settings.getSetting('prefix');
          if(prefix) {
            title = prefix + title;
          }
          const link = item.getElementsByTagName('link')[0].textContent;
          const description = item.getElementsByTagName('description')[0].textContent ?? '';
          
          // Parse description to extract additional details
          const parser = new DOMParser();
          const descDoc = parser.parseFromString(description, 'text/html');
          
          // Extract author and image URL from description
          // const authorMatch = description.match(/by (.*?)<br/);
          // const author = authorMatch ? authorMatch[1].trim() : 'Unknown Author';
          // const imgElement = descDoc.querySelector('img');
          // const coverUrl = imgElement ? imgElement.src : '';
          
          // Check if a Rem with this title already exists
          const existingRem = await plugin.rem.findByName([title], null);
          if(existingRem) {
            doLog(`Rem for "${title}" exists (${existingRem._id}), skipping`);
            continue;
          } else {
            doLog(`No rem for "${title}" found, creating`);
          }

          // Create new Rem for the book
          const bookRem = await plugin.rem.createRem();
          if(bookRem) {
            doLog(`Rem created for "${title}" (${bookRem._id})`);
          }
          if(!bookRem) {
            doError(`Failed to create Rem "${title}"`);
            continue;
          }
          await bookRem.setText([title]);
          await bookRem.setIsDocument(true);

          doLog(`Rem populated for "${title}" (${bookRem._id})`);
          remsCreated++;
        }
        
        await plugin.app.toast(`Goodreads sync complete. Found ${remsCreated} new book(s) (${items.length - remsCreated} existing)`);
      } catch (error) {
        doError(`Error fetching Goodreads shelf: ${error}`);
        await plugin.app.toast('Error syncing Goodreads, check the console for additional details.');
      }
    }
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
