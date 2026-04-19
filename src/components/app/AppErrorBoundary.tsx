import { Component, type ReactNode } from 'react';

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

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-10 text-center text-slate-700">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-black">No se ha podido cargar la app</div>
          <div className="mt-2 text-sm font-medium text-slate-600">
            Actualiza la página. Si usas la app instalada, ciérrala y vuelve a abrirla.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-12 w-full rounded-2xl bg-indigo-600 px-6 font-black text-white hover:bg-indigo-700"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}

