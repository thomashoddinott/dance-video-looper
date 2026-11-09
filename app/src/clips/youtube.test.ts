import { describe, expect, it, vi } from 'vitest'

import { lookUpYouTube, videoIdFrom } from './youtube'

const A_VIDEO = 'EuT94T544Mg'

/* #20. Every form a YouTube link arrives in from a share sheet or an address
   bar, down to the one video it names. */
describe('reading which video a link names', () => {
  it('reads a watch link', () => {
    expect(videoIdFrom(`https://www.youtube.com/watch?v=${A_VIDEO}`)).toBe(A_VIDEO)
  })

  /* The example on the ticket was shared from a playlist. Where the dancer
     found it is not which video it is. */
  it('drops the playlist a link was shared from', () => {
    expect(
      videoIdFrom(
        `https://www.youtube.com/watch?v=${A_VIDEO}&list=PL8hFYIpg2Jp1EJE3TCWMr0f_zr9WOi10j&index=12`,
      ),
    ).toBe(A_VIDEO)
  })

  it('reads a short link, share tracking and all', () => {
    expect(videoIdFrom(`https://youtu.be/${A_VIDEO}?si=abc123`)).toBe(A_VIDEO)
  })

  it('reads the phone site and a Shorts link', () => {
    expect(videoIdFrom(`https://m.youtube.com/watch?v=${A_VIDEO}`)).toBe(A_VIDEO)
    expect(videoIdFrom(`https://youtube.com/shorts/${A_VIDEO}`)).toBe(A_VIDEO)
  })

  it('takes a link pasted with spaces round it', () => {
    expect(videoIdFrom(`  https://youtu.be/${A_VIDEO}  `)).toBe(A_VIDEO)
  })

  it('reads nothing from a link that is not YouTube’s', () => {
    expect(videoIdFrom('https://vimeo.com/123456')).toBeNull()
  })

  it('reads nothing from something that is not a link', () => {
    expect(videoIdFrom('salsa class 12')).toBeNull()
  })

  it('reads nothing from a YouTube link that names no video', () => {
    expect(videoIdFrom('https://www.youtube.com/@LaSuerteDanceSchool')).toBeNull()
  })
})

const answering = (status: number, body: unknown = {}) =>
  vi.fn(async (_url: string) => ({ ok: status >= 200 && status < 300, status, json: async () => body }))

/* The title comes from YouTube's oEmbed endpoint, which is CORS-open and needs
   no key — so asking it from a static page fits the no-backend rule. */
describe('looking a video up on YouTube', () => {
  it('asks oEmbed about the video’s watch page', async () => {
    const fetch = answering(200, { title: 'Paseala' })

    await lookUpYouTube(A_VIDEO, fetch)

    expect(decodeURIComponent(String(fetch.mock.calls[0]?.[0]))).toContain(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${A_VIDEO}`,
    )
  })

  it('hands back its title', async () => {
    await expect(
      lookUpYouTube(A_VIDEO, answering(200, { title: 'Cuban Salsa for Beginners - Class 12 (Paseala)' })),
    ).resolves.toEqual({ found: true, title: 'Cuban Salsa for Beginners - Class 12 (Paseala)' })
  })

  /* A video whose uploader has turned embedding off can never play here. */
  it('says when the uploader will not let it be played outside YouTube', async () => {
    await expect(lookUpYouTube(A_VIDEO, answering(401))).resolves.toEqual({
      found: false,
      because: 'embedding-refused',
    })
  })

  it('says when there is no such video to see', async () => {
    await expect(lookUpYouTube(A_VIDEO, answering(404))).resolves.toEqual({
      found: false,
      because: 'missing',
    })
  })

  it('says when YouTube cannot be reached', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    await expect(lookUpYouTube(A_VIDEO, fetch)).resolves.toEqual({
      found: false,
      because: 'unreachable',
    })
  })
})
