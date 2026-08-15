/**
 * Регистрация первого руководителя.
 *
 * Обычные учётные записи заводит ПТО. Первого директора завести некому:
 * система приходит пустой, и без этого экрана в неё вообще не войти.
 * Как только руководитель появился, экран закрывается насовсем — ссылки
 * на него на входе больше не будет, а прямой заход получит отказ.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Field, PrimaryButton } from '../../design/primitives';
import { useApp } from '../../store/app';
import { ApiError } from '../../api/client';

export function RegisterScreen() {
  const register = useApp((s) => s.register);
  const replace = useApp((s) => s.replace);

  const [fullName, setFullName] = useState('');
  const [login, setLogin] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Что мешает отправить — пишем текстом. Погашенная кнопка без причины
   * заставляет гадать, а гадать на морозе никто не станет.
   */
  const blocker =
    fullName.trim().length < 3
      ? 'Укажите фамилию, имя и отчество'
      : login.trim().length < 3
        ? 'Логин короче трёх символов'
        : !/^[a-zA-Z0-9._-]+$/.test(login.trim())
          ? 'Логин — латиница, цифры, точка, дефис'
          : phone.trim().length < 6
            ? 'Укажите телефон'
            : password.length < 8
              ? 'Пароль короче 8 символов'
              : /^\d+$/.test(password)
                ? 'Только цифры — слишком просто, добавьте буквы'
                : password !== repeatPassword
                  ? 'Пароли не совпадают'
                  : null;

  async function submit() {
    if (blocker) {
      setError(blocker);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        fullName: fullName.trim(),
        login: login.trim(),
        phone: phone.trim(),
        password,
        repeatPassword,
      });
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Не удалось зарегистрироваться');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
      <div style={{ padding: '28px 28px 0', textAlign: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.xl,
            background: color.primary,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          BH
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: color.ink, marginTop: 14 }}>
          Регистрация руководителя
        </div>
        <div style={{ fontSize: 13.5, color: color.muted, marginTop: 6, lineHeight: 1.5 }}>
          Первый вход в новую систему. Остальных сотрудников заведёт ПТО.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 24px 0' }}>
        <Field label="ФАМИЛИЯ, ИМЯ, ОТЧЕСТВО" value={fullName} onChange={setFullName} placeholder="Токтоматов Нурлан" />
        <Field
          label="ЛОГИН"
          value={login}
          onChange={setLogin}
          placeholder="n.toktomatov"
          hint="Латиница и цифры — логин диктуют по телефону"
        />
        <Field label="ТЕЛЕФОН" value={phone} onChange={setPhone} placeholder="+996 555 000 000" />
        <Field label="ПАРОЛЬ" value={password} onChange={setPassword} type="password" />
        <Field label="ПАРОЛЬ ЕЩЁ РАЗ" value={repeatPassword} onChange={setRepeat} type="password" />

        {error ? (
          <div style={{ fontSize: 12.5, fontWeight: 800, color: color.danger }}>{error}</div>
        ) : null}

        <PrimaryButton onClick={submit} disabled={busy}>
          {busy ? 'Регистрируем…' : 'Зарегистрироваться'}
        </PrimaryButton>

        <div
          onClick={() => replace('login')}
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
          У меня уже есть доступ
        </div>
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: '10px 24px 28px',
          textAlign: 'center',
          fontSize: 12.5,
          color: color.faint,
          lineHeight: 1.5,
        }}
      >
        Пароль вы задаёте сами — менять его при первом входе не потребуется.
      </div>
    </div>
  );
}
