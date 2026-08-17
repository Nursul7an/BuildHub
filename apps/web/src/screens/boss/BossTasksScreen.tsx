/**
 * BOSS 6 · Реестр поручений.
 *
 * Отдельный экран нужен, чтобы видеть все поручения разом — по объектам и
 * срокам. Просроченные идут первыми: их читают, а не ищут.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, Card, SectionLabel, Segmented, tabular } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { TaskDto } from '../../api/types';
import { useApp } from '../../store/app';
import { DataState } from '../../design/DataState';

export function BossTasksScreen() {
  const back = useApp((s) => s.back);
  const [filter, setFilter] = useState<'open' | 'done'>('open');
  const { data, loading, error, reload } = useQuery<TaskDto[]>('/boss/tasks');

  const list = (data ?? []).filter((t) => (filter === 'open' ? t.status !== 'done' : t.status === 'done'));
  const overdue = list.filter((t) => t.overdue);
  const rest = list.filter((t) => !t.overdue);

  return (
    <ScreenBody>
      <ScreenHeader title="Реестр поручений" subtitle={`${list.length} записей`} onBack={back} />

      <div style={{ padding: '0 20px 8px' }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'В работе' },
            { value: 'done', label: 'Выполнено' },
          ]}
        />
      </div>

      {overdue.length > 0 ? (
        <>
          <SectionLabel tone="danger" style={{ padding: '8px 20px 6px' }}>
            ПРОСРОЧЕНО · {overdue.length}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
            {overdue.map((t) => (
              <TaskRow key={t.id} task={t} onDone={reload} />
            ))}
          </div>
        </>
      ) : null}

      <SectionLabel style={{ padding: '14px 20px 6px' }}>ОСТАЛЬНЫЕ · {rest.length}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
        <DataState
          loading={loading}
          error={error}
          empty={rest.length === 0 && overdue.length === 0}
          emptyText="Задач нет"
          onRetry={reload}
        >
  {rest.map((t) => (
            <TaskRow key={t.id} task={t} onDone={reload} />
          ))}
        </DataState>
      </div>
    </ScreenBody>
  );
}

function TaskRow({ task, onDone }: { task: TaskDto; onDone: () => void }) {
  return (
    <Card
      style={{
        borderRadius: radius.md,
        padding: '14px 16px',
        ...(task.overdue ? { border: '1.5px solid #F0B4B0' } : null),
        ...(task.status === 'done' ? { opacity: 0.65 } : null),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }}>{task.text}</div>
        <Badge tone={task.overdue ? 'warn' : task.status === 'done' ? 'green' : 'neutral'} style={{ flexShrink: 0 }}>
          {task.status === 'done'
            ? 'выполнено'
            : task.overdue
              ? 'просрочено'
              : new Date(task.dueDate).toLocaleDateString('ru-RU')}
        </Badge>
      </div>
      <div style={{ fontSize: 12.5, color: color.muted, marginTop: 4, ...tabular }}>
        {task.assignee ?? 'исполнитель не назначен'} · {task.objectName}
        {task.sectionName ? ` · ${task.sectionName}` : ''}
        {task.floor ? ` · ${task.floor} эт.` : ''}
      </div>
      <div style={{ fontSize: 11.5, color: color.faint, marginTop: 3 }}>
        поставил {task.author} ·{' '}
        {task.origin === 'inbox' ? 'из ленты проблем' : task.origin === 'schedule' ? 'по графику' : 'вручную'}
      </div>
      {task.status !== 'done' ? (
        <div
          onClick={async () => {
            await api.post(`/boss/tasks/${task.id}/done`);
            onDone();
          }}
          style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: color.primary, marginTop: 8 }}
        >
          Отметить выполненной
        </div>
      ) : null}
    </Card>
  );
}
