import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureClientException } from '../../lib/observability';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureClientException(error, {
      componentStack: errorInfo.componentStack ?? '',
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="flex min-h-screen items-center justify-center bg-slate-50 p-10 text-center text-slate-700 dark:bg-slate-950 dark:text-slate-200"
        role="alert"
        aria-live="assertive"
      >
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="text-lg font-black">No se ha podido cargar la app</div>
          <div className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-400">
            Ezin izan da aplikazioa kargatu.
          </div>
          <div className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            Actualiza la página. Si usas la app instalada, ciérrala y vuelve a abrirla.
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-500">
            Freskatu orria. Aplikazioa instalatuta baduzu, itxi eta berriro ireki.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-12 w-full rounded-2xl bg-indigo-600 px-6 font-black text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            Recargar / Birkargatu
          </button>
        </div>
      </div>
    );
  }
}
