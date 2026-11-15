import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HEADER_HEIGHT,
  HEADER_MAX_BYTES,
  HEADER_MIN_PICK_WIDTH,
  HEADER_QUALITY_STEPS,
  HEADER_WIDTH,
  encodeHeader,
  encodeHeaderCrop,
  headerFileError,
} from '../../src/components/account/header-image';
import { dataUrlBytes } from '../../src/components/account/crop-image';

/*
 * The header's own contract: the 1500 by 500 strip the teammate frames with react-easy-crop, and
 * the WebP the endpoint will accept. The generic crop and encode helpers are covered in
 * tests/unit/image-crop.test.ts; a real canvas and a real file picker are driven by
 * tests/teammate-browser/public-profile-header.spec.ts.
 */

const base64 = (bytes: number) =>
  'data:image/webp;base64,' + 'A'.repeat(Math.ceil(bytes / 3) * 4);

const image = (naturalWidth: number, naturalHeight: number) =>
  ({ naturalWidth, naturalHeight }) as unknown as HTMLImageElement;

/** A canvas that answers `reply` and keeps every drawImage call. */
function stubCanvas(
  reply: (type: string, quality: number) => string = () => base64(90 * 1024),
) {
  const drawn: number[][] = [];
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      clearRect: () => {},
      drawImage: (_image: unknown, ...numbers: number[]) =>
        void drawn.push(numbers),
    }),
    toDataURL: (type: string, quality: number) => reply(type, quality),
  };
  vi.stubGlobal('document', { createElement: () => canvas });
  return { canvas, drawn };
}

afterEach(() => vi.unstubAllGlobals());

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

describe('encodeHeaderCrop', () => {
  it('paints the framed rectangle as the 1500 by 500 strip the endpoint stores', () => {
    const { canvas, drawn } = stubCanvas(() => base64(90 * 1024));
    const result = encodeHeaderCrop(image(4000, 3000), {
      x: 240.3,
      y: 900.7,
      width: 3000,
      height: 1000,
    });
    expect([canvas.width, canvas.height]).toEqual([
      HEADER_WIDTH,
      HEADER_HEIGHT,
    ]);
    expect(drawn).toEqual([[240, 901, 3000, 1000, 0, 0, 1500, 500]]);
    expect(result).toMatchObject({ ok: true, quality: 0.8 });
    if (result.ok) {
      expect(result.url.startsWith('data:image/webp;base64,')).toBe(true);
      expect(dataUrlBytes(result.url)).toBeLessThanOrEqual(HEADER_MAX_BYTES);
    }
  });
  it('falls back to JPEG where a canvas cannot write WebP', () => {
    stubCanvas((type) =>
      type === 'image/webp'
        ? 'data:image/png;base64,AAAA'
        : 'data:image/jpeg;base64,' + 'A'.repeat(4000),
    );
    const result = encodeHeaderCrop(image(1500, 500), {
      x: 0,
      y: 0,
      width: 1500,
      height: 500,
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.url.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
  it('reports a picture that will not come down to 300 KB', () => {
    stubCanvas(() => base64(HEADER_MAX_BYTES + 8192));
    expect(
      encodeHeaderCrop(image(4000, 3000), {
        x: 0,
        y: 0,
        width: 3000,
        height: 1000,
      }),
    ).toEqual({ ok: false, reason: 'size' });
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

describe('the strip itself', () => {
  it('stays the 3:1 shape the public profile draws, with a floor on the picked file', () => {
    expect(HEADER_WIDTH / HEADER_HEIGHT).toBe(3);
    expect(HEADER_MIN_PICK_WIDTH).toBe(300);
  });
});
