/**
 * Клиент API. Токен хранится в localStorage; истёкшая сессия и требование
 * сменить пароль обрабатываются здесь, а не в каждом экране.
 */
const TOKEN_KEY = 'build-hub.token';

/**
 * Адрес API. В разработке пусто — запросы идут на тот же адрес, и их
 * переставляет прокси Vite. В развёрнутой сборке фронтенд и сервер живут
 * на разных хостах, поэтому адрес задаётся переменной VITE_API_BASE_URL
 * на этапе сборки. Без неё запросы уйдут в никуда на статическом хостинге.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

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

/**
 * Обновление доступа.
 *
 * Refresh-токен лежит в httpOnly cookie: страница его не видит и послать
 * сама не может — браузер прикладывает cookie к запросу, потому и нужен
 * credentials: 'include'.
 *
 * Одновременных обновлений быть не должно. Refresh одноразовый, и если три
 * запроса разом получат 401 и каждый пойдёт обновляться, то второй и третий
 * предъявят уже погашенный токен. Сервер расценит это как кражу и закроет
 * все сессии устройства — человека выкинет из системы на ровном месте.
 * Поэтому обновление одно на всех: остальные ждут его результата.
 */
let refreshing: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Заголовок нельзя выставить из простой формы: он вынуждает
          // предварительный запрос CORS и тем закрывает подделку
          // межсайтового запроса, когда cookie идёт с SameSite=None.
          'x-build-hub-client': 'web',
        },
        credentials: 'include',
        body: '{}',
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { token?: string };
      if (!data.token) return false;
      setToken(data.token);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

async function send(method: string, path: string, body?: unknown): Promise<Response> {
  const token = getToken();
  const relative = path.startsWith('/api') ? path : `/api${path}`;
  return fetch(`${API_BASE}${relative}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-build-hub-client': 'web',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    // Cookie с refresh-токеном уходит только на /api/auth — путь задан
    // на сервере, здесь достаточно разрешить её отправку.
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response = await send(method, path, body);

  // Access живёт 15 минут. Истёк — молча обновляем и повторяем один раз:
  // прораб не должен входить заново посреди сдачи отчёта.
  const isRefreshCall = path.startsWith('/api/auth/refresh');
  if (response.status === 401 && !isRefreshCall && getToken() !== null) {
    if (await refreshAccess()) {
      response = await send(method, path, body);
    }
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    // Сервер отвечает {code, message} — ТЗ §6. Прежний разбор читал
    // err.error, поэтому требование сменить пароль до экрана не доходило.
    const err = (data ?? {}) as { code?: string; message?: string };
    if (response.status === 401) {
      setToken(null);
      listeners.forEach((l) => l('unauthorized'));
    }
    if (err.code === 'password_change_required') {
      listeners.forEach((l) => l('password_required'));
    }
    throw new ApiError(response.status, err.code ?? 'error', err.message ?? 'Что-то пошло не так');
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
