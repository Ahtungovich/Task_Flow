import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import { Card } from './Card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Непредвиденная ошибка интерфейса.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <Card className="w-full max-w-md p-6 text-center">
            <h1 className="text-lg font-semibold text-slate-900">
              Произошла ошибка в интерфейсе
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {this.state.errorMessage}
            </p>
            <div className="mt-5">
              <Button onClick={this.handleReload}>Перезагрузить страницу</Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
