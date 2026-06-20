import { Component, type ReactNode } from 'react'

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-[#f4f6fb]">
          <div className="max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-500">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-bold text-ink-900">Une erreur est survenue</h2>
            <p className="mb-4 text-sm text-ink-500">
              L'application a rencontré un problème inattendu. Vos données sont en sécurité.
            </p>
            <p className="mb-5 rounded-lg bg-ink-50 p-3 text-xs text-ink-400 font-mono break-all text-left">
              {this.state.error?.message || 'Erreur inconnue'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Relancer l'application
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
