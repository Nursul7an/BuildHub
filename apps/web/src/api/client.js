/**
 * Клиент API. Токен хранится в localStorage; истёкшая сессия и требование
 * сменить пароль обрабатываются здесь, а не в каждом экране.
 */
const TOKEN_KEY = 'build-hub.token';
export class ApiError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'ApiError';
    }
}
export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
    if (token)
        localStorage.setItem(TOKEN_KEY, token);
    else
        localStorage.removeItem(TOKEN_KEY);
}
const listeners = new Set();
export function onAuthEvent(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
async function request(method, path, body) {
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
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const err = (data ?? {});
        if (response.status === 401) {
            setToken(null);
            listeners.forEach((l) => l('unauthorized'));
        }
        if (err.error === 'password_change_required') {
            listeners.forEach((l) => l('password_required'));
        }
        throw new ApiError(response.status, err.error ?? 'error', err.message ?? 'Что-то пошло не так');
    }
    return data;
}
export const api = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    patch: (path, body) => request('PATCH', path, body),
    del: (path) => request('DELETE', path),
};
