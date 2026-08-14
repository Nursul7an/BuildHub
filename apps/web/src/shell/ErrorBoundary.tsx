/**
 * Экран не должен уносить всё приложение. На объекте белый экран означает,
 * что отчёт не сдан вовсе, поэтому падение локализуется до одного экрана,
 * а пользователю остаётся путь назад.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { color, radius } from '../design/tokens';

interface Props {
  children: ReactNode;
  /** Меняется при переходе — сбрасывает состояние ошибки. */
  resetKey: string;
  onBack: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Экран упал:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: color.ink }}>Экран не открылся</div>
        <div style={{ fontSize: 13.5, color: color.muted, lineHeight: 1.5 }}>
          Данные пришли не в том виде, который экран ожидает. Остальное приложение работает — вернитесь
          назад и попробуйте ещё раз.
        </div>
        <div
          style={{
            fontSize: 12,
            color: color.faint,
            background: color.screen,
            borderRadius: radius.xs,
            padding: '10px 12px',
            fontFamily: 'ui-monospace, monospace',
            wordBreak: 'break-word',
          }}
        >
          {this.state.error.message}
        </div>
        <div
          onClick={this.props.onBack}
          style={{
            cursor: 'pointer',
            marginTop: 'auto',
            height: 52,
            borderRadius: radius.md,
            background: color.primary,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          Назад
        </div>
      </div>
    );
  }
}
