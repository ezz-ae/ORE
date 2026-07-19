'use client'

import { Component, type ReactNode } from 'react'

/**
 * Render-error containment for the workspace. A crash in one widget or page
 * must never blank the whole app into Next's generic "Application error"
 * screen — that is exactly what happened when the Ads Machine page threw
 * during render and the operator saw a white page with no clue.
 *
 * Two modes:
 *  - visible (default): a compact panel showing THE ACTUAL error message, so
 *    a screenshot of the failure is self-diagnosing.
 *  - silent: renders nothing on error (for floating convenience widgets like
 *    the verdict notifier — a broken pill should vanish, not lecture).
 *
 * Deliberately hook-free and untranslated: this surface must still render
 * when the i18n provider itself is what crashed.
 */
export class FiErrorBoundary extends Component<
  { children: ReactNode; label: string; silent?: boolean },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error(`[fi-boundary:${this.props.label}]`, error, info?.componentStack ?? '')
  }

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.silent) return null
    const message = this.state.error.message || String(this.state.error)
    return (
      <div className="m-6 rounded-2xl border border-red-400/25 bg-red-400/[0.05] p-5">
        <div className="text-sm font-semibold text-white">This section failed to render</div>
        <p className="mt-1.5 break-words font-mono text-xs leading-relaxed text-red-300">
          {this.props.label}: {message}
        </p>
        <button
          type="button"
          onClick={() => { this.setState({ error: null }) }}
          className="mt-4 rounded-full border border-line px-4 py-2 text-xs font-medium text-slate-300 transition hover:text-white"
        >
          Try again
        </button>
      </div>
    )
  }
}
