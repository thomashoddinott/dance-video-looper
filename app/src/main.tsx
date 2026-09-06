import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { App } from './App'
import { DriveSessionProvider } from './drive/DriveSessionProvider'
import { browserTokenSource } from './drive/gisTokenSource'
import { localTokenStore } from './drive/tokenStore'
import './index.css'

/* A client id is public by design — it identifies the app, it does not
   authorise anything — so building it into a static bundle is correct rather
   than a leak. */
const tokenSource = browserTokenSource(
  window,
  import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
)

/* Built once, not per render: the provider hangs `acquire` off this identity,
   and every callback it hands out is keyed on that in turn, so a fresh object
   each render would churn the whole session value past every consumer. */
const tokenStore = localTokenStore(window.localStorage)

const container = document.getElementById('root')

if (!container) {
  throw new Error('No #root element to mount the app into')
}

createRoot(container).render(
  <StrictMode>
    <DriveSessionProvider tokenSource={tokenSource} tokenStore={tokenStore}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </DriveSessionProvider>
  </StrictMode>,
)
