/**
 * Cropping and encoding for the two pictures a teammate uploads: the round profile picture and
 * the wide profile header. react-easy-crop reports the chosen rectangle in source pixels
 * (`croppedAreaPixels`); everything here turns that rectangle into the file an endpoint takes.
 *
 * Browser only: canvas, Image and object URLs. Both endpoints still take a base64 data URL in
 * JSON, so that is what the encoders return.
 *
 * The header keeps its own sizes, messages and quality steps in header-image.ts, because that
 * endpoint has a different contract (1500 by 500, up to 300 KB).
 */

/** A rectangle of the source picture, as react-easy-crop measures it. */
export type CropBox = { x: number; y: number; width: number; height: number };
export type Encoded =
  | { ok: true; url: string; bytes: number; quality: number }
  | { ok: false; reason: 'format' | 'size' };
/** A decoded pick, plus the object URL the cropper displays. Revoke it when the pick ends. */
export type Picked = { image: HTMLImageElement; url: string };

export const AVATAR_SIZE = 256;
/** Mirrors MAX_AVATAR_BYTES in src/server/auth/avatar.ts, which browser code cannot import. */
export const AVATAR_MAX_BYTES = 96 * 1024;
/** Starts where the old centre crop encoded, then steps down for a busy picture. */
export const AVATAR_QUALITY_STEPS = [0.86, 0.74, 0.62, 0.5, 0.38];
export const AVATAR_MAX_PICK_BYTES = 15 * 1024 * 1024;

/** How many bytes a base64 data URL carries, without decoding it. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/**
 * Keeps a reported rectangle inside the picture. The cropper already restricts the frame to the
 * media, but it measures in fractional CSS pixels, and a source rectangle that runs a hair past
 * the last row makes a browser sample transparent pixels along that edge.
 */
export function clampBox(
  box: CropBox,
  naturalWidth: number,
  naturalHeight: number,
): CropBox {
  const width = Math.max(1, Math.min(Math.round(box.width), naturalWidth));
  const height = Math.max(1, Math.min(Math.round(box.height), naturalHeight));
  return {
    x: Math.max(0, Math.min(Math.round(box.x), naturalWidth - width)),
    y: Math.max(0, Math.min(Math.round(box.y), naturalHeight - height)),
    width,
    height,
  };
}

/**
 * Paints the chosen rectangle at the size the endpoint stores. This is the picture that gets
 * encoded, so what the cropper frames is what gets saved.
 */
export function cropToCanvas(
  image: HTMLImageElement,
  box: CropBox,
  width: number,
  height: number,
): HTMLCanvasElement {
  const source = clampBox(box, image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context unavailable.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, width, height);
  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    width,
    height,
  );
  return canvas;
}

/**
 * WebP, or JPEG where a canvas cannot write WebP. Safari used to answer the WebP call with a
 * PNG data URL, which both endpoints reject, so the fallback is picked by what came back.
 */
export function canvasDataUrl(
  canvas: HTMLCanvasElement,
  quality: number,
): string {
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp;')
    ? webp
    : canvas.toDataURL('image/jpeg', quality);
}

/**
 * Encodes at the best quality that stays inside the limit. `encode` is the canvas call, passed
 * in so this can be checked without a browser.
 *
 * A browser that can write neither WebP nor JPEG answers with a PNG from the same call, which
 * an endpoint would reject, so that case is reported as its own reason.
 */
export function encodeWithinLimit(
  encode: (quality: number) => string,
  steps: number[],
  limit: number,
): Encoded {
  for (const quality of steps) {
    const url = encode(quality);
    if (
      typeof url !== 'string' ||
      !/^data:image\/(webp|jpeg);base64,/.test(url)
    )
      return { ok: false, reason: 'format' };
    const bytes = dataUrlBytes(url);
    if (bytes > 0 && bytes <= limit) return { ok: true, url, bytes, quality };
  }
  return { ok: false, reason: 'size' };
}

/** The 256 by 256 file /api/me/profile takes, within the 96 KB the server accepts. */
export function encodeAvatar(
  image: HTMLImageElement,
  box: CropBox,
  steps: number[] = AVATAR_QUALITY_STEPS,
  limit: number = AVATAR_MAX_BYTES,
): Encoded {
  const canvas = cropToCanvas(image, box, AVATAR_SIZE, AVATAR_SIZE);
  return encodeWithinLimit(
    (quality) => canvasDataUrl(canvas, quality),
    steps,
    limit,
  );
}

/** The plain words for a file nobody can use, before anything is decoded. */
export function pickFileError(
  file: { type?: string; size?: number } | null,
  maxBytes: number,
): string {
  if (!file || !/^image\//.test(file.type || ''))
    return 'Pick a picture file, for example a JPG, a PNG or a WebP.';
  if ((file.size ?? 0) > maxBytes)
    return `That picture is over ${Math.round(maxBytes / (1024 * 1024))} MB. Try a smaller one.`;
  return '';
}

/**
 * Decodes a picked file. The object URL stays alive for the cropper to display and is handed
 * back with the image, so the caller can revoke it when the crop ends.
 */
export function loadPickedImage(
  file: Blob,
  minWidth = 0,
  tooNarrow?: (width: number) => string,
): Promise<Picked> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth < minWidth) {
        URL.revokeObjectURL(url);
        reject(
          new Error(
            tooNarrow
              ? tooNarrow(image.naturalWidth)
              : `That picture is only ${image.naturalWidth} pixels wide. Try a larger one.`,
          ),
        );
      } else resolve({ image, url });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That picture could not be opened. Try a JPG or PNG.'));
    };
    image.src = url;
  });
}

/** Lets go of a pick's object URL. Safe to call with nothing picked. */
export function releasePicked(picked: Picked | null | undefined): void {
  if (picked?.url) URL.revokeObjectURL(picked.url);
}

/**
 * Whether a canvas can be drawn on at all. A browser that is out of memory for canvases hands
 * back no context, and the crop would upload an empty picture, so the pick is refused up front
 * with the message the upload itself would have shown.
 */
export function canvasReady(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    return false;
  }
}
