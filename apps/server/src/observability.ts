/**
 * Наблюдаемость. ТЗ §3.1 (метрики, трассировка, ошибки, алерты по SLA) и §11.
 *
 * §11 задаёт то, что нужно мерить: p95 ≤ 400 мс на чтение и ≤ 800 мс на запись
 * без загрузки файлов. Пока никто не считает, соблюдается ли это, требование
 * остаётся строчкой в документе.
 *
 * Метрики держим в памяти и отдаём в формате Prometheus: в целевой схеме их
 * забирает Prometheus, а Grafana рисует. Здесь важно не «подключить сервис»,
 * а начать считать в тех же единицах, в которых написано требование.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

/** Цели из §11, миллисекунды. */
export const SLA_READ_P95_MS = Number(process.env.SLA_READ_P95_MS ?? 400);
export const SLA_WRITE_P95_MS = Number(process.env.SLA_WRITE_P95_MS ?? 800);

/**
 * Сколько последних замеров держим на маршрут. Тысячи хватает, чтобы p95
 * был устойчивым, и мало, чтобы память не росла: на десяти объектах
 * маршрутов десятки, а не тысячи.
 */
const WINDOW = 1000;

interface RouteStats {
  route: string;
  method: string;
  /** Кольцевой буфер длительностей. */
  durations: number[];
  cursor: number;
  count: number;
  total: number;
  errors: number;
  /** Ответы 4xx считаем отдельно: это отказы, а не сбои. */
  rejected: number;
  maxMs: number;
}

const routes = new Map<string, RouteStats>();

/** Загрузка файлов из SLA исключена прямо в §11 — меряем её отдельно. */
function isFileTransfer(url: string): boolean {
  return url.startsWith('/api/v1/files/content');
}

function isWrite(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function keyOf(method: string, route: string): string {
  return `${method} ${route}`;
}

export function record(method: string, route: string, statusCode: number, durationMs: number) {
  const key = keyOf(method, route);
  let stats = routes.get(key);
  if (!stats) {
    stats = {
      route,
      method,
      durations: new Array<number>(WINDOW).fill(0),
      cursor: 0,
      count: 0,
      total: 0,
      errors: 0,
      rejected: 0,
      maxMs: 0,
    };
    routes.set(key, stats);
  }

  stats.durations[stats.cursor] = durationMs;
  stats.cursor = (stats.cursor + 1) % WINDOW;
  stats.count += 1;
  stats.total += durationMs;
  stats.maxMs = Math.max(stats.maxMs, durationMs);
  if (statusCode >= 500) stats.errors += 1;
  else if (statusCode >= 400) stats.rejected += 1;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

function sampleOf(stats: RouteStats): number[] {
  return stats.count >= WINDOW ? stats.durations : stats.durations.slice(0, stats.count);
}

export interface RouteReport {
  method: string;
  route: string;
  kind: 'read' | 'write' | 'file';
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  errors: number;
  rejected: number;
  /** Цель по §11 и укладываемся ли в неё. */
  targetMs: number | null;
  withinSla: boolean | null;
}

export function report(): RouteReport[] {
  return [...routes.values()]
    .map((stats) => {
      const sample = sampleOf(stats);
      const kind: RouteReport['kind'] = isFileTransfer(stats.route)
        ? 'file'
        : isWrite(stats.method)
          ? 'write'
          : 'read';
      const target = kind === 'file' ? null : kind === 'write' ? SLA_WRITE_P95_MS : SLA_READ_P95_MS;
      const p95 = percentile(sample, 95);

      return {
        method: stats.method,
        route: stats.route,
        kind,
        count: stats.count,
        avgMs: stats.count === 0 ? 0 : Number((stats.total / stats.count).toFixed(1)),
        p50Ms: percentile(sample, 50),
        p95Ms: p95,
        p99Ms: percentile(sample, 99),
        maxMs: stats.maxMs,
        errors: stats.errors,
        rejected: stats.rejected,
        targetMs: target,
        withinSla: target === null ? null : p95 <= target,
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms);
}

/** Сводка по SLA: что именно не укладывается и насколько. */
export function slaSummary() {
  const rows = report().filter((r) => r.targetMs !== null && r.count >= 20);
  const breaching = rows.filter((r) => r.withinSla === false);

  return {
    targets: { readP95Ms: SLA_READ_P95_MS, writeP95Ms: SLA_WRITE_P95_MS },
    /** Маршруты с достаточной выборкой: по трём запросам p95 ничего не значит. */
    measured: rows.length,
    breaching: breaching.map((r) => ({
      route: `${r.method} ${r.route}`,
      kind: r.kind,
      p95Ms: r.p95Ms,
      targetMs: r.targetMs,
      overBy: r.targetMs === null ? 0 : r.p95Ms - r.targetMs,
      count: r.count,
    })),
    ok: breaching.length === 0,
  };
}

export function reset() {
  routes.clear();
}

/** Экранирование значений ярлыков в формате Prometheus. */
function label(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

/** Выгрузка в текстовом формате Prometheus. */
export function prometheus(): string {
  const lines: string[] = [];

  lines.push('# HELP buildhub_requests_total Количество обработанных запросов');
  lines.push('# TYPE buildhub_requests_total counter');
  for (const r of report()) {
    const tags = `method="${label(r.method)}",route="${label(r.route)}",kind="${r.kind}"`;
    lines.push(`buildhub_requests_total{${tags}} ${r.count}`);
  }

  lines.push('# HELP buildhub_request_errors_total Ответы 5xx');
  lines.push('# TYPE buildhub_request_errors_total counter');
  for (const r of report()) {
    const tags = `method="${label(r.method)}",route="${label(r.route)}"`;
    lines.push(`buildhub_request_errors_total{${tags}} ${r.errors}`);
  }

  lines.push('# HELP buildhub_request_duration_ms Длительность ответа по квантилям');
  lines.push('# TYPE buildhub_request_duration_ms summary');
  for (const r of report()) {
    const tags = `method="${label(r.method)}",route="${label(r.route)}"`;
    lines.push(`buildhub_request_duration_ms{${tags},quantile="0.5"} ${r.p50Ms}`);
    lines.push(`buildhub_request_duration_ms{${tags},quantile="0.95"} ${r.p95Ms}`);
    lines.push(`buildhub_request_duration_ms{${tags},quantile="0.99"} ${r.p99Ms}`);
  }

  // Отдельная метрика под алерт: сколько маршрутов вышло за SLA (§3.1).
  const sla = slaSummary();
  lines.push('# HELP buildhub_sla_breaching_routes Маршруты, вышедшие за целевой p95');
  lines.push('# TYPE buildhub_sla_breaching_routes gauge');
  lines.push(`buildhub_sla_breaching_routes ${sla.breaching.length}`);

  return `${lines.join('\n')}\n`;
}

/**
 * Подключение к приложению.
 *
 * Идентификатор запроса проходит сквозь логи и возвращается клиенту:
 * без него на жалобу «у меня не сохранилось» нечего искать в журнале.
 */
export function registerObservability(app: FastifyInstance) {
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    // Идентификатор клиента принимаем только безопасный: заголовки HTTP
    // передаются в latin-1, и попытка вернуть кириллицу молча роняет
    // заголовок — след теряется именно тогда, когда он нужен.
    const incoming = req.headers['x-request-id'];
    const clean =
      typeof incoming === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(incoming) ? incoming : null;
    const requestId = clean ?? randomUUID();
    (req as FastifyRequest & { requestId?: string; startedAt?: bigint }).requestId = requestId;
    (req as FastifyRequest & { startedAt?: bigint }).startedAt = process.hrtime.bigint();
    reply.header('x-request-id', requestId);
  });

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const started = (req as FastifyRequest & { startedAt?: bigint }).startedAt;
    if (started === undefined) return;
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;

    // Маршрут, а не полный путь: иначе каждый идентификатор в URL
    // порождает свою метрику и наблюдаемость превращается в шум.
    const route = (req as FastifyRequest & { routeOptions?: { url?: string } }).routeOptions?.url ?? req.url.split('?')[0]!;

    record(req.method, route, reply.statusCode, durationMs);
  });
}

/** Идентификатор запроса — для логов и ответа об ошибке. */
export function requestIdOf(req: FastifyRequest): string | undefined {
  return (req as FastifyRequest & { requestId?: string }).requestId;
}
