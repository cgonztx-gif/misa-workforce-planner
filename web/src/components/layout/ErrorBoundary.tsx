import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorPanel } from "../ui/ErrorPanel";
import { Button } from "../ui/Button";

interface Props {
  children: ReactNode;
  /** Change this (e.g. the page path) to clear the error when the user navigates. */
  resetKey?: string;
}
interface State {
  error: Error | null;
}

/** Catches render errors in a page so the shell stays up and the error shows in the page, never a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorPanel error={this.state.error} what="this page">
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>
      </ErrorPanel>
    );
  }
}
