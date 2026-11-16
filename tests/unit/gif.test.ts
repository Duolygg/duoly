import { describe, expect, it } from 'vitest';
import {
  AnimationEncoder,
  GifWriter,
  composeFrames,
  decodeFrameIndices,
  isGif,
  parseGif,
  quantize,
} from '../../src/lib/gif';
import {
  AVATAR_GIF_MAX_BYTES,
  AVATAR_GIF_STEPS,
  HEADER_GIF_MAX_BYTES,
  HEADER_GIF_STEPS,
  bytesToDataUrl,
  nextStep,
} from '../../src/components/account/animated-image';
import {
  MAX_AVATAR_GIF_BYTES,
  decodeAvatar,
} from '../../src/server/auth/avatar';
import {
  MAX_HEADER_GIF_BYTES,
  decodeHeader,
} from '../../src/server/teammates/profile-header';

/*
 * Animated GIFs through the croppers (src/lib/gif.ts): what is written reads back frame for
 * frame, and the server takes only GIFs of the sizes the croppers write.
 */

/** A w by h RGBA picture, coloured by `paint(x, y, t)`. */
function picture(
  w: number,
  h: number,
  t: number,
  paint: (x: number, y: number, t: number) => [number, number, number, number],
) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) rgba.set(paint(x, y, t), (y * w + x) * 4);
  return rgba;
}

/** A moving square over a gradient: busy enough to need many codes and several clears. */
const moving = (
  x: number,
  y: number,
  t: number,
): [number, number, number, number] =>
  x >= t * 6 && x < t * 6 + 12 && y >= 10 && y < 22
    ? [250, 20, 40, 255]
    : [(x * 4) & 255, (y * 3) & 255, ((x + y) * 2) & 255, 255];

function encode(w: number, h: number, frames: number, opaque = true) {
  const encoder = new AnimationEncoder(w, h, { opaque });
  for (let t = 0; t < frames; t++)
    encoder.add(
      picture(
        w,
        h,
        t,
        opaque
          ? moving
          : (x, _y, f) =>
              (x + f) % 4 === 0 ? [0, 0, 0, 0] : [10 * f, 200, 30, 255],
      ),
      80,
    );
  return encoder.finish();
}

/** Plays a GIF back and keeps a copy of every frame. */
const play = (bytes: Uint8Array) => {
  const gif = parseGif(bytes)!;
  // The screen buffer is reused, so each frame is copied before the next one is asked for.
  const frames: { rgba: Uint8ClampedArray; delay: number }[] = [];
  for (const f of composeFrames(gif))
    frames.push({ rgba: f.rgba.slice(), delay: f.delay });
  return { gif, frames };
};

const close = (
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  tolerance: number,
) => {
  let worst = 0;
  for (let i = 0; i < a.length; i++)
    worst = Math.max(worst, Math.abs(a[i]! - b[i]!));
  return worst <= tolerance;
};

describe('GIF writer and reader', () => {
  it('reads back a frame with few colours exactly, including LZW table resets', () => {
    const w = 300;
    const h = 200;
    const writer = new GifWriter(w, h);
    const indices = new Uint8Array(w * h);
    // Noise-like but deterministic: the table fills and clears many times.
    for (let i = 0; i < indices.length; i++)
      indices[i] = (i * 2654435761) >>> 28;
    const palette = new Uint8Array(16 * 3).map((_, i) => (i * 17) & 255);
    writer.frame({
      left: 0,
      top: 0,
      width: w,
      height: h,
      indices,
      palette,
      delay: 50,
      transparentIndex: -1,
      disposal: 1,
    });
    const bytes = writer.finish();
    expect(isGif(bytes)).toBe(true);
    const gif = parseGif(bytes)!;
    expect([gif.width, gif.height, gif.frames.length]).toEqual([w, h, 1]);
    expect(decodeFrameIndices(gif.frames[0]!)).toEqual(indices);
    expect(gif.frames[0]!.delay).toBe(50);
  });

  it('keeps an opaque animation moving, frame for frame', () => {
    const w = 96;
    const h = 40;
    const bytes = encode(w, h, 8);
    const { gif, frames } = play(bytes);
    expect(gif.frames.length).toBe(8);
    expect(frames.map((f) => f.delay)).toEqual(Array(8).fill(80));
    // The gradient has thousands of colours, so 256 of them are within a shade or two.
    for (let t = 0; t < 8; t++)
      expect(close(frames[t]!.rgba, picture(w, h, t, moving), 16)).toBe(true);
    // Later frames only carry the rectangle that moved.
    expect(gif.frames[3]!.width).toBeLessThan(w);
  });

  it('brings a GIF-sized palette through exactly', () => {
    // A real GIF has at most 256 colours a frame; those survive the round trip untouched.
    const few = (
      x: number,
      y: number,
      t: number,
    ): [number, number, number, number] => [
      ((x + t) % 16) * 16,
      (y % 8) * 32,
      ((x * y) % 2) * 255,
      255,
    ];
    const encoder = new AnimationEncoder(64, 32, { opaque: true });
    for (let t = 0; t < 5; t++) encoder.add(picture(64, 32, t, few), 60);
    const { frames } = play(encoder.finish());
    frames.forEach((frame, t) =>
      expect(close(frame.rgba, picture(64, 32, t, few), 0)).toBe(true),
    );
  });

  it('merges frames that do not change into a longer one', () => {
    const encoder = new AnimationEncoder(20, 20, { opaque: true });
    const still = picture(20, 20, 0, moving);
    encoder.add(still, 100);
    encoder.add(still, 100);
    encoder.add(picture(20, 20, 1, moving), 100);
    const { frames } = play(encoder.finish());
    expect(frames.map((f) => f.delay)).toEqual([200, 100]);
  });

  it('keeps see-through pixels see-through in every frame', () => {
    const { frames } = play(encode(16, 8, 4, false));
    frames.forEach((frame, f) => {
      for (let x = 0; x < 16; x++) {
        const alpha = frame.rgba[x * 4 + 3];
        expect(alpha).toBe((x + f) % 4 === 0 ? 0 : 255);
      }
    });
  });

  it('plays disposal: a cleared frame leaves nothing behind', () => {
    const writer = new GifWriter(4, 1);
    const palette = new Uint8Array([255, 0, 0, 0, 255, 0]);
    writer.frame({
      left: 0,
      top: 0,
      width: 4,
      height: 1,
      indices: new Uint8Array([0, 0, 0, 0]),
      palette,
      delay: 100,
      transparentIndex: -1,
      disposal: 2,
    });
    writer.frame({
      left: 1,
      top: 0,
      width: 1,
      height: 1,
      indices: new Uint8Array([1]),
      palette,
      delay: 100,
      transparentIndex: -1,
      disposal: 1,
    });
    const { frames } = play(writer.finish());
    expect([...frames[1]!.rgba]).toEqual([
      0, 0, 0, 0, 0, 255, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('times 0 and 1 hundredth frames the way browsers play them', () => {
    const writer = new GifWriter(1, 1);
    writer.frame({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      indices: new Uint8Array([0]),
      palette: new Uint8Array(6),
      delay: 100,
      transparentIndex: -1,
      disposal: 0,
    });
    const bytes = writer.finish();
    // The delay is the two bytes after "21 F9 04 <packed>".
    const at =
      bytes.findIndex((b, i) => b === 0x21 && bytes[i + 1] === 0xf9) + 4;
    bytes[at] = 0;
    expect(parseGif(bytes)!.frames[0]!.delay).toBe(100);
  });

  it('refuses what is not a GIF', () => {
    expect(parseGif(new TextEncoder().encode('RIFF....WEBPVP8 '))).toBeNull();
    expect(
      parseGif(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])),
    ).toBeNull();
  });

  it('gives a flat colour its exact shade', () => {
    const rgba = picture(4, 4, 0, () => [13, 77, 201, 255]);
    const q = quantize(rgba, () => true, 256);
    expect(q.colors).toBe(1);
    expect([...q.palette]).toEqual([13, 77, 201]);
  });
});

describe('size ladder', () => {
  it('skips rungs that cannot fit', () => {
    // Twice the limit at full size: the next rung that saves half is picked, not the next one.
    const i = nextStep(
      AVATAR_GIF_STEPS,
      0,
      AVATAR_GIF_MAX_BYTES * 2,
      AVATAR_GIF_MAX_BYTES,
    );
    const step = AVATAR_GIF_STEPS[i]!;
    expect((step.width * step.height) / step.stride ** 0.85).toBeLessThan(
      256 * 256 * 0.5,
    );
    expect(
      nextStep(AVATAR_GIF_STEPS, AVATAR_GIF_STEPS.length - 1, 1e9, 1),
    ).toBe(-1);
  });

  it('only writes sizes the server takes', () => {
    for (const s of AVATAR_GIF_STEPS)
      expect(s.width === s.height && s.width >= 128 && s.width <= 256).toBe(
        true,
      );
    for (const s of HEADER_GIF_STEPS)
      expect(
        s.width === s.height * 3 && s.height >= 200 && s.height <= 500,
      ).toBe(true);
    expect(AVATAR_GIF_MAX_BYTES).toBe(MAX_AVATAR_GIF_BYTES);
    expect(HEADER_GIF_MAX_BYTES).toBe(MAX_HEADER_GIF_BYTES);
  });
});

describe('server takes animated GIFs', () => {
  const url = (bytes: Uint8Array) => bytesToDataUrl(bytes, 'image/gif');

  it('takes a square avatar GIF and refuses other shapes', () => {
    expect(decodeAvatar(url(encode(256, 256, 3)))?.ext).toBe('gif');
    expect(decodeAvatar(url(encode(128, 128, 3)))?.type).toBe('image/gif');
    expect(decodeAvatar(url(encode(256, 200, 3)))).toBeNull();
    expect(decodeAvatar(url(encode(512, 512, 2)))).toBeNull();
    expect(decodeAvatar(url(encode(64, 64, 2)))).toBeNull();
  });

  it('takes a 3:1 header GIF and refuses other shapes', () => {
    expect(decodeHeader(url(encode(600, 200, 2)))?.ext).toBe('gif');
    expect(decodeHeader(url(encode(600, 300, 2)))).toBeNull();
    expect(decodeHeader(url(encode(1800, 600, 1)))).toBeNull();
  });

  it('never trusts the label', () => {
    const webpLabel = url(encode(256, 256, 2)).replace(
      'image/gif',
      'image/webp',
    );
    expect(decodeAvatar(webpLabel)).toBeNull();
    const fake = url(new TextEncoder().encode('GIF89a' + 'x'.repeat(100)));
    expect(decodeAvatar(fake)).toBeNull();
    expect(decodeHeader(fake)).toBeNull();
  });
});
