
export function doLog(...messages: unknown[]) {
    console.log('[Goodreads]', ...messages);
}
  
export function doError(...messages: unknown[]) {
    console.error('[Goodreads]', ...messages);
}