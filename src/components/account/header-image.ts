/**
 * The header image contract, in the browser: a 3:1 strip at 1500 by 500, WebP up to 300 KB
 * (docs/product/public-profiles.md section 15).
 *
 * The teammate frames the strip with react-easy-crop, which reports the rectangle it chose in
 * source pixels; crop-image.ts paints that rectangle and encodes it. Only the sizes, the
 * messages and the quality walk are header specific, and they live here.
 */
import {
  type CropBox,
  type Encoded,
  type Picked,
  canvasDataUrl,
  cropToCanvas,
  encodeWithinLimit,
  loadPickedImage,
  pickFileError,
} from './crop-image';

export const HEADER_WIDTH = 1500;
export const HEADER_HEIGHT = 500;
export const HEADER_MAX_BYTES = 300 * 1024;
/** Starts at the 0.8 the contract asks for, then steps down for busy pictures. */
export const HEADER_QUALITY_STEPS = [0.8, 0.68, 0.56, 0.45, 0.35];
export const HEADER_MAX_PICK_BYTES = 20 * 1024 * 1024;
/** Below this there is not enough picture to fill the strip without it turning to mush. */
export const HEADER_MIN_PICK_WIDTH = HEADER_WIDTH / 5;

export type HeaderEncoded = Encoded;

/**
 * Encodes WebP at the best quality that stays inside the 300 KB limit. `encode` is the canvas
 * call, passed in so this can be checked without a browser.
 */
export function encodeHeader(
  encode: (quality: number) => string,
  steps: number[] = HEADER_QUALITY_STEPS,
  limit: number = HEADER_MAX_BYTES,
): HeaderEncoded {
  return encodeWithinLimit(encode, steps, limit);
}

/** The framed strip as the file the endpoint stores. */
export function encodeHeaderCrop(
  image: HTMLImageElement,
  box: CropBox,
): HeaderEncoded {
  const canvas = cropToCanvas(image, box, HEADER_WIDTH, HEADER_HEIGHT);
  return encodeHeader((quality) => canvasDataUrl(canvas, quality));
}

/** The plain words for a file nobody can use, before anything is decoded. */
export function headerFileError(
  file: {
    type?: string;
    size?: number;
  } | null,
): string {
  return pickFileError(file, HEADER_MAX_PICK_BYTES);
}

/** Decodes a picked file, so the crop can be framed over its real pixels. */
export function loadHeaderImage(file: Blob): Promise<Picked> {
  return loadPickedImage(
    file,
    HEADER_MIN_PICK_WIDTH,
    (width) =>
      `That picture is only ${width} pixels wide. Headers need at least ${HEADER_MIN_PICK_WIDTH} pixels across.`,
  );
}
