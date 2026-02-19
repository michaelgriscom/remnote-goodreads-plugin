import {
  declareIndexPlugin,
  type ReactRNPlugin,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';
import { doError, doLog } from '../logging';
import { performSync } from '../sync';

const DEFAULT_SYNC_INTERVAL_MINUTES = 30;

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

async function fetchGoodreads(plugin: ReactRNPlugin) {
  try {
    const result = await performSync(plugin);
    await plugin.app.toast(
      `Goodreads sync complete. Found ${result.imported} new book(s) (${result.existing} existing)`
    );
  } catch (error) {
    doError(`Error fetching Goodreads shelf: ${error}`);
    await plugin.app.toast('Error syncing Goodreads, check the console for additional details.');
  }
}

function startPeriodicSync(plugin: ReactRNPlugin, intervalMinutes: number) {
  stopPeriodicSync();

  if (intervalMinutes <= 0) {
    doLog('Automatic sync disabled (interval set to 0)');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  doLog(`Starting automatic sync every ${intervalMinutes} minute(s)`);
  syncIntervalId = setInterval(() => {
    doLog('Running automatic sync');
    fetchGoodreads(plugin);
  }, intervalMs);
}

function stopPeriodicSync() {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    doLog('Automatic sync stopped');
  }
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerStringSetting({
    id: 'feedUrl',
    title: 'Goodreads RSS feed',
  });

  await plugin.settings.registerBooleanSetting({
    id: 'cleanupTitles',
    title: 'Simplify book titles',
    description: 'Omit information like subtitles, editions, etc. from book titles',
    defaultValue: true,
  });

  await plugin.settings.registerNumberSetting({
    id: 'syncIntervalMinutes',
    title: 'Automatic sync interval (minutes)',
    description: 'How often to automatically fetch from Goodreads (in minutes). Set to 0 to disable automatic sync. Changes take effect after plugin reload.',
    defaultValue: DEFAULT_SYNC_INTERVAL_MINUTES,
  });

  await plugin.app.registerCommand({
    id: 'fetch-goodreads-shelf',
    name: 'Fetch Books from Goodreads Shelf',
    action: async () => {
      await fetchGoodreads(plugin);
    }
  });

  await plugin.app.registerWidget('goodreads_widget', WidgetLocation.RightSidebar, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabTitle: 'Goodreads',
    widgetTabIcon: `${plugin.rootURL}logo.svg`,
  });

  const syncInterval: number = await plugin.settings.getSetting('syncIntervalMinutes');
  startPeriodicSync(plugin, syncInterval);
}

async function onDeactivate(_: ReactRNPlugin) {
  stopPeriodicSync();
}

declareIndexPlugin(onActivate, onDeactivate);
