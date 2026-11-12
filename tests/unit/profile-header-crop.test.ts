import { describe, expect, it } from 'vitest';
import {
  HEADER_HEIGHT,
  HEADER_MAX_BYTES,
  HEADER_QUALITY_STEPS,
  HEADER_WIDTH,
  dataUrlBytes,
  dragOffset,
  encodeHeader,
  headerCrop,
  headerFileError,
} from '../../src/components/account/header-image';

/*
 * The browser side of the header upload: the 3:1 crop the teammate positions, and the WebP the
 * endpoint will accept. The canvas calls themselves need a browser (tests/teammate-browser
 * drives those); everything that decides what gets drawn and sent is here.
 */

const base64 = (bytes: number) =>
  'data:image/webp;base64,' + 'A'.repeat(Math.ceil(bytes / 3) * 4);

describe('headerCrop', () => {
  it('keeps the full height of a picture that is wider than the strip', () => {
    const crop = headerCrop(4000, 1000);
    expect(crop).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 1000 });
  });
  it('keeps the full width of a picture that is taller than the strip', () => {
    const crop = headerCrop(1200, 900);
    expect(crop).toEqual({ sx: 0, sy: 250, sw: 1200, sh: 400 });
  });
  it('has nothing to position when the picture is already 3:1', () => {
    const crop = headerCrop(HEADER_WIDTH, HEADER_HEIGHT);
    expect(crop).toEqual({ sx: 0, sy: 0, sw: 1500, sh: 500 });
  });
  it('slides the window to the edges and no further', () => {
    expect(headerCrop(1200, 900, 0.5, 0).sy).toBe(0);
    expect(headerCrop(1200, 900, 0.5, 1).sy).toBe(500);
    expect(headerCrop(1200, 900, 0.5, 9).sy).toBe(500);
    expect(headerCrop(1200, 900, 0.5, -4).sy).toBe(0);
    expect(headerCrop(4000, 1000, 0, 0.5).sx).toBe(0);
    expect(headerCrop(4000, 1000, 1, 0.5).sx).toBe(1000);
  });
  it('centres by default and treats a broken offset as centred', () => {
    expect(headerCrop(1200, 900).sy).toBe(250);
    expect(headerCrop(1200, 900, Number.NaN, Number.NaN).sy).toBe(250);
  });
});

describe('dataUrlBytes', () => {
  it('counts the bytes a base64 payload carries, padding included', () => {
    expect(dataUrlBytes('data:image/webp;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('data:image/webp;base64,AAA=')).toBe(2);
    expect(dataUrlBytes('data:image/webp;base64,AA==')).toBe(1);
    expect(dataUrlBytes('')).toBe(0);
    expect(dataUrlBytes('not a data url')).toBe(0);
  });
});

describe('encodeHeader', () => {
  it('keeps the first quality whose file fits, starting at the 0.8 the contract asks for', () => {
    const asked: number[] = [];
    const result = encodeHeader((quality) => {
      asked.push(quality);
      return base64(120 * 1024);
    });
    expect(result).toMatchObject({ ok: true, quality: 0.8 });
    expect(asked).toEqual([0.8]);
    expect(HEADER_QUALITY_STEPS[0]).toBe(0.8);
  });
  it('steps the quality down for a picture that will not fit at 0.8', () => {
    const sizes: Record<number, number> = {
      0.8: 420 * 1024,
      0.68: 310 * 1024,
      0.56: 240 * 1024,
    };
    const result = encodeHeader((quality) => base64(sizes[quality] ?? 1024));
    expect(result).toMatchObject({ ok: true, quality: 0.56 });
    if (result.ok) expect(result.bytes).toBeLessThanOrEqual(HEADER_MAX_BYTES);
  });
  it('gives up on a picture that stays over 300 KB at every step', () => {
    expect(encodeHeader(() => base64(HEADER_MAX_BYTES + 4096))).toEqual({
      ok: false,
      reason: 'size',
    });
  });
  it('reports a browser that answers with something other than WebP', () => {
    expect(encodeHeader(() => 'data:image/png;base64,AAAA')).toEqual({
      ok: false,
      reason: 'format',
    });
  });
});

describe('headerFileError', () => {
  it('says what is wrong in plain words, and nothing when the file is usable', () => {
    expect(headerFileError({ type: 'image/jpeg', size: 2_000_000 })).toBe('');
    expect(headerFileError({ type: 'application/pdf', size: 10 })).toContain(
      'Pick a picture file',
    );
    expect(headerFileError(null)).toContain('Pick a picture file');
    expect(headerFileError({ type: 'image/png', size: 40 * 1024 * 1024 })).toBe(
      'That picture is over 20 MB. Try a smaller one.',
    );
  });
  it('writes errors without em dashes, en dashes or ampersands', () => {
    for (const file of [null, { type: 'x' }, { type: 'image/png', size: 1e9 }])
      expect(headerFileError(file)).not.toMatch(/[–—&]/);
  });
});

describe('dragOffset', () => {
  it('moves the window against the drag, so the picture follows the pointer', () => {
    /* 600 picture pixels outside the window, 2 picture pixels per preview pixel: dragging
       60 preview pixels right moves the window 120 pixels left, a fifth of the room. */
    expect(dragOffset(0.5, 60, 2, 600)).toBeCloseTo(0.3, 5);
    expect(dragOffset(0.5, -60, 2, 600)).toBeCloseTo(0.7, 5);
  });
  it('stops at the edges of the picture and ignores a strip with no room', () => {
    expect(dragOffset(0.5, 9000, 2, 600)).toBe(0);
    expect(dragOffset(0.5, -9000, 2, 600)).toBe(1);
    expect(dragOffset(0.4, 500, 2, 0)).toBe(0.4);
    expect(dragOffset(0.4, 500, 0, 600)).toBe(0.4);
  });
});
