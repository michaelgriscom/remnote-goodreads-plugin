import { describe, expect, it, vi } from 'vitest';
import type { RNPlugin } from '@remnote/plugin-sdk';
import { STORAGE_KEYS, runSyncWithStatus } from './sync';

/**
 * A plugin stub whose first settings read blocks until released, so a
 * sync can be held "in progress". An invalid feed URL then makes the
 * sync fail fast without touching any rem APIs.
 */
function makePlugin() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const getSetting = vi.fn(async (id: string) => {
    if (id === 'feedUrl') {
      await gate;
      return 'not a url';
    }
    return undefined;
  });
  const session: Record<string, unknown> = {};
  const plugin = {
    settings: { getSetting },
    app: {
      getPlatform: async () => 'app',
      getOperatingSystem: async () => 'mac',
    },
    storage: {
      setSession: async (key: string, value: unknown) => {
        session[key] = value;
      },
    },
  } as unknown as RNPlugin;
  return { plugin, getSetting, session, release };
}

describe('runSyncWithStatus', () => {
  it('joins an in-progress sync instead of starting another', async () => {
    const { plugin, getSetting, session, release } = makePlugin();

    const first = runSyncWithStatus(plugin);
    const second = runSyncWithStatus(plugin);
    expect(second).toBe(first);

    release();
    expect(await first).toBeUndefined();
    expect(getSetting.mock.calls.filter(([id]) => id === 'feedUrl')).toHaveLength(1);
    expect(session[STORAGE_KEYS.SYNC_STATUS]).toBe('error');
  });

  it('starts a new sync once the previous one has finished', async () => {
    const { plugin, getSetting, release } = makePlugin();
    release();

    await runSyncWithStatus(plugin);
    await runSyncWithStatus(plugin);
    expect(getSetting.mock.calls.filter(([id]) => id === 'feedUrl')).toHaveLength(2);
  });
});
