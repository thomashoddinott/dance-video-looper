import { useRef } from 'react'

import { formatDuration } from '../clips/format'
import type { Bar, Group } from './loopFinder'
import { timeAt } from './loopRange'

const percent = (seconds: number, duration: number) =>
  duration > 0 ? (seconds / duration) * 100 : 0

const TIME = 'absolute -translate-x-1/2 text-sm tabular-nums text-ink/70'

/* #121. The Loop Finder's bars, on the slider in place of A and B once its 8
   count is found. Every loop is drawn grey and the one being tried in the
   finder's colour, with its lead-in and run-on shaded behind it. The line
   between two bars joins them into one loop, and splits them again.

   A tap on the track between the bars still moves the playhead, as it does on
   the slider; the bars and the lines take their own taps first. */
export function BarLane({
  duration,
  time,
  bars,
  groups,
  joins,
  trying,
  onTry,
  onJoin,
  onSeek,
}: {
  readonly duration: number
  readonly time: number
  readonly bars: readonly Bar[]
  readonly groups: readonly Group[]
  /* k for the line between bar k and bar k + 1 */
  readonly joins: readonly number[]
  /* The first bar of the loop being tried, or null */
  readonly trying: number | null
  readonly onTry: (group: Group) => void
  readonly onJoin: (k: number) => void
  readonly onSeek: (seconds: number) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const active = groups.find((group) => group.first === trying) ?? null
  const at = (seconds: number) => `${percent(seconds, duration)}%`

  return (
    <div className="relative h-24 select-none">
      {active && (
        <>
          <span className={`${TIME} top-1`} style={{ left: at(active.a) }}>
            {formatDuration(active.a)}
          </span>
          <span className={`${TIME} bottom-1`} style={{ left: at(active.b) }}>
            {formatDuration(active.b)}
          </span>
        </>
      )}
      <div
        ref={track}
        className="absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 cursor-pointer rounded-md bg-control/60"
        onPointerDown={(event) =>
          onSeek(
            timeAt({
              clientX: event.clientX,
              track: track.current?.getBoundingClientRect() ?? { left: 0, width: 0 },
              duration,
            }),
          )
        }
      >
        {active && (
          <div
            className="absolute inset-y-0 rounded-md bg-finder/25"
            style={{ left: at(active.a), width: at(active.b - active.a) }}
          />
        )}
        {groups.map((group) => (
          <button
            key={group.first}
            type="button"
            aria-label={group.name}
            aria-pressed={group === active}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onTry(group)}
            className={`absolute inset-y-1.5 overflow-hidden rounded text-[10px] font-semibold tabular-nums ${
              group === active
                ? 'bg-finder text-white'
                : 'bg-ink/20 text-ink/60 hover:bg-finder/40'
            }`}
            style={{
              left: `calc(${at(group.start)} + 1px)`,
              width: `calc(${at(group.end - group.start)} - 2px)`,
            }}
          >
            {group.label}
          </button>
        ))}
        {bars.slice(1).map((bar, k) => {
          const joined = joins.includes(k)

          return (
            <button
              key={bar.start}
              type="button"
              aria-label={`${joined ? 'Split' : 'Join'} bars ${k + 1} and ${k + 2}`}
              aria-pressed={joined}
              title={joined ? 'Split' : 'Join'}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onJoin(k)}
              className="group absolute -inset-y-1.5 z-10 flex w-3 -translate-x-1/2 cursor-pointer justify-center"
              style={{ left: at(bar.start) }}
            >
              {/* Joined, the line keeps only its ends, so a label across it reads */}
              {joined ? (
                <span className="flex h-full flex-col justify-between py-1.5">
                  <span className="block h-1.5 w-0.5 rounded bg-white/80 group-hover:bg-ink/60" />
                  <span className="block h-1.5 w-0.5 rounded bg-white/80 group-hover:bg-ink/60" />
                </span>
              ) : (
                <span className="block h-full w-0.5 rounded group-hover:bg-ink/60" />
              )}
            </button>
          )
        })}
        <div
          className="pointer-events-none absolute -inset-y-1 z-20 w-0.5 -translate-x-1/2 rounded bg-ink/80"
          style={{ left: at(time) }}
        />
      </div>
    </div>
  )
}
