/**
 * A minimal CORS relay for the RemNote Goodreads plugin, deployable as
 * a Cloudflare Worker.
 *
 * Usage: GET https://<worker-host>/?url=<encoded Goodreads feed URL>
 */

const ALLOWED_HOSTS = new Set(['www.goodreads.com', 'goodreads.com']);
const ALLOWED_PATH_PREFIX = '/review/list_rss/';

/** Edge-cache upstream responses; feeds change rarely and this keeps
 * request volume to Goodreads low. */
const CACHE_TTL_SECONDS = 600;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function errorResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
  });
}

export async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return errorResponse(405, 'Method not allowed');
  }

  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return errorResponse(400, 'Missing "url" query parameter');
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return errorResponse(400, `Invalid "url" query parameter: ${target}`);
  }

  if (targetUrl.protocol !== 'https:') {
    return errorResponse(400, 'Only https URLs are allowed');
  }
  if (!ALLOWED_HOSTS.has(targetUrl.hostname)) {
    return errorResponse(403, 'Only goodreads.com URLs are allowed');
  }
  if (!targetUrl.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
    return errorResponse(403, `Only ${ALLOWED_PATH_PREFIX} feed URLs are allowed`);
  }

  const upstream = await fetch(targetUrl.toString(), {
    headers: { 'User-Agent': 'remnote-goodreads-plugin-cors-proxy' },
    // Cloudflare-specific cache hint; ignored elsewhere
    cf: { cacheTtl: CACHE_TTL_SECONDS, cacheEverything: true },
  } as RequestInit);

  const headers = new Headers(CORS_HEADERS);
  headers.set(
    'Content-Type',
    upstream.headers.get('Content-Type') ?? 'application/xml; charset=utf-8'
  );
  return new Response(upstream.body, { status: upstream.status, headers });
}

export default {
  fetch: (request: Request): Promise<Response> => handleRequest(request),
};
