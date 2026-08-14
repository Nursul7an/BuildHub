/**
 * Клиент API. Токен хранится в localStorage; истёкшая сессия и требование
 * сменить пароль обрабатываются здесь, а не в каждом экране.
 */
const TOKEN_KEY = 'build-hub.token';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type Listener = (event: 'unauthorized' | 'password_required') => void;
const listeners = new Set<Listener>();

export function onAuthEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const err = (data ?? {}) as { error?: string; message?: string };
    if (response.status === 401) {
      setToken(null);
      listeners.forEach((l) => l('unauthorized'));
    }
    if (err.error === 'password_change_required') {
      listeners.forEach((l) => l('password_required'));
    }
    throw new ApiError(response.status, err.error ?? 'error', err.message ?? 'Что-то пошло не так');
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
