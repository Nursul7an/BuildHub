/**
 * Состояние приложения: кто вошёл, где находится, что открыто поверх.
 *
 * Навигация плоская — экран задаётся именем, как в прототипе. Это удобнее
 * маршрутизатора, потому что часть «экранов» — шторки поверх текущего.
 */
import { create } from 'zustand';
import { api, getToken, setToken } from '../api/client';
import { ROLE_GROUP_OF } from '@build-hub/shared';
/** Домашний экран роли — с него начинается работа после входа. */
export function homeScreen(role) {
    const group = ROLE_GROUP_OF[role];
    switch (group) {
        case 'field':
            return 'today';
        case 'pto':
            return 'pto-today';
        case 'boss':
            return 'boss-digest';
        case 'mat':
            return 'mat-today';
        case 'tech':
            return 'tech-today';
        default:
            return 'today';
    }
}
export function roleGroup(role) {
    return ROLE_GROUP_OF[role];
}
let toastTimer;
export const useApp = create((set, get) => ({
    me: null,
    loading: true,
    screen: 'login',
    params: {},
    history: [],
    toast: null,
    formStartedAt: null,
    formFinishedAt: null,
    init: async () => {
        if (!getToken()) {
            set({ loading: false, screen: 'login' });
            return;
        }
        try {
            const me = await api.get('/auth/me');
            set({ me, loading: false, screen: homeScreen(me.role), params: {}, history: [] });
        }
        catch {
            setToken(null);
            set({ me: null, loading: false, screen: 'login' });
        }
    },
    login: async (login, password) => {
        const res = await api.post('/auth/login', {
            login,
            password,
        });
        setToken(res.token);
        if (res.mustChangePassword) {
            // Временный пароль работает ровно до смены — дальше экрана не пускаем.
            set({ screen: 'password', params: {}, history: [] });
            return;
        }
        const me = await api.get('/auth/me');
        set({ me, screen: homeScreen(me.role), params: {}, history: [] });
    },
    logout: () => {
        setToken(null);
        set({ me: null, screen: 'login', params: {}, history: [] });
    },
    refreshMe: async () => {
        const me = await api.get('/auth/me');
        set({ me });
    },
    go: (screen, params = {}) => {
        const { screen: from, params: fromParams, history } = get();
        set({ screen, params, history: [...history, { screen: from, params: fromParams }].slice(-20) });
    },
    replace: (screen, params = {}) => set({ screen, params }),
    back: () => {
        const { history, me } = get();
        const previous = history[history.length - 1];
        if (previous) {
            set({ screen: previous.screen, params: previous.params, history: history.slice(0, -1) });
        }
        else if (me) {
            set({ screen: homeScreen(me.role), params: {} });
        }
    },
    notify: (message) => {
        set({ toast: message });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: null }), 2800);
    },
    startTimer: () => {
        if (!get().formStartedAt)
            set({ formStartedAt: Date.now(), formFinishedAt: null });
    },
    stopTimer: () => set({ formFinishedAt: Date.now() }),
    resetTimer: () => set({ formStartedAt: null, formFinishedAt: null }),
}));
/** «4 мин 14 с» — формат из макета. */
export function formatElapsed(ms) {
    const total = Math.round(ms / 1000);
    return `${Math.floor(total / 60)} мин ${String(total % 60).padStart(2, '0')} с`;
}
