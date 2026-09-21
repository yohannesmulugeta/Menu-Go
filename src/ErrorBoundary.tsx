import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Menu Go render failure", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="auth-page">
          <section className="auth-card" role="alert">
            <p className="eyebrow dark">MENU GO</p>
            <h1>Something went wrong</h1>
            <p className="auth-copy">Refresh the page to try again. Your menu data has not been changed.</p>
            <button className="primary-button auth-submit" onClick={() => window.location.reload()}>
              Refresh page
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
