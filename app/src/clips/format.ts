export const formatDuration = (seconds: number) => {
  const whole = Math.round(seconds)

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/* #116. To the tenth of a second an arrow-key scrub steps by. Rounded to
   tenths before it is split, so 59.97 reads 1:00.0 rather than 0:60.0. */
export const formatTenths = (seconds: number) => {
  const tenths = Math.round(seconds * 10)
  const rest = (tenths % 600) / 10

  return `${Math.floor(tenths / 600)}:${rest.toFixed(1).padStart(4, '0')}`
}

/* `added` is a calendar day, so it is read back in UTC. Formatting it in the
   viewer's own zone would slide it a day backwards anywhere west of UTC. */
export const formatAdded = (added: string) =>
  new Date(added).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
