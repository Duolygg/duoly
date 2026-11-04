import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  youtubeVideoId,
  youtubeWatchUrl,
} from '../../src/design-reference/lib/youtube.js';

// The required intro video on /apply (migration 20261104140000_application_intro_video.sql).
describe('youtube intro video link', () => {
  const id = 'dQw4w9WgXcQ';
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=12s`,
    `http://m.youtube.com/watch?feature=share&v=${id}`,
    `youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?si=abc123`,
    `youtu.be/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}?feature=share`,
    `https://www.youtube.com/embed/${id}`,
    `  https://youtu.be/${id}  `,
  ])('accepts %s', (link) => {
    expect(youtubeVideoId(link)).toBe(id);
    expect(youtubeWatchUrl(link)).toBe(`https://www.youtube.com/watch?v=${id}`);
  });

  it.each([
    '',
    'not a link',
    'https://vimeo.com/123456',
    'https://www.youtube.com/',
    'https://www.youtube.com/@duoly',
    'https://www.youtube.com/watch?v=short',
    `https://www.youtube.com.evil.test/watch?v=${id}`,
    `https://evil.test/?u=https://youtu.be/${id}`,
    `https://user:pass@youtu.be/${id}`,
    `javascript:alert(1)//youtu.be/${id}`,
    `https://youtu.be/${id}` + 'x'.repeat(200),
  ])('rejects %s', (link) => {
    expect(youtubeVideoId(link)).toBe('');
    expect(youtubeWatchUrl(link)).toBe('');
  });

  it('is required by the database for new applications and shown to admins', () => {
    const sql = readFileSync(
      'supabase/migrations/20261104140000_application_intro_video.sql',
      'utf8',
    );
    expect(sql).toContain('add column video text not null default');
    expect(sql).toContain('p_services text[], p_video text');
    expect(sql).toContain("'video', p.video");
    expect(sql).toContain('Add a YouTube link to your intro video.');
  });
});
