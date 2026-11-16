/** YouTube havolasidan video ID sini ajratib oladi (watch, youtu.be, embed, shorts, live) */
export function extractYoutubeId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.replace(/^(www|m)\./, '');
    let id: string | null = null;

    if (host === 'youtu.be') {
      id = url.pathname.split('/')[1] ?? null;
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        id = url.searchParams.get('v');
      } else {
        const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/);
        id = m ? m[2] : null;
      }
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export const youtubeEmbedUrl = (id: string) => `https://www.youtube.com/embed/${id}`;
export const youtubeThumbnailUrl = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

/** Faqat http / https havolalar */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
