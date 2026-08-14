/**
 * SMS-шлюз. ТЗ §10: временный пароль при создании учётной записи и сбросе.
 *
 * Драйвер выбирается настройкой. Пока шлюз не подключён, работает журнальный:
 * сообщение попадает в лог сервера, а не исчезает молча — иначе на пилоте
 * никто не поймёт, почему человек не получил пароль.
 *
 * Текст сообщения не хранится: пароль виден один раз и только получателю.
 */
export interface SmsDriver {
  send(phone: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }>;
}

/** Журнальный драйвер для разработки и пилота. */
class LogDriver implements SmsDriver {
  constructor(private readonly log: (line: string) => void) {}

  async send(phone: string, text: string) {
    // Пароль в лог не пишем: только факт и адресат.
    this.log(`SMS → ${maskPhone(phone)}: ${text.replace(/\b[a-z0-9]{8,}\b/gi, '***')}`);
    return { ok: true, id: `log-${Date.now()}` };
  }
}

/** Телефон в журналах маскируется: +996 555 ***-*-01. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${phone.slice(0, phone.length - 4).replace(/\d/g, (d, i) => (i > 5 ? '*' : d))}${digits.slice(-2)}`;
}

let driver: SmsDriver = new LogDriver((line) => console.log(line));

export function setSmsDriver(next: SmsDriver) {
  driver = next;
}

export async function sendSms(phone: string, text: string) {
  return driver.send(phone, text);
}

/** Сообщение с временным паролем. */
export async function sendTemporaryPassword(phone: string, login: string, password: string) {
  return sendSms(
    phone,
    `Build Hub: логин ${login}, временный пароль ${password}. Смените его при первом входе.`,
  );
}
