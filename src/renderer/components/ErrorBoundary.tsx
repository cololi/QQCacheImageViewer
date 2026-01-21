import React from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Renderer crash caught by ErrorBoundary:', error, info);
    // Best-effort: log to main process via IPC if the channel exists.
    // Swallow any failure so the boundary itself never throws.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.electron?.ipcRenderer.invoke('log-renderer-error' as any, {
        message: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      });
    } catch {
      /* ignore */
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="渲染层崩溃"
          subTitle={this.state.error?.message || '未知错误'}
          extra={[
            <Button key="reset" type="primary" onClick={this.handleReset}>
              重试
            </Button>,
            <Button key="reload" onClick={this.handleReload}>
              重新加载窗口
            </Button>,
          ]}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
