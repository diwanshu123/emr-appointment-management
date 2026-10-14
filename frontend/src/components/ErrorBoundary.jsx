import { Component } from 'react';

/** Last line of defence: a render crash shows a message instead of a blank screen. */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="page">
        <div className="alert alert-error">
          Something went wrong while displaying this page.{' '}
          <button type="button" className="btn btn-small" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
