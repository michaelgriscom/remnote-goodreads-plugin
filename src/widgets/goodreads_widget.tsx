import {
  usePlugin,
  renderWidget,
  useTrackerPlugin,
  useSyncedStorageState,
  useSessionStorageState,
} from '@remnote/plugin-sdk';
import '../style.css';
import '../index.css';
import { STORAGE_KEYS, performSync } from '../sync';

function formatLastSync(isoString: string | null): string {
  if (!isoString) return 'Never';
  return new Date(isoString).toLocaleString();
}

const GoodreadsWidget = () => {
  const plugin = usePlugin();

  const feedUrl = useTrackerPlugin(
    async (reactivePlugin) => reactivePlugin.settings.getSetting<string>('feedUrl'),
    []
  );
  const hasFeedUrl = !!feedUrl && feedUrl.trim().length > 0;

  const [lastSyncTime] = useSyncedStorageState<string | null>(STORAGE_KEYS.LAST_SYNC_TIME, null);
  const [syncStatus, setSyncStatus] = useSessionStorageState<string>(
    STORAGE_KEYS.SYNC_STATUS,
    'idle'
  );
  const [syncResult, setSyncResult] = useSessionStorageState<string>(
    STORAGE_KEYS.SYNC_RESULT,
    ''
  );

  const handleManualSync = async () => {
    setSyncStatus('syncing');
    setSyncResult('');
    try {
      const result = await performSync(plugin);
      setSyncResult(
        `Imported ${result.imported} new book(s) (${result.existing} already existed).`
      );
      setSyncStatus('idle');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSyncResult(`Sync failed: ${message}`);
      setSyncStatus('error');
    }
  };

  return (
    <div className="p-3 m-2 rounded-lg rn-clr-background-light-positive">
      <h1 className="text-lg font-bold mb-3">Goodreads Sync</h1>

      <div className="mb-3">
        <div className="text-sm mb-1">
          <span className="font-medium">Feed URL: </span>
          {hasFeedUrl ? (
            <span className="rn-clr-content-positive">Configured</span>
          ) : (
            <span className="rn-clr-content-negative">
              Not set. Configure in plugin settings.
            </span>
          )}
        </div>
      </div>

      <div className="text-sm mb-3">
        <span className="font-medium">Last sync: </span>
        {formatLastSync(lastSyncTime)}
      </div>

      {syncResult && (
        <div className="text-xs mb-3 p-2 rounded rn-clr-background-light-warning">{syncResult}</div>
      )}

      <button
        className="w-full py-2 px-4 rounded text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: hasFeedUrl && syncStatus !== 'syncing' ? '#4299e1' : '#a0aec0',
          color: 'white',
        }}
        onClick={handleManualSync}
        disabled={!hasFeedUrl || syncStatus === 'syncing'}
      >
        {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

renderWidget(GoodreadsWidget);
