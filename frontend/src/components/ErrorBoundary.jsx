import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { scope = 'page' } = this.props;
    const isDev = import.meta.env?.DEV;

    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="glass p-8 text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-2xl font-bold gradient-text">Something went wrong</h2>
          <p className="text-slate-400 text-sm">
            {scope === 'app'
              ? "CourtIQ ran into an unexpected error. Try refreshing, or head home."
              : "This section failed to load. You can try again or go back home."}
          </p>

          {isDev && this.state.error && (
            <pre className="mt-2 text-left text-xs text-rose-300 bg-black/40 border border-white/10 rounded-lg p-3 overflow-auto max-h-48">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={this.handleReset} className="btn-primary">
              Try again
            </button>
            <a href="/" className="btn-ghost">Go home</a>
          </div>
        </div>
      </div>
    );
  }
}
