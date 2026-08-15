/**
 * Состояние приложения: кто вошёл, где находится, что открыто поверх.
 *
 * Навигация плоская — экран задаётся именем, как в прототипе. Это удобнее
 * маршрутизатора, потому что часть «экранов» — шторки поверх текущего.
 */
import { create } from 'zustand';
import { api, getToken, setToken } from '../api/client';
import type { Me } from '../api/types';
import { ROLE_GROUP_OF, type Role, type RoleGroup } from '@build-hub/shared';

export type Screen =
  // вход и онбординг
  | 'login'
  | 'register'
  | 'password'
  | 'assigned-works'
  | 'onboarding-blocks'
  | 'onboarding-sections'
  // площадка
  | 'today'
  | 'works'
  | 'chain'
  | 'process'
  | 'form'
  | 'preview'
  | 'status'
  | 'returned'
  | 'present'
  // заявки
  | 'zayavki'
  | 'zayavka'
  | 'zayavka-new'
  | 'zayavka-tech'
  | 'acceptance'
  | 'tech-report'
  // подрядчики
  | 'contractors'
  | 'contractor'
  | 'contractor-rate'
  // проект и документы
  | 'project'
  | 'project-set'
  | 'project-sheet'
  | 'project-current'
  | 'rfi'
  | 'documents'
  | 'documents-acts'
  | 'documents-strength'
  | 'documents-object'
  // прочее
  | 'more'
  | 'profile'
  | 'notifications'
  // ПТО
  | 'pto-today'
  | 'pto-queue'
  | 'pto-check'
  | 'pto-presentations'
  | 'pto-objects'
  | 'pto-object'
  | 'pto-chain-setup'
  | 'pto-users'
  | 'pto-user-new'
  | 'pto-more'
  | 'pto-lab'
  // руководство
  | 'boss-digest'
  | 'boss-inbox'
  | 'boss-objects'
  | 'boss-object'
  | 'boss-tasks'
  | 'boss-finance'
  | 'boss-finance-object'
  | 'boss-week'
  | 'boss-quality'
  | 'boss-kpi'
  | 'boss-limits'
  | 'boss-company-objects'
  | 'boss-assign'
  | 'boss-planerka'
  // материалы
  | 'mat-today'
  | 'mat-zayavki'
  | 'mat-stock'
  | 'mat-issue'
  | 'mat-more'
  // спецтехника
  | 'tech-today'
  | 'tech-queue'
  | 'tech-fleet'
  | 'tech-more'
  // помощник
  | 'assistant';

export interface ScreenParams {
  processStateId?: string;
  sectionId?: string;
  blockId?: string;
  floor?: number;
  zayavkaId?: string;
  reportId?: string;
  contractorId?: string;
  objectId?: string;
  setId?: string;
  sheetId?: string;
  incidentId?: string;
  userId?: string;
  machineId?: string;
}

interface AppState {
  me: Me | null;
  loading: boolean;
  screen: Screen;
  params: ScreenParams;
  /** Стек возврата: «назад» в макете возвращает туда, откуда пришли. */
  history: { screen: Screen; params: ScreenParams }[];
  /** Всплывающее сообщение о том, куда ушло действие. */
  toast: string | null;
  /** Секундомер заполнения отчёта: цель ≤ 5 минут, её видит автор. */
  formStartedAt: number | null;
  formFinishedAt: number | null;

  init: () => Promise<void>;
  login: (login: string, password: string) => Promise<void>;
  register: (form: {
    fullName: string;
    login: string;
    phone: string;
    password: string;
    repeatPassword: string;
  }) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  go: (screen: Screen, params?: ScreenParams) => void;
  back: () => void;
  replace: (screen: Screen, params?: ScreenParams) => void;
  notify: (message: string) => void;
  startTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
}

/** Домашний экран роли — с него начинается работа после входа. */
export function homeScreen(role: Role): Screen {
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

export function roleGroup(role: Role): RoleGroup {
  return ROLE_GROUP_OF[role];
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Проверка, что cookie с refresh-токеном вернулась.
 *
 * Браузер молча выбрасывает cookie, которую не принимает: при SameSite=Lax
 * она не ходит между разными сайтами, Safari режет сторонние и при None.
 * Отказ виден не сразу — вход проходит, а через пятнадцать минут человека
 * выкидывает без объяснений, обычно посреди сдачи отчёта.
 *
 * Спрашиваем сразу после входа и говорим прямо. Работать это не мешает:
 * пятнадцать минут у человека есть.
 */
async function warnIfCookieBlocked() {
  try {
    const res = await api.get<{ cookiePresent: boolean }>('/auth/cookie-check');
    if (res.cookiePresent) return;
    useApp
      .getState()
      .notify('Браузер не сохранил сессию — вход придётся повторять каждые 15 минут');
  } catch {
    // Проверка необязательная: её отказ сам по себе ничего не ломает.
  }
}

export const useApp = create<AppState>((set, get) => ({
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
      const me = await api.get<Me>('/auth/me');
      set({ me, loading: false, screen: homeScreen(me.role), params: {}, history: [] });
    } catch {
      setToken(null);
      set({ me: null, loading: false, screen: 'login' });
    }
  },

  login: async (login, password) => {
    const res = await api.post<{ token: string; mustChangePassword: boolean }>('/auth/login', {
      login,
      password,
    });
    setToken(res.token);
    if (res.mustChangePassword) {
      // Временный пароль работает ровно до смены — дальше экрана не пускаем.
      set({ screen: 'password', params: {}, history: [] });
      return;
    }
    const me = await api.get<Me>('/auth/me');
    set({ me, screen: homeScreen(me.role), params: {}, history: [] });
    void warnIfCookieBlocked();
  },

  /**
   * Регистрация первого руководителя. Пароль он задаёт сам, поэтому
   * экрана смены пароля после неё нет — сразу внутрь.
   */
  register: async (form) => {
    const res = await api.post<{ token: string }>('/auth/register', form);
    setToken(res.token);
    const me = await api.get<Me>('/auth/me');
    set({ me, screen: homeScreen(me.role), params: {}, history: [] });
  },

  logout: () => {
    setToken(null);
    set({ me: null, screen: 'login', params: {}, history: [] });
  },

  refreshMe: async () => {
    const me = await api.get<Me>('/auth/me');
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
    } else if (me) {
      set({ screen: homeScreen(me.role), params: {} });
    }
  },

  notify: (message) => {
    set({ toast: message });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2800);
  },

  startTimer: () => {
    if (!get().formStartedAt) set({ formStartedAt: Date.now(), formFinishedAt: null });
  },
  stopTimer: () => set({ formFinishedAt: Date.now() }),
  resetTimer: () => set({ formStartedAt: null, formFinishedAt: null }),
}));

/** «4 мин 14 с» — формат из макета. */
export function formatElapsed(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)} мин ${String(total % 60).padStart(2, '0')} с`;
}
