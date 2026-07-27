/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path or absolute URL the console sends API requests to. */
  readonly VITE_API_BASE_URL?: string
  /** Dev server proxy target; unused in a production build. */
  readonly VITE_API_PROXY_TARGET?: string
  /** Environment label shown in the sidebar. */
  readonly VITE_ENVIRONMENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
