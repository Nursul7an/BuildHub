/** A1 · Вход. */
import { useEffect, useState } from 'react';
import { color, radius, shadow } from '../../design/tokens';
import { Field, PrimaryButton } from '../../design/primitives';
import { useApp } from '../../store/app';
import { ApiError, api } from '../../api/client';

export function LoginScreen() {
  const login = useApp((s) => s.login);
  const go = useApp((s) => s.go);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Открыта ли регистрация. Спрашиваем сервер: показывать ссылку,
   * которая всё равно ответит отказом, — значит звать человека в тупик.
   */
  const [canRegister, setCanRegister] = useState(false);

  useEffect(() => {
    let alive = true;
    void api
      .get<{ open: boolean }>('/auth/registration-open')
      .then((r) => {
        if (alive) setCanRegister(r.open);
      })
      .catch(() => {
        // Сервер недоступен — ссылку не показываем. О связи скажет
        // сама попытка входа, а не пустая догадка на экране.
      });
    return () => {
      alive = false;
    };
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(user, pass);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        // На телефоне форма занимает всю ширину, на широком экране
        // растягивать её незачем — поля длиной в монитор набирать неудобно.
        width: '100%',
        maxWidth: 400,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px 0' }}>
        <div style={{ display: 'flex', background: color.chip, borderRadius: radius.smAlt, padding: 3 }}>
          <div
            style={{
              background: color.surface,
              borderRadius: radius.xxs,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 800,
              color: color.ink,
              boxShadow: '0 1px 3px rgba(20,22,31,0.10)',
            }}
          >
            RU
          </div>
          <div style={{ padding: '6px 14px', fontSize: 13, fontWeight: 700, color: color.muted }}>KG</div>
        </div>
      </div>

      <div style={{ padding: '36px 28px 0', textAlign: 'center' }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: radius.xl,
            background: color.primary,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 30,
            fontWeight: 800,
            boxShadow: shadow.primarySoft,
          }}
        >
          BH
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: color.ink, marginTop: 16 }}>Build Hub</div>
        <div style={{ fontSize: 14, color: color.muted, marginTop: 4 }}>Единая платформа стройкомпании</div>
      </div>

      <div style={{ padding: '32px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="ТЕЛЕФОН ИЛИ ЛОГИН" value={user} onChange={setUser} placeholder="логин или +996…" />

        <div
          style={{
            background: color.surface,
            border: `1.5px solid ${color.border}`,
            borderRadius: radius.md,
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: color.muted }}>ПАРОЛЬ</div>
            <input
              value={pass}
              type={show ? 'text' : 'password'}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 16,
                fontWeight: 700,
                color: color.ink,
                marginTop: 3,
                padding: '4px 0',
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div
            onClick={() => setShow((v) => !v)}
            style={{
              cursor: 'pointer',
              minWidth: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: color.muted,
            }}
          >
            👁
          </div>
        </div>

        {error ? (
          <div style={{ fontSize: 12.5, fontWeight: 800, color: color.danger }}>{error}</div>
        ) : null}

        <PrimaryButton onClick={submit} disabled={busy || !user || !pass}>
          {busy ? 'Входим…' : 'Войти'}
        </PrimaryButton>

        <div
          style={{
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: color.primary,
            padding: 10,
            minHeight: 44,
            cursor: 'pointer',
          }}
        >
          Забыли пароль?
        </div>

        {/*
          Ссылка живёт ровно до появления первого руководителя. Дальше
          учётные записи выдаёт ПТО, и звать сюда посторонних незачем.
        */}
        {canRegister ? (
          <div
            onClick={() => go('register')}
            style={{
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 800,
              color: color.primary,
              padding: 10,
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            Зарегистрировать руководителя
          </div>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: '0 24px 28px',
          textAlign: 'center',
          fontSize: 12.5,
          color: color.faint,
          lineHeight: 1.5,
        }}
      >
        {canRegister
          ? 'Система пуста. Первым входит руководитель — остальных заводит ПТО.'
          : 'Нет доступа? Обратитесь к инженеру ПТО вашей компании.'}
      </div>
    </div>
  );
}
