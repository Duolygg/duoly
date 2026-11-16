/**
 * Animated GIFs through the two croppers. A canvas only holds one frame, so the still path in
 * crop-image.ts saves the first frame of a GIF and nothing else. Here every frame is played
 * (src/lib/gif.ts), the chosen rectangle is cut from each on a canvas, and a new GIF is written.
 *
 * GIFs are much bigger than a WebP still, so they get their own limits (mirrored on the server)
 * and a ladder of sizes: when the full-size file would not fit, it is written smaller, then with
 * every second frame (the dropped frame's time goes to the one before it, so the speed stays).
 *
 * Browser only: canvas and Blob.
 */
import {
  AnimationEncoder,
  composeFrames,
  isGif,
  parseGif,
  type ParsedGif,
} from '../../lib/gif';
import { type CropBox, type Encoded, clampBox } from './crop-image';

/** Mirrors MAX_AVATAR_GIF_BYTES in src/server/auth/avatar.ts. */
export const AVATAR_GIF_MAX_BYTES = 1024 * 1024;
/** Mirrors MAX_HEADER_GIF_BYTES in src/server/teammates/profile-header.ts. */
export const HEADER_GIF_MAX_BYTES = 2560 * 1024;

/** One rung of the ladder: the size written and how many source frames make one. */
export type AnimatedStep = { width: number; height: number; stride: number };

const square = (size: number, stride: number) => ({
  width: size,
  height: size,
  stride,
});
const strip = (height: number, stride: number) => ({
  width: height * 3,
  height,
  stride,
});

/** Best first. The server accepts any square from 128 to 256. */
export const AVATAR_GIF_STEPS: AnimatedStep[] = [
  square(256, 1),
  square(224, 1),
  square(192, 1),
  square(256, 2),
  square(160, 1),
  square(192, 2),
  square(128, 1),
  square(160, 2),
  square(128, 2),
  square(128, 3),
];
/** Best first. The server accepts any 3:1 strip from 600 by 200 to 1500 by 500. */
export const HEADER_GIF_STEPS: AnimatedStep[] = [
  strip(500, 1),
  strip(400, 1),
  strip(500, 2),
  strip(300, 1),
  strip(400, 2),
  strip(250, 1),
  strip(300, 2),
  strip(250, 2),
  strip(200, 2),
  strip(200, 3),
];

/** Past this many frames, every second (third, ...) frame is dropped up front. */
const MAX_FRAMES = 240;

/**
 * The GIF inside a picked file when it really moves, else null (a still GIF goes the still way).
 * The file's own bytes decide, never its label.
 */
export async function readAnimatedGif(file: Blob): Promise<ParsedGif | null> {
  const head = new Uint8Array(await file.slice(0, 6).arrayBuffer());
  if (!isGif(head)) return null;
  const gif = parseGif(new Uint8Array(await file.arrayBuffer()));
  return gif && gif.frames.length > 1 ? gif : null;
}

/** Whether any frame shows a see-through pixel inside the chosen rectangle. */
function seeThrough(gif: ParsedGif, box: CropBox): boolean {
  for (const { rgba } of composeFrames(gif))
    for (let y = box.y; y < box.y + box.height; y++)
      for (
        let x = box.x, p = (y * gif.width + x) * 4 + 3;
        x < box.x + box.width;
        x++, p += 4
      )
        if (rgba[p] === 0) return true;
  return false;
}

export function bytesToDataUrl(bytes: Uint8Array, type: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

/**
 * Which rung to try after one came out too big. `projected` is what the failed rung would have
 * weighed in full; fewer frames save a little less than their share because each remaining
 * frame changes more.
 */
export function nextStep(
  steps: AnimatedStep[],
  from: number,
  projected: number,
  limit: number,
): number {
  const failed = steps[from]!;
  for (let i = from + 1; i < steps.length; i++) {
    const step = steps[i]!;
    const estimate =
      projected *
      ((step.width * step.height) / (failed.width * failed.height)) *
      Math.pow(failed.stride / step.stride, 0.85);
    if (estimate <= limit * 0.92) return i;
  }
  return from + 1 < steps.length ? steps.length - 1 : -1;
}

export type AnimatedOptions = {
  /** 0 to 1, for a progress line. */
  onProgress?: (fraction: number) => void;
  /** True once nobody wants the result any more (the crop was closed). */
  cancelled?: () => boolean;
};

/**
 * The chosen rectangle of every frame, as a GIF inside `limit`. Yields to the page between
 * frames so the progress line can paint. `{ ok: false, reason: 'size' }` when even the smallest
 * rung is too big, `'format'` when there is no canvas or the crop was cancelled.
 */
export async function encodeAnimatedCrop(
  gif: ParsedGif,
  chosen: CropBox,
  steps: AnimatedStep[],
  limit: number,
  options: AnimatedOptions = {},
): Promise<Encoded & { animated?: true }> {
  const box = clampBox(chosen, gif.width, gif.height);
  const source = document.createElement('canvas');
  source.width = gif.width;
  source.height = gif.height;
  const sourceContext = source.getContext('2d');
  const output = document.createElement('canvas');
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!sourceContext || !context) return { ok: false, reason: 'format' };
  const opaque = !seeThrough(gif, box);
  const base = Math.ceil(gif.frames.length / MAX_FRAMES);
  const total = gif.frames.length;
  let rung = 0;
  while (rung >= 0 && rung < steps.length) {
    const step = steps[rung]!;
    const stride = step.stride * base;
    output.width = step.width;
    output.height = step.height;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const encoder = new AnimationEncoder(step.width, step.height, { opaque });
    let over = false;
    let done = 0;
    let written = 0;
    for (const { rgba, delay, index } of composeFrames(gif)) {
      if (options.cancelled?.()) return { ok: false, reason: 'format' };
      done = index + 1;
      if (index % stride) {
        encoder.extend(delay);
        continue;
      }
      sourceContext.putImageData(
        new ImageData(rgba, gif.width, gif.height),
        0,
        0,
      );
      context.clearRect(0, 0, step.width, step.height);
      context.drawImage(
        source,
        box.x,
        box.y,
        box.width,
        box.height,
        0,
        0,
        step.width,
        step.height,
      );
      encoder.add(
        context.getImageData(0, 0, step.width, step.height).data,
        delay,
      );
      options.onProgress?.(
        Math.min(0.99, (rung === 0 ? 0 : 0.1) + (done / total) * 0.9),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (encoder.size > limit) {
        over = true;
        break;
      }
    }
    if (!over) {
      const bytes = encoder.finish();
      written = bytes.length;
      if (bytes.length <= limit) {
        options.onProgress?.(1);
        return {
          ok: true,
          url: bytesToDataUrl(bytes, 'image/gif'),
          bytes: bytes.length,
          quality: 1,
          animated: true,
        };
      }
    }
    const projected = over
      ? (encoder.size * total) / Math.max(done, 1)
      : written;
    rung = nextStep(steps, rung, projected, limit);
  }
  return { ok: false, reason: 'size' };
}
