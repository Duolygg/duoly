/**
 * Header image cropping and encoding, in the browser.
 *
 * Same approach as the avatar cropper in Profile.jsx (toAvatar): a canvas, drawImage and
 * toDataURL, with no library. The header is a wide strip instead of a square, so the crop is
 * the largest 3:1 rectangle inside the picture and the teammate can slide it over the part of
 * the picture they want. The endpoint takes WebP up to 300 KB
 * (docs/product/public-profiles.md section 15), so the encoder walks down a short list of
 * qualities and keeps the first file that fits.
 */
export const HEADER_WIDTH = 1500;
export const HEADER_HEIGHT = 500;
export const HEADER_MAX_BYTES = 300 * 1024;
/** Starts at the 0.8 the contract asks for, then steps down for busy pictures. */
export const HEADER_QUALITY_STEPS = [0.8, 0.68, 0.56, 0.45, 0.35];
export const HEADER_MAX_PICK_BYTES = 20 * 1024 * 1024;

export type HeaderCrop = { sx: number; sy: number; sw: number; sh: number };
export type HeaderEncoded =
  | { ok: true; url: string; bytes: number; quality: number }
  | { ok: false; reason: 'format' | 'size' };

const clampOffset = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;

/**
 * The largest 3:1 rectangle inside a picture, placed by two 0 to 1 offsets. 0.5 and 0.5 is the
 * centre crop, which is where every pick starts; dragging the preview moves it from there.
 */
export function headerCrop(
  width: number,
  height: number,
  offsetX = 0.5,
  offsetY = 0.5,
): HeaderCrop {
  const ratio = HEADER_WIDTH / HEADER_HEIGHT;
  const sw = Math.min(width, height * ratio);
  const sh = Math.min(height, width / ratio);
  return {
    sx: (width - sw) * clampOffset(offsetX),
    sy: (height - sh) * clampOffset(offsetY),
    sw,
    sh,
  };
}

/** How many bytes a base64 data URL carries, without decoding it. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

/**
 * Encodes WebP at the best quality that stays inside the limit. `encode` is the canvas call,
 * passed in so this can be checked without a browser.
 *
 * A browser that cannot write WebP answers with a PNG data URL from the same call, which the
 * endpoint would reject, so that case is reported as its own reason.
 */
export function encodeHeader(
  encode: (quality: number) => string,
  steps: number[] = HEADER_QUALITY_STEPS,
  limit: number = HEADER_MAX_BYTES,
): HeaderEncoded {
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

/** The plain words for a file nobody can use, before anything is decoded. */
export function headerFileError(
  file: {
    type?: string;
    size?: number;
  } | null,
): string {
  if (!file || !/^image\//.test(file.type || ''))
    return 'Pick a picture file, for example a JPG, a PNG or a WebP.';
  if ((file.size ?? 0) > HEADER_MAX_PICK_BYTES)
    return 'That picture is over 20 MB. Try a smaller one.';
  return '';
}

/** Decodes a picked file, so the crop can be drawn from its real pixel size. */
export function loadHeaderImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (image.naturalWidth < HEADER_WIDTH / 5)
        reject(
          new Error(
            `That picture is only ${image.naturalWidth} pixels wide. Headers need at least ${HEADER_WIDTH / 5} pixels across.`,
          ),
        );
      else resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That picture could not be opened. Try a JPG or PNG.'));
    };
    image.src = url;
  });
}

/** Paints the current crop at full size, which is also what gets encoded. */
export function drawHeader(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  offsetX: number,
  offsetY: number,
): void {
  const crop = headerCrop(
    image.naturalWidth,
    image.naturalHeight,
    offsetX,
    offsetY,
  );
  canvas.width = HEADER_WIDTH;
  canvas.height = HEADER_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, HEADER_WIDTH, HEADER_HEIGHT);
  context.drawImage(
    image,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    HEADER_WIDTH,
    HEADER_HEIGHT,
  );
}

/**
 * Where the crop lands after a drag. `movement` is how far the pointer went in preview pixels,
 * `scale` is how many picture pixels one preview pixel covers, and `room` is how much of the
 * picture sits outside the crop on that axis. Dragging right moves the picture right, so the
 * crop window itself walks left, which is why the movement is subtracted.
 *
 * Both axes share one scale: the preview is the 3:1 crop, so a pixel of it is the same slice of
 * the picture across and down.
 */
export function dragOffset(
  offset: number,
  movement: number,
  scale: number,
  room: number,
): number {
  if (!(room > 0) || !(scale > 0)) return clampOffset(offset);
  return clampOffset(offset - (movement * scale) / room);
}
