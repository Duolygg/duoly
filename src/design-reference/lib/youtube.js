// The intro video every /apply applicant links: a YouTube video where they talk (a camera is preferred,
// voice over a still image is fine). Shared by the /apply form, the POST /api/apply contract and the
// admin Applications screen. The database (submit_teammate_application) repeats the same host check.
//
// youtubeVideoId(link) returns the 11-character video id, or '' when the link isn't a YouTube video.
// Accepted: youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…, youtube.com/live/…,
// youtube.com/embed/…, on www., m. and music. hosts, with or without https://.
const ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'];

export const YOUTUBE_LINK_MAX = 200;

export function youtubeVideoId(link) {
  const raw = String(link || '').trim();
  if (!raw || raw.length > YOUTUBE_LINK_MAX || /\s/.test(raw)) return '';
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  if (url.username || url.password || url.port) return '';
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  let id = '';
  if (host === 'youtu.be') id = parts[0] || '';
  else if (HOSTS.includes(host)) {
    if (parts[0] === 'watch' && parts.length === 1) id = url.searchParams.get('v') || '';
    else if (['shorts', 'live', 'embed'].includes(parts[0])) id = parts[1] || '';
  }
  return ID.test(id) ? id : '';
}

// The link admins open: always the plain watch page, whatever form the applicant pasted.
export function youtubeWatchUrl(link) {
  const id = youtubeVideoId(link);
  return id ? 'https://www.youtube.com/watch?v=' + id : '';
}
