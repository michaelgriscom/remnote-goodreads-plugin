import {
  AppEvents,
  declareIndexPlugin,
  type ReactRNPlugin,
  PropertyType,
  SelectSourceType,
  WidgetLocation,
} from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';
import { doLog } from '../logging';
import { BOOK_POWERUP_CODE, BOOK_POWERUP_SLOTS, runSyncWithStatus } from '../sync';

const DEFAULT_SYNC_INTERVAL_MINUTES = 30;
const SYNC_INTERVAL_SETTING_ID = 'syncIntervalMinutes';

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

async function fetchGoodreads(plugin: ReactRNPlugin) {
  const result = await runSyncWithStatus(plugin);
  if (!result) {
    await plugin.app.toast('Error syncing Goodreads, check the console for additional details.');
    return;
  }
  if (result.imported > 0) {
    await plugin.app.toast(
      `Goodreads sync complete. Found ${result.imported} new book(s) (${result.existing} existing)`
    );
  }
  if (result.skipped > 0) {
    await plugin.app.toast(`Goodreads sync: ${result.skipped} feed item(s) could not be parsed.`);
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
  await plugin.app.registerPowerup({
    name: 'Goodreads Book',
    code: BOOK_POWERUP_CODE,
    description: 'A book imported from a Goodreads shelf',
    options: {
      slots: [
        {
          code: BOOK_POWERUP_SLOTS.BOOK_ID,
          name: 'Goodreads ID',
          hidden: true,
          onlyProgrammaticModifying: true,
          propertyType: PropertyType.TEXT,
        },
        {
          code: BOOK_POWERUP_SLOTS.AUTHORS,
          name: 'Author(s)',
          propertyType: PropertyType.MULTI_SELECT,
          selectSourceType: SelectSourceType.Relation,
        },
      ],
    },
  });

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

  await plugin.settings.registerBooleanSetting({
    id: 'useCorsProxy',
    title: 'Fetch through a relay (CORS proxy)',
    description:
      'Required for syncing on web and mobile, where Goodreads cannot be fetched directly. Has no effect on the desktop app. Your feed URL, including its key, is sent through the relay service configured below.',
    defaultValue: false,
  });

  await plugin.settings.registerStringSetting({
    id: 'corsProxyTemplate',
    title: 'Relay (CORS proxy) URL',
    description:
      '{url} is replaced with the encoded feed URL; without {url}, the feed URL is appended.',
    defaultValue: 'https://remnote-goodreads-plugin.js84fwxnvs.workers.dev/?url={url}',
  });

  await plugin.settings.registerNumberSetting({
    id: SYNC_INTERVAL_SETTING_ID,
    title: 'Automatic sync interval (minutes)',
    description: 'How often to automatically fetch from Goodreads (in minutes). Set to 0 to disable automatic sync.',
    defaultValue: DEFAULT_SYNC_INTERVAL_MINUTES,
  });

  await plugin.app.registerCommand({
    id: 'fetch-goodreads-shelf',
    name: 'Fetch Books from Goodreads Shelf',
    action: async () => {
      await plugin.app.toast('Syncing Goodreads books...');
      await fetchGoodreads(plugin);
    }
  });

  await plugin.app.registerWidget('goodreads_widget', WidgetLocation.RightSidebar, {
    dimensions: { height: 'auto', width: '100%' },
    widgetTabTitle: 'Goodreads',
    widgetTabIcon: `${plugin.rootURL}logo.svg`,
  });

  const syncInterval: number = await plugin.settings.getSetting(SYNC_INTERVAL_SETTING_ID);
  startPeriodicSync(plugin, syncInterval);

  plugin.event.addListener(AppEvents.SettingChanged, SYNC_INTERVAL_SETTING_ID, async () => {
    const newInterval: number = await plugin.settings.getSetting(SYNC_INTERVAL_SETTING_ID);
    startPeriodicSync(plugin, newInterval);
  });
}

async function onDeactivate(plugin: ReactRNPlugin) {
  plugin.event.removeListener(AppEvents.SettingChanged, SYNC_INTERVAL_SETTING_ID);
  stopPeriodicSync();
}

declareIndexPlugin(onActivate, onDeactivate);
