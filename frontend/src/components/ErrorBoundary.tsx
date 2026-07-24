import { Component, type ErrorInfo, type ReactNode } from "react";
import { Icon } from "./icons";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * App-wide error boundary. Without it, any render exception unmounts the whole
 * SPA into a blank white screen. This catches it and shows a recoverable
 * Hebrew fallback with a reload action.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced to the console for now; wire to Sentry when it's added.
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        dir="rtl"
        className="min-h-dvh grid place-items-center bg-cream-50 px-4 text-center"
      >
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-50 text-coral-400">
            <Icon name="error" size={28} />
          </div>
          <h1 className="font-display text-xl text-navy-800 mb-2">
            משהו השתבש
          </h1>
          <p className="text-sm text-navy-500 mb-5">
            אירעה תקלה בהצגת המסך. נסה לרענן את העמוד.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            רענן
          </button>
        </div>
      </div>
    );
  }
}
