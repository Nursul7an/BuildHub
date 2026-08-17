/**
 * E1–E3 · «Ещё», профиль, уведомления, а также экран помощника.
 *
 * Меню «Ещё» разное у ролей — это единственное место, где роли расходятся
 * по составу пунктов, а не по данным.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Avatar, Badge, Card, SectionLabel, initialsOf, tabular } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { AssistantAnswer, NotificationDto } from '../../api/types';
import { ROLE_TITLE, type Role } from '@build-hub/shared';
import { useApp, type Screen } from '../../store/app';
import { DataState } from '../../design/DataState';

interface MenuItem {
  label: string;
  hint?: string;
  screen: Screen;
  roles?: Role[];
}

const MENU: MenuItem[] = [
  { label: '🔔 Уведомления', hint: 'что пришло из отделов', screen: 'notifications' },
  { label: '🏗 Подрядчики', hint: 'рейтинг, предписания, оценка этапа', screen: 'contractors', roles: ['prorab', 'master'] },
  { label: '📐 Проект', hint: 'комплекты, действующие листы, RFI', screen: 'project' },
  { label: '📄 Документы', hint: 'акты, протоколы, журналы', screen: 'documents' },
  { label: '🚜 Заявка на технику', hint: 'кран, насос, самосвал', screen: 'zayavka-tech', roles: ['prorab', 'master'] },
  { label: '👤 Профиль', hint: 'данные, зона ответственности, выход', screen: 'profile' },
];

export function MoreScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  if (!me) return null;

  const items = MENU.filter((m) => !m.roles || m.roles.includes(me.role));

  return (
    <ScreenBody>
      <RootHeader title="Ещё" subtitle={`${me.fullName} · ${ROLE_TITLE[me.role]}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        {items.map((m) => (
          <Card key={m.screen} onClick={() => go(m.screen)} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>{m.label}</div>
                {m.hint ? (
                  <div style={{ fontSize: 12.5, color: color.muted, marginTop: 2 }}>{m.hint}</div>
                ) : null}
              </div>
              <div style={{ color: color.faint, fontSize: 16, flexShrink: 0 }}>›</div>
            </div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── E2 · Профиль ───────────────────────────── */

export function ProfileScreen() {
  const back = useApp((s) => s.back);
  const logout = useApp((s) => s.logout);
  const me = useApp((s) => s.me);
  if (!me) return null;

  return (
    <ScreenBody>
      <ScreenHeader title="Профиль" onBack={back} />

      <Card style={{ margin: '4px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <Avatar initials={initialsOf(me.fullName)} size={56} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: color.ink }}>{me.fullName}</div>
          <div style={{ fontSize: 13, color: color.muted, marginTop: 2 }}>{ROLE_TITLE[me.role]}</div>
        </div>
      </Card>

      <Card style={{ margin: '8px 20px' }}>
        <InfoRow label="ЛОГИН" value={me.login} />
        <InfoRow label="ТЕЛЕФОН" value={me.phone} />
        <InfoRow
          label="ЗОНА ОТВЕТСТВЕННОСТИ"
          value={
            [me.object?.name, me.block?.name, me.scopeLabel].filter(Boolean).join(' · ') || 'вся компания'
          }
        />
      </Card>

      <div
        onClick={logout}
        style={{
          cursor: 'pointer',
          margin: '8px 20px',
          height: 52,
          borderRadius: radius.md,
          background: color.surface,
          border: `1px solid ${color.border}`,
          color: color.danger,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14.5,
          fontWeight: 800,
        }}
      >
        Выйти
      </div>
    </ScreenBody>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${color.borderSoft}` }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: color.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/* ───────────────────────────── E1 · Уведомления ───────────────────────────── */

export function NotificationsScreen() {
  const back = useApp((s) => s.back);
  const { data, loading, error, reload } = useQuery<NotificationDto[]>('/notifications');
  const items = data ?? [];

  const markAll = useAction(async () => {
    await api.post('/notifications/read-all');
    reload();
  });

  const unread = (data ?? []).filter((n) => !n.read);

  return (
    <ScreenBody>
      <ScreenHeader
        title="Уведомления"
        subtitle={unread.length > 0 ? `${unread.length} непрочитанных` : 'всё прочитано'}
        onBack={back}
        right={
          unread.length > 0 ? (
            <div
              onClick={() => markAll.run()}
              style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: color.primary, flexShrink: 0 }}
            >
              прочитать всё
            </div>
          ) : undefined
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
        <DataState
          loading={loading}
          error={error}
          empty={items.length === 0}
          emptyText="Уведомлений нет"
          onRetry={reload}
        >
  {(data ?? []).map((n) => (
            <Card
              key={n.id}
              onClick={async () => {
                if (!n.read) {
                  await api.post(`/notifications/${n.id}/read`);
                  reload();
                }
              }}
              style={{
                borderRadius: radius.md,
                padding: '14px 16px',
                ...(n.read ? { opacity: 0.65 } : { border: `1px solid ${color.primaryBorder}` }),
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: color.ink, minWidth: 0 }}>{n.title}</div>
                <div style={{ fontSize: 11.5, color: color.faint, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {new Date(n.at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: color.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
                {n.subtitle}
              </div>
            </Card>
          ))}
        </DataState>

        {(data ?? []).length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: color.muted, fontSize: 13.5 }}>
            Уведомлений нет
          </div>
        ) : null}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── AI · Помощник ───────────────────────────── */

export function AssistantScreen() {
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const [text, setText] = useState('');
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);

  const { data: suggestions } = useQuery<{ key: string; question: string }[]>('/assistant/suggestions');

  const ask = useAction(async (payload: { key?: string; text?: string }) => {
    const res = await api.post<AssistantAnswer>('/assistant/ask', payload);
    setAnswer(res);
    setText('');
  });

  const list = answer?.suggestions ?? suggestions ?? [];

  return (
    <ScreenBody>
      <ScreenHeader title="Помощник" subtitle="отвечает по данным системы" onBack={back} />

      {answer ? (
        <Card style={{ margin: '4px 20px' }}>
          {answer.question ? (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: color.muted }}>{answer.question}</div>
          ) : null}
          <div
            style={{
              fontSize: 14.5,
              color: color.ink,
              marginTop: 6,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              ...tabular,
            }}
          >
            {answer.text}
          </div>
          {/* Источник обязателен: по нему ответ можно проверить. */}
          {answer.source ? (
            <div style={{ fontSize: 11.5, color: color.faint, marginTop: 8 }}>Источник: {answer.source}</div>
          ) : null}
          {answer.actions.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
              {answer.actions.map((a) => (
                <div
                  key={a.label}
                  onClick={() => go(a.screen as Screen)}
                  style={{
                    cursor: 'pointer',
                    background: color.primaryBg,
                    color: color.primary,
                    border: `1px solid ${color.primaryBorder}`,
                    borderRadius: radius.xs,
                    padding: '9px 12px',
                    fontSize: 12.5,
                    fontWeight: 800,
                  }}
                >
                  {a.label}
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : (
        <div
          style={{
            margin: '4px 20px',
            background: color.primaryBg,
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: radius.md,
            padding: '12px 14px',
            fontSize: 13,
            color: color.primaryDark,
            lineHeight: 1.5,
          }}
        >
          Отвечаю только по тем данным, к которым у вас есть доступ. Числа беру из базы, к каждому ответу
          показываю источник. Если ответа нет — так и скажу.
        </div>
      )}

      <SectionLabel style={{ padding: '14px 20px 6px' }}>ЧТО МОЖНО СПРОСИТЬ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
        {list.map((s) => (
          <div
            key={s.key}
            onClick={() => ask.run({ key: s.key })}
            style={{
              cursor: 'pointer',
              background: color.surface,
              borderRadius: radius.sm,
              padding: '12px 14px',
              fontSize: 13.5,
              color: color.ink,
              boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
            }}
          >
            {s.question}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: '12px 20px 24px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) ask.run({ text });
          }}
          placeholder="Спросить своими словами"
          style={{
            flex: 1,
            boxSizing: 'border-box',
            border: `1px solid ${color.border}`,
            outline: 'none',
            background: color.surface,
            borderRadius: radius.sm,
            padding: '13px 14px',
            fontSize: 14,
            color: color.ink,
            fontFamily: 'inherit',
          }}
        />
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.sm,
            background: color.primaryBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flex: 'none',
          }}
        >
          🎤
        </div>
      </div>
    </ScreenBody>
  );
}

export { Badge };
