import { Route, Routes } from 'react-router'

import type { AppProps } from './App'
import { App } from './App'
import type { DemoProps } from './demo/DemoApp'
import { DemoApp } from './demo/DemoApp'

/* Two mounts of one app. `/demo` is its own address rather than a flag held in
   state, so a reload stays in the demo and a CV can link straight to it; the
   app underneath links relatively, so neither mount knows where it is. */
export function Root({
  live = {},
  demo = {},
}: {
  readonly live?: AppProps
  readonly demo?: DemoProps
}) {
  return (
    <Routes>
      <Route path="/demo/*" element={<DemoApp {...demo} />} />
      <Route path="/*" element={<App {...live} />} />
    </Routes>
  )
}
