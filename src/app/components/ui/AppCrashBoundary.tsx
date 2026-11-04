import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppCrashBoundaryProps {
  children: ReactNode;
}

interface AppCrashBoundaryState {
  hasError: boolean;
}

export default class AppCrashBoundary extends Component<
  AppCrashBoundaryProps,
  AppCrashBoundaryState
> {
  state: AppCrashBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppCrashBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[app:render]', error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="alert"
          className="grid min-h-screen place-items-center bg-[#f6f7f9] px-4 py-10 text-center"
        >
          <div className="max-w-md">
            <h1 className="text-xl font-semibold text-slate-900">Docufy could not load this page</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Reload the page to try again. If the problem continues, contact the shop administrator.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 min-h-11 rounded-lg bg-[#1668D9] px-5 font-semibold text-white hover:bg-[#10316B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] focus-visible:ring-offset-2"
            >
              Reload page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
