import { API_BASE_URL, handleJsonResponse } from './client';
import {
  getStoredAccessToken,
  refreshTokenApi,
  storeAuthData,
  clearAuthData,
} from './auth';

let refreshPromise: Promise<void> | null = null;

async function refreshAccessTokenIfNeeded(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const data = await refreshTokenApi();
        storeAuthData(data);
      } catch (err) {
        clearAuthData();
        throw err;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

function buildUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}

async function doAuthFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});
  const body: any = options.body;
  const debugEnabled =
    String(import.meta.env.VITE_API_DEBUG || '').toLowerCase() === 'true';

  const token = getStoredAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && typeof body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  if (debugEnabled) {
    const method = options.method || 'GET';
    const contentType = headers.get('Content-Type');
    let bodyPreview: string | undefined;
    if (typeof body === 'string') {
      bodyPreview = body.length > 500 ? `${body.slice(0, 500)}…` : body;
    } else if (body instanceof FormData) {
      bodyPreview = '[FormData]';
    }
    console.log('[API DEBUG]', {
      method,
      url,
      contentType,
      bodyPreview
    });
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

export async function authFetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await doAuthFetch(path, options);

  if (res.status !== 401) {
    return handleJsonResponse<T>(res);
  }

  try {
    await refreshAccessTokenIfNeeded();
  } catch {
    throw new Error('Session expired. Please log in again.');
  }

  res = await doAuthFetch(path, options);
  if (res.status === 401) {
    clearAuthData();
    throw new Error('Session expired. Please log in again.');
  }

  return handleJsonResponse<T>(res);
}
