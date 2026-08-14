/**
 * A1б · Смена пароля.
 * Временный пароль выдаётся один раз; пока он не сменён, других экранов нет.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Field, PrimaryButton } from '../../design/primitives';
import { BackButton } from '../../design/primitives';
import { api, ApiError } from '../../api/client';
import { useApp, homeScreen } from '../../store/app';

const MIN_LENGTH = 8;

export function PasswordScreen() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logout = useApp((s) => s.logout);
  const refreshMe = useApp((s) => s.refreshMe);
  const replace = useApp((s) => s.replace);

  const tooShort = a.length > 0 && a.length < MIN_LENGTH;
  const mismatch = b.length > 0 && a !== b;
  const match = a.length >= MIN_LENGTH && a === b;

  async function save() {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/password', { newPassword: a, repeatPassword: b });
      await refreshMe();
      const me = useApp.getState().me;
      if (me) replace(homeScreen(me.role));
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Не удалось сохранить пароль');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackButton onClick={logout} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: color.ink }}>Придумайте пароль</div>
          <div style={{ fontSize: 12.5, color: color.inkMuted, marginTop: 2, lineHeight: 1.45 }}>
            Временный пароль перестанет работать после смены
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="НОВЫЙ ПАРОЛЬ" value={a} onChange={setA} placeholder="минимум 8 символов" type="password" />
        <Field label="ПОВТОРИТЕ" value={b} onChange={setB} placeholder="ещё раз" type="password" />

        {tooShort ? (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.warnText }}>
            Пароль короче 8 символов — не подойдёт
          </div>
        ) : null}
        {mismatch ? (
          <div style={{ fontSize: 12.5, fontWeight: 800, color: color.danger }}>Пароли не совпадают</div>
        ) : null}
        {match ? (
          <div style={{ fontSize: 12.5, fontWeight: 800, color: color.greenDeep }}>✓ Пароли совпадают</div>
        ) : null}
        {error ? <div style={{ fontSize: 12.5, fontWeight: 800, color: color.danger }}>{error}</div> : null}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 24px 28px' }}>
        <PrimaryButton onClick={save} disabled={!match || busy} style={{ borderRadius: radius.card }}>
          Сохранить пароль
        </PrimaryButton>
        <div
          style={{
            textAlign: 'center',
            fontSize: 11.5,
            color: color.faint,
            marginTop: 8,
            lineHeight: 1.5,
          }}
        >
          Прежний пароль перестанет работать · посмотреть его повторно нельзя, только сбросить у главного
          инженера
        </div>
      </div>
    </div>
  );
}
