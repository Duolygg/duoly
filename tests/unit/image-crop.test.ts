import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AVATAR_MAX_BYTES,
  AVATAR_MAX_PICK_BYTES,
  AVATAR_QUALITY_STEPS,
  AVATAR_SIZE,
  canvasDataUrl,
  clampBox,
  cropToCanvas,
  dataUrlBytes,
  encodeAvatar,
  encodeWithinLimit,
  framedImageStyle,
  pickFileError,
} from '../../src/components/account/crop-image';
import { MAX_AVATAR_BYTES } from '../../src/server/auth/avatar';

/*
 * The browser side of both croppers: the rectangle react-easy-crop reports, the canvas it is
 * painted on and the data URL the endpoints accept. The canvas here is a stand-in that records
 * what it was asked to draw; a real one is driven by tests/teammate-browser.
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
  const context = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    clearRect: () => {},
    drawImage: (_image: unknown, ...numbers: number[]) =>
      void drawn.push(numbers),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string) => (kind === '2d' ? context : null),
    toDataURL: (type: string, quality: number) => reply(type, quality),
  };
  vi.stubGlobal('document', { createElement: () => canvas });
  return { canvas, context, drawn };
}

afterEach(() => vi.unstubAllGlobals());

describe('dataUrlBytes', () => {
  it('counts the bytes a base64 payload carries, padding included', () => {
    expect(dataUrlBytes('data:image/webp;base64,AAAA')).toBe(3);
    expect(dataUrlBytes('data:image/webp;base64,AAA=')).toBe(2);
    expect(dataUrlBytes('data:image/webp;base64,AA==')).toBe(1);
    expect(dataUrlBytes('')).toBe(0);
    expect(dataUrlBytes('not a data url')).toBe(0);
  });
});

describe('clampBox', () => {
  it('rounds the reported rectangle and keeps it inside the picture', () => {
    expect(
      clampBox({ x: 10.4, y: 20.6, width: 99.5, height: 50.2 }, 400, 300),
    ).toEqual({ x: 10, y: 21, width: 100, height: 50 });
  });
  it('pulls a rectangle that runs past an edge back onto the picture', () => {
    expect(
      clampBox({ x: 380, y: 0, width: 120, height: 90 }, 400, 300),
    ).toEqual({ x: 280, y: 0, width: 120, height: 90 });
    expect(
      clampBox({ x: -20, y: -8, width: 4000, height: 9000 }, 400, 300),
    ).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });
  it('never asks for an empty rectangle', () => {
    expect(clampBox({ x: 0, y: 0, width: 0.2, height: 0 }, 400, 300)).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });
});

describe('cropToCanvas', () => {
  it('paints the chosen rectangle at the size the endpoint stores, smoothly', () => {
    const { canvas, context, drawn } = stubCanvas();
    const result = cropToCanvas(
      image(4000, 3000),
      { x: 120.2, y: 60.8, width: 1500.4, height: 500.1 },
      1500,
      500,
    );
    expect([result.width, result.height]).toEqual([1500, 500]);
    expect([canvas.width, canvas.height]).toEqual([1500, 500]);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe('high');
    expect(drawn).toEqual([[120, 61, 1500, 500, 0, 0, 1500, 500]]);
  });
  it('says so when the browser gives back no canvas to draw on', () => {
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => null }),
    });
    expect(() =>
      cropToCanvas(
        image(400, 400),
        { x: 0, y: 0, width: 400, height: 400 },
        256,
        256,
      ),
    ).toThrow('Canvas context unavailable.');
  });
});

describe('canvasDataUrl', () => {
  it('writes WebP where the canvas can, and JPEG where it cannot', () => {
    const asked: string[] = [];
    const webp = {
      toDataURL: (type: string) => {
        asked.push(type);
        return 'data:' + type + ';base64,AAAA';
      },
    } as unknown as HTMLCanvasElement;
    expect(canvasDataUrl(webp, 0.8)).toBe('data:image/webp;base64,AAAA');
    expect(asked).toEqual(['image/webp']);
    const safari = {
      toDataURL: (type: string) =>
        type === 'image/webp'
          ? 'data:image/png;base64,AAAA'
          : 'data:image/jpeg;base64,AAAA',
    } as unknown as HTMLCanvasElement;
    expect(canvasDataUrl(safari, 0.8)).toBe('data:image/jpeg;base64,AAAA');
  });
});

describe('encodeWithinLimit', () => {
  it('keeps the first quality whose file fits', () => {
    const asked: number[] = [];
    const result = encodeWithinLimit(
      (quality) => {
        asked.push(quality);
        return base64(quality > 0.6 ? 200_000 : 20_000);
      },
      [0.8, 0.6, 0.4],
      100_000,
    );
    expect(result).toMatchObject({ ok: true, quality: 0.6 });
    if (result.ok) expect(result.bytes).toBeLessThanOrEqual(100_000);
    expect(asked).toEqual([0.8, 0.6]);
  });
  it('reports a file that stays too large, and a format nobody accepts', () => {
    expect(encodeWithinLimit(() => base64(200_000), [0.8], 100_000)).toEqual({
      ok: false,
      reason: 'size',
    });
    expect(
      encodeWithinLimit(() => 'data:image/png;base64,AAAA', [0.8], 100_000),
    ).toEqual({ ok: false, reason: 'format' });
  });
});

describe('encodeAvatar', () => {
  it('writes a 256 by 256 picture from the chosen circle, within 96 KB', () => {
    const { canvas, drawn } = stubCanvas(() => base64(18 * 1024));
    const result = encodeAvatar(image(1200, 1600), {
      x: 100,
      y: 300,
      width: 900,
      height: 900,
    });
    expect([canvas.width, canvas.height]).toEqual([AVATAR_SIZE, AVATAR_SIZE]);
    expect(drawn).toEqual([[100, 300, 900, 900, 0, 0, 256, 256]]);
    expect(result).toMatchObject({
      ok: true,
      quality: AVATAR_QUALITY_STEPS[0],
    });
    if (result.ok) expect(result.bytes).toBeLessThanOrEqual(AVATAR_MAX_BYTES);
  });
  it('steps the quality down for a picture that will not fit at the first try', () => {
    stubCanvas((_type, quality) =>
      base64(quality > 0.7 ? 140 * 1024 : 60 * 1024),
    );
    const result = encodeAvatar(image(600, 600), {
      x: 0,
      y: 0,
      width: 600,
      height: 600,
    });
    expect(result).toMatchObject({ ok: true, quality: 0.62 });
  });
  it('gives up rather than sending a file the endpoint would reject', () => {
    stubCanvas(() => base64(AVATAR_MAX_BYTES + 2048));
    expect(
      encodeAvatar(image(600, 600), { x: 0, y: 0, width: 600, height: 600 }),
    ).toEqual({ ok: false, reason: 'size' });
  });
  it('holds the limit the endpoint enforces', () => {
    expect(AVATAR_MAX_BYTES).toBe(MAX_AVATAR_BYTES);
  });
});

describe('pickFileError', () => {
  it('says what is wrong in plain words, and nothing when the file is usable', () => {
    expect(
      pickFileError(
        { type: 'image/jpeg', size: 2_000_000 },
        AVATAR_MAX_PICK_BYTES,
      ),
    ).toBe('');
    expect(
      pickFileError(
        { type: 'application/pdf', size: 10 },
        AVATAR_MAX_PICK_BYTES,
      ),
    ).toContain('Pick a picture file');
    expect(pickFileError(null, AVATAR_MAX_PICK_BYTES)).toContain(
      'Pick a picture file',
    );
    expect(
      pickFileError(
        { type: 'image/png', size: 40 * 1024 * 1024 },
        AVATAR_MAX_PICK_BYTES,
      ),
    ).toBe('That picture is over 15 MB. Try a smaller one.');
  });
  it('writes errors without em dashes, en dashes or ampersands', () => {
    for (const file of [null, { type: 'x' }, { type: 'image/png', size: 1e9 }])
      expect(pickFileError(file, AVATAR_MAX_PICK_BYTES)).not.toMatch(/[–—&]/);
  });
});

describe('the preview of a frame that has not been encoded yet', () => {
  const media = { naturalWidth: 2000, naturalHeight: 1500 };
  /** Where a percentage style puts an edge, in pixels of a box this wide and this tall. */
  const place = (
    style: NonNullable<ReturnType<typeof framedImageStyle>>,
    boxWidth: number,
    boxHeight: number,
  ) => {
    const cut = (value: string) => Number(value.replace('%', '')) / 100;
    const width = cut(style.width) * boxWidth;
    const height = (width * media.naturalHeight) / media.naturalWidth;
    const shift = cut(style.transform.slice('translateY('.length, -1));
    return {
      left: cut(style.left) * boxWidth,
      top: boxHeight / 2 + shift * height,
      width,
      height,
    };
  };

  it('puts the chosen rectangle across the box and centred down it', () => {
    const box = { x: 500, y: 300, width: 800, height: 800 };
    const style = framedImageStyle(box, media)!;
    const placed = place(style, 72, 72);
    /* The rectangle is square and the box is square, so it lands on the box exactly. */
    const scale = placed.width / media.naturalWidth;
    expect(placed.left + box.x * scale).toBeCloseTo(0, 2);
    expect(placed.top + box.y * scale).toBeCloseTo(0, 2);
    expect(box.width * scale).toBeCloseTo(72, 2);
  });

  it('keeps a wide rectangle centred in a banner that is shorter than it', () => {
    const box = { x: 100, y: 200, width: 1500, height: 500 };
    const style = framedImageStyle(box, media)!;
    const placed = place(style, 300, 74);
    const scale = placed.width / media.naturalWidth;
    /* Full width, and the middle of the strip on the middle of the banner. */
    expect(box.width * scale).toBeCloseTo(300, 2);
    expect(placed.left + box.x * scale).toBeCloseTo(0, 2);
    expect(placed.top + (box.y + box.height / 2) * scale).toBeCloseTo(37, 2);
  });

  it('has nothing to say before a frame or a picture is known', () => {
    expect(framedImageStyle(null, media)).toBeNull();
    expect(
      framedImageStyle({ x: 0, y: 0, width: 10, height: 10 }, null),
    ).toBeNull();
    expect(
      framedImageStyle({ x: 0, y: 0, width: 0, height: 0 }, media),
    ).toBeNull();
  });
});
