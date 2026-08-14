/**
 * Левая колонка прототипа: быстрая смена роли и подсказка по сценарию.
 * Это витрина для демонстрации, а не часть продукта — в приложении на телефоне
 * её нет, роль определяется учётной записью.
 */
import { useState } from 'react';
import { color, radius } from '../design/tokens';
import { ROLE_TITLE, type Role } from '@build-hub/shared';
import { useApp, homeScreen } from '../store/app';
import { api, setToken } from '../api/client';
import type { Me } from '../api/types';

const DEMO_USERS: { login: string; role: Role; label: string }[] = [
  { login: 'a.zhumabekov', role: 'prorab', label: '👷 Прораб · Азамат Ж.' },
  { login: 't.mamatov', role: 'master', label: '👷 Мастер · Тилек М.' },
  { login: 'g.sadykova', role: 'pto', label: '📋 Инженер ПТО · Гульмира С.' },
  { login: 'n.toktomatov', role: 'dir', label: '📊 Директор · Нурлан Т.' },
  { login: 'n.tashiev', role: 'gi', label: '📊 Гл. инженер · Нурлан Т.' },
  { login: 'e.bakirov', role: 'snab', label: '📦 Снабжение · Эркин Б.' },
  { login: 'm.abdyldaev', role: 'sklad', label: '📦 Завсклад · Мирлан А.' },
  { login: 'k.turgunov', role: 'tech', label: '🚜 Спецтехника · Кубанычбек Т.' },
];

const DEMO_PASSWORD = 'buildhub2026';

export function DemoPanel() {
  const me = useApp((s) => s.me);
  const [busy, setBusy] = useState<string | null>(null);

  async function switchTo(login: string) {
    setBusy(login);
    try {
      const res = await api.post<{ token: string }>('/auth/login', { login, password: DEMO_PASSWORD });
      setToken(res.token);
      const next = await api.get<Me>('/auth/me');
      useApp.setState({ me: next, screen: homeScreen(next.role), params: {}, history: [], toast: null });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        width: 270,
        paddingTop: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'sticky',
        top: 36,
        flex: 'none',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: color.muted }}>
        BUILD HUB · ДЕМОНСТРАЦИЯ
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color: color.ink, lineHeight: 1.25 }}>
        Все экраны приложения, на живых данных
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: color.muted }}>РОЛЬ</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {DEMO_USERS.map((u) => {
          const on = me?.login === u.login;
          return (
            <div
              key={u.login}
              onClick={() => !on && switchTo(u.login)}
              style={{
                cursor: on ? 'default' : 'pointer',
                borderRadius: radius.smAlt,
                padding: '11px 14px',
                fontSize: 13.5,
                fontWeight: 700,
                opacity: busy === u.login ? 0.6 : 1,
                ...(on
                  ? { background: color.primary, color: '#fff', border: `1px solid ${color.primary}` }
                  : { background: color.surface, color: color.ink, border: `1px solid ${color.border}` }),
              }}
            >
              {u.label}
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: color.surface,
          border: `1px solid ${color.border}`,
          borderRadius: radius.sm,
          padding: '14px 16px',
          fontSize: 12.5,
          color: color.inkMuted,
          lineHeight: 1.6,
        }}
      >
        <b style={{ color: color.ink }}>Главный путь прораба:</b> Сегодня → «Горит» → карточка процесса →
        Комментарий → «Нехватка материала» → Создать заявку → заявка в реестре. Плюс: Работы → Монолит →
        цепочка 16 процессов.
        <br />
        <br />
        <b style={{ color: color.ink }}>ПТО:</b> очередь → проверка → подтвердить / скорректировать /
        вернуть.
        <br />
        <br />
        <b style={{ color: color.ink }}>Руководство:</b> сводка → «Требует решения» → карточка простоя →
        поручить → задача в реестре.
      </div>

      {me ? (
        <div style={{ fontSize: 12, color: color.faint, lineHeight: 1.5 }}>
          Вошли: {me.fullName} · {ROLE_TITLE[me.role]}
          <br />
          Данные — из базы, не из макета: действия одной роли видны другой.
        </div>
      ) : null}
    </div>
  );
}
