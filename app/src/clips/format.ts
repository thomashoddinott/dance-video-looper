export const formatDuration = (seconds: number) => {
  const whole = Math.round(seconds)

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/* `added` is a calendar day, so it is read back in UTC. Formatting it in the
   viewer's own zone would slide it a day backwards anywhere west of UTC. */
export const formatAdded = (added: string) =>
  new Date(added).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
