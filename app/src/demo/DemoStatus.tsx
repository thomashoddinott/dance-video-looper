import { Link } from 'react-router'

/* The demo's answer to `DriveStatus`, and where it sits: under the heading
   rather than in the footer, where a visitor looks first.

   Exit demo and nothing else (#61). It says what this is and is the way out;
   a sentence about the demo was helper copy, and signing in is one step
   away, on the dashboard Exit demo leads to. */
export function DemoStatus() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Link
        to="/"
        className="rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
      >
        Exit demo
      </Link>
    </div>
  )
}
