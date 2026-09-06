/// <reference types="vite/client" />

/* Public by design: a client id identifies the app, it does not authorise
   anything, so it is built into the static bundle rather than kept secret.

   `interface` rather than `type` because this has to merge with Vite's own
   `ImportMetaEnv`, and only an interface declaration merges. */
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
}
