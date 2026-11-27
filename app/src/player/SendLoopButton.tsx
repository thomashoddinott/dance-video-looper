import type { ReactNode } from 'react'

/* #123. Where a loop's send has got to: nothing yet, being cut, cut and
   waiting for the tap a phone's share sheet needs, gone, or not gone. */
export type SendState = 'idle' | 'busy' | 'held' | 'sent' | 'failed'

/* What sending a loop does here: a clip from Drive goes as a file, a YouTube
   entry as a link; and from a phone, both through the share sheet. */
export type Sending = {
  readonly kind: 'file' | 'link'
  readonly phone: boolean
  readonly state: (id: string) => SendState
}

const Icon = ({ children }: { readonly children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-5 w-5"
  >
    {children}
  </svg>
)

/* An arrow down into a tray */
const DownloadGlyph = () => (
  <Icon>
    <path d="M12 4v11" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </Icon>
)

/* A link, for a YouTube entry, which can only go as one */
const LinkGlyph = () => (
  <Icon>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Icon>
)

/* An arrow up out of a box: the share sheet, ready for the tap */
const ShareGlyph = () => (
  <Icon>
    <path d="M12 15V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M5 13v6h14v-6" />
  </Icon>
)

const SpinnerGlyph = () => (
  <Icon>
    <path d="M12 3a9 9 0 1 0 9 9" className="origin-center animate-spin" />
  </Icon>
)

const SentGlyph = () => (
  <Icon>
    <path d="M5 12l5 5 9-10" />
  </Icon>
)

const FailedGlyph = () => (
  <Icon>
    <path d="M12 7v6" />
    <path d="M12 17h.01" />
  </Icon>
)

/* #123. The control beside a saved loop's ×, and the only thing on screen
   about a send: its glyph and its name say what it will do, what it is
   doing and how it went. */
export function SendLoopButton({
  name,
  sending,
  state,
  onSend,
}: {
  readonly name: string
  readonly sending: Sending
  readonly state: SendState
  readonly onSend: () => void
}) {
  const idle =
    sending.kind === 'file'
      ? { label: sending.phone ? `Share ${name}` : `Download ${name}`, glyph: <DownloadGlyph /> }
      : {
          label: sending.phone ? `Share a link to ${name}` : `Copy a link to ${name}`,
          glyph: <LinkGlyph />,
        }

  const { label, glyph } = {
    idle,
    busy: { label: `Cutting ${name}`, glyph: <SpinnerGlyph /> },
    held: { label: `Share ${name} now`, glyph: <ShareGlyph /> },
    sent: { label: `${name} sent`, glyph: <SentGlyph /> },
    failed: { label: `${name} could not be sent`, glyph: <FailedGlyph /> },
  }[state]

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={state === 'busy'}
      onClick={onSend}
      className={`shrink-0 rounded p-1.5 transition disabled:cursor-wait ${
        state === 'held'
          ? 'text-accent'
          : state === 'failed'
            ? 'text-salsa'
            : 'text-ink/40 hover:text-ink'
      }`}
    >
      {glyph}
    </button>
  )
}
