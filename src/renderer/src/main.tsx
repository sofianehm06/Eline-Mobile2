import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SettingsProvider } from './lib/settings'
import { RoleProvider } from './lib/role'
import { ToastProvider } from './lib/toast'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <ToastProvider>
          <SettingsProvider>
            <RoleProvider>
              <App />
            </RoleProvider>
          </SettingsProvider>
        </ToastProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
