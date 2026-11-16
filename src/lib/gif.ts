/**
 * Just enough GIF to keep an animated profile picture or header moving through the crop.
 *
 * The croppers paint the chosen rectangle on a canvas, and a canvas only ever holds one frame, so
 * an animated GIF used to come out as a still of its first frame. Here the file is read frame by
 * frame (parseGif, composeFrames) and a new GIF is written from the cropped frames (GifWriter,
 * quantize). No dependencies and nothing browser specific, so the server uses the same parser to
 * check what it is about to store (src/server/auth/avatar.ts, src/server/teammates/profile-header.ts).
 *
 * Format reference: the GIF89a specification (w3.org/Graphics/GIF/spec-gif89a.txt).
 */

export type GifFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
  /** RGB triples: the frame's own table, or the file's global one. */
  palette: Uint8Array;
  /** -1 when the frame has no transparent colour. */
  transparentIndex: number;
  /** How long the frame shows, in milliseconds, as browsers play it. */
  delay: number;
  /** 0 or 1 keep the frame, 2 clears its rectangle, 3 puts back what was there before. */
  disposal: number;
  interlaced: boolean;
  minCodeSize: number;
  /** The LZW stream, sub-blocks already joined. Decoded only when a frame is composed. */
  data: Uint8Array;
};

export type ParsedGif = { width: number; height: number; frames: GifFrame[] };

/** True when the bytes start like a GIF. The label on a file is never trusted. */
export function isGif(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  );
}

/**
 * Browsers play a delay of 0 or 1 hundredths as 100 ms, so a frame is timed the way people
 * actually saw it before the upload.
 */
const playedDelay = (hundredths: number) =>
  hundredths <= 1 ? 100 : hundredths * 10;

/**
 * Reads the structure of a GIF without decoding any pixels. Null when it is not a GIF, has no
 * frame, or a block runs past the end. A file that stops after its last whole frame (no trailer,
 * which many tools write) is still read.
 */
export function parseGif(
  bytes: Uint8Array,
  maxFrames = 2000,
): ParsedGif | null {
  if (!isGif(bytes) || bytes.length < 13) return null;
  const u16 = (at: number) => bytes[at]! | (bytes[at + 1]! << 8);
  const width = u16(6);
  const height = u16(8);
  if (!width || !height) return null;
  let pos = 13;
  let global: Uint8Array = new Uint8Array(0);
  const screen = bytes[10]!;
  if (screen & 0x80) {
    const size = 3 * (1 << ((screen & 7) + 1));
    if (pos + size > bytes.length) return null;
    global = bytes.subarray(pos, pos + size);
    pos += size;
  }
  /** Joins sub-blocks from `pos`; null when they run past the end. */
  const blocks = (): Uint8Array | null => {
    let total = 0;
    let at = pos;
    while (true) {
      if (at >= bytes.length) return null;
      const n = bytes[at]!;
      if (n === 0) break;
      total += n;
      at += n + 1;
    }
    const out = new Uint8Array(total);
    let o = 0;
    while (bytes[pos] !== 0) {
      const n = bytes[pos]!;
      out.set(bytes.subarray(pos + 1, pos + 1 + n), o);
      o += n;
      pos += n + 1;
    }
    pos++;
    return out;
  };
  const frames: GifFrame[] = [];
  let control = { delay: 100, disposal: 0, transparentIndex: -1 };
  while (pos < bytes.length && frames.length < maxFrames) {
    const kind = bytes[pos++];
    if (kind === 0x3b) break;
    if (kind === 0x21) {
      const label = bytes[pos++];
      if (label === 0xf9 && bytes[pos] === 4 && pos + 6 <= bytes.length) {
        const packed = bytes[pos + 1]!;
        control = {
          disposal: (packed >> 2) & 7,
          delay: playedDelay(u16(pos + 2)),
          transparentIndex: packed & 1 ? bytes[pos + 4]! : -1,
        };
        pos += 5;
      }
      if (!blocks()) return frames.length ? { width, height, frames } : null;
      continue;
    }
    if (kind !== 0x2c) break;
    if (pos + 9 > bytes.length) break;
    const left = u16(pos);
    const top = u16(pos + 2);
    const w = u16(pos + 4);
    const h = u16(pos + 6);
    const packed = bytes[pos + 8]!;
    pos += 9;
    let palette = global;
    if (packed & 0x80) {
      const size = 3 * (1 << ((packed & 7) + 1));
      if (pos + size > bytes.length) break;
      palette = bytes.subarray(pos, pos + size);
      pos += size;
    }
    const minCodeSize = bytes[pos++];
    const data = blocks();
    if (
      !data ||
      minCodeSize === undefined ||
      minCodeSize < 2 ||
      minCodeSize > 11
    )
      break;
    if (w && h && palette.length)
      frames.push({
        left,
        top,
        width: w,
        height: h,
        palette,
        interlaced: Boolean(packed & 0x40),
        minCodeSize,
        data,
        ...control,
      });
    control = { delay: 100, disposal: 0, transparentIndex: -1 };
  }
  return frames.length ? { width, height, frames } : null;
}

/** One frame's colour indices, top row first. A short stream leaves the rest at index 0. */
export function decodeFrameIndices(frame: GifFrame): Uint8Array {
  const count = frame.width * frame.height;
  const out = new Uint8Array(count);
  const data = frame.data;
  const clear = 1 << frame.minCodeSize;
  const end = clear + 1;
  const prefix = new Int16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) {
    prefix[i] = -1;
    suffix[i] = i;
  }
  let size = frame.minCodeSize + 1;
  let mask = (1 << size) - 1;
  let avail = clear + 2;
  let old = -1;
  let first = 0;
  let datum = 0;
  let bits = 0;
  let at = 0;
  let o = 0;
  while (o < count) {
    while (bits < size) {
      if (at >= data.length) return deinterlace(frame, out);
      datum |= data[at++]! << bits;
      bits += 8;
    }
    let code = datum & mask;
    datum >>>= size;
    bits -= size;
    if (code === clear) {
      size = frame.minCodeSize + 1;
      mask = (1 << size) - 1;
      avail = clear + 2;
      old = -1;
      continue;
    }
    if (code === end || code > avail) break;
    if (old === -1) {
      if (code >= clear) break;
      out[o++] = code;
      old = first = code;
      continue;
    }
    const incoming = code;
    let sp = 0;
    if (code === avail) {
      stack[sp++] = first;
      code = old;
    }
    while (code >= clear) {
      stack[sp++] = suffix[code]!;
      code = prefix[code]!;
    }
    first = suffix[code]!;
    stack[sp++] = first;
    if (avail < 4096) {
      prefix[avail] = old;
      suffix[avail] = first;
      avail++;
      if ((avail & mask) === 0 && avail < 4096) {
        size++;
        mask = (1 << size) - 1;
      }
    }
    old = incoming;
    while (sp > 0 && o < count) out[o++] = stack[--sp]!;
  }
  return deinterlace(frame, out);
}

/** Interlaced frames store rows in four passes; this puts them back in order. */
function deinterlace(frame: GifFrame, rows: Uint8Array): Uint8Array {
  if (!frame.interlaced) return rows;
  const { width, height } = frame;
  const out = new Uint8Array(rows.length);
  let src = 0;
  for (const [start, step] of [
    [0, 8],
    [4, 8],
    [2, 4],
    [1, 2],
  ] as const)
    for (let y = start; y < height; y += step, src++)
      out.set(rows.subarray(src * width, src * width + width), y * width);
  return out;
}

/**
 * Plays the GIF onto one RGBA screen and hands over each finished picture with how long it
 * shows. The same buffer is reused, so read it before asking for the next frame.
 */
export function* composeFrames(gif: ParsedGif): Generator<{
  rgba: Uint8ClampedArray<ArrayBuffer>;
  delay: number;
  index: number;
}> {
  const { width, height } = gif;
  const screen = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < gif.frames.length; index++) {
    const frame = gif.frames[index]!;
    const saved = frame.disposal === 3 ? screen.slice() : null;
    const pixels = decodeFrameIndices(frame);
    const { palette, transparentIndex } = frame;
    const right = Math.min(width, frame.left + frame.width);
    const bottom = Math.min(height, frame.top + frame.height);
    for (let y = frame.top; y < bottom; y++) {
      let src = (y - frame.top) * frame.width;
      let dst = (y * width + frame.left) * 4;
      for (let x = frame.left; x < right; x++, src++, dst += 4) {
        const c = pixels[src]!;
        if (c === transparentIndex || c * 3 + 2 >= palette.length) continue;
        screen[dst] = palette[c * 3]!;
        screen[dst + 1] = palette[c * 3 + 1]!;
        screen[dst + 2] = palette[c * 3 + 2]!;
        screen[dst + 3] = 255;
      }
    }
    yield { rgba: screen, delay: frame.delay, index };
    if (frame.disposal === 2)
      for (let y = frame.top; y < bottom; y++)
        screen.fill(0, (y * width + frame.left) * 4, (y * width + right) * 4);
    else if (saved) screen.set(saved);
  }
}

/** A palette for some pixels and, for each 15 bit colour key, the entry it maps to. */
export type Quantized = {
  palette: Uint8Array;
  lookup: Uint8Array;
  colors: number;
};

/** The 15 bit key of an RGB colour: five bits a channel. */
export const colorKey = (r: number, g: number, b: number) =>
  ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/**
 * Median cut over a five-bit-per-channel histogram. `include(i)` says whether pixel i is drawn
 * at all; the rest are left to the transparent index. Every palette entry is the average of the
 * real colours that fell in its box, so flat areas keep their exact shade.
 */
export function quantize(
  rgba: Uint8ClampedArray,
  include: (pixel: number) => boolean,
  maxColors: number,
): Quantized {
  const count = new Uint32Array(32768);
  const sums = new Float64Array(32768 * 3);
  const pixels = rgba.length / 4;
  for (let i = 0; i < pixels; i++) {
    if (!include(i)) continue;
    const p = i * 4;
    const key = colorKey(rgba[p]!, rgba[p + 1]!, rgba[p + 2]!);
    count[key]!++;
    sums[key * 3] = sums[key * 3]! + rgba[p]!;
    sums[key * 3 + 1] = sums[key * 3 + 1]! + rgba[p + 1]!;
    sums[key * 3 + 2] = sums[key * 3 + 2]! + rgba[p + 2]!;
  }
  let used = 0;
  for (let k = 0; k < 32768; k++) if (count[k]) used++;
  const keys = new Int32Array(used);
  const scratch = new Int32Array(used);
  for (let k = 0, i = 0; k < 32768; k++) if (count[k]) keys[i++] = k;
  const channel = (k: number, c: number) => (k >> (10 - 5 * c)) & 31;
  type Box = {
    start: number;
    end: number;
    pixels: number;
    range: number;
    axis: number;
  };
  const measure = (start: number, end: number): Box => {
    const lo = [31, 31, 31];
    const hi = [0, 0, 0];
    let total = 0;
    for (let i = start; i < end; i++) {
      const k = keys[i]!;
      total += count[k]!;
      for (let c = 0; c < 3; c++) {
        const v = channel(k, c);
        if (v < lo[c]!) lo[c] = v;
        if (v > hi[c]!) hi[c] = v;
      }
    }
    const spans = [hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!];
    const axis = spans.indexOf(Math.max(...spans));
    return { start, end, pixels: total, range: spans[axis]!, axis };
  };
  const boxes: Box[] = keys.length ? [measure(0, keys.length)] : [];
  while (boxes.length < maxColors) {
    let pick = -1;
    let best = 0;
    boxes.forEach((box, i) => {
      const score = box.range * box.pixels;
      if (box.end - box.start > 1 && score > best) {
        best = score;
        pick = i;
      }
    });
    if (pick < 0) break;
    const box = boxes[pick]!;
    // A channel has 32 values, so a counting sort orders the box in one pass.
    const starts = new Int32Array(33);
    for (let i = box.start; i < box.end; i++)
      starts[channel(keys[i]!, box.axis) + 1]!++;
    for (let v = 1; v <= 32; v++) starts[v] = starts[v]! + starts[v - 1]!;
    for (let i = box.start; i < box.end; i++) {
      const k = keys[i]!;
      scratch[starts[channel(k, box.axis)]!++] = k;
    }
    keys.set(scratch.subarray(0, box.end - box.start), box.start);
    let seen = 0;
    let cut = box.start + 1;
    for (let i = box.start; i < box.end - 1; i++) {
      seen += count[keys[i]!]!;
      cut = i + 1;
      if (seen * 2 >= box.pixels) break;
    }
    boxes.splice(pick, 1, measure(box.start, cut), measure(cut, box.end));
  }
  const palette = new Uint8Array(Math.max(boxes.length, 1) * 3);
  const lookup = new Uint8Array(32768);
  boxes.forEach((box, index) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = box.start; i < box.end; i++) {
      const k = keys[i]!;
      r += sums[k * 3]!;
      g += sums[k * 3 + 1]!;
      b += sums[k * 3 + 2]!;
      lookup[k] = index;
    }
    palette[index * 3] = Math.round(r / box.pixels);
    palette[index * 3 + 1] = Math.round(g / box.pixels);
    palette[index * 3 + 2] = Math.round(b / box.pixels);
  });
  // A box's average can sit far from a rare colour at its edge. Such a colour (more than about
  // eight steps a channel off) goes to the entry that is really nearest; the rest keep their
  // box and skip the search.
  const colors = boxes.length;
  for (let n = 0; n < keys.length; n++) {
    const k = keys[n]!;
    const r = sums[k * 3]! / count[k]!;
    const g = sums[k * 3 + 1]! / count[k]!;
    const b = sums[k * 3 + 2]! / count[k]!;
    let best = lookup[k]!;
    let dr = palette[best * 3]! - r;
    let dg = palette[best * 3 + 1]! - g;
    let db = palette[best * 3 + 2]! - b;
    let bestDistance = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (bestDistance <= 576) continue;
    for (let i = 0, p = 0; i < colors; i++, p += 3) {
      dr = palette[p]! - r;
      dg = palette[p + 1]! - g;
      db = palette[p + 2]! - b;
      const distance = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    lookup[k] = best;
  }
  return { palette, lookup, colors: boxes.length };
}

/** A growing byte buffer. */
class Bytes {
  buffer = new Uint8Array(1 << 16);
  length = 0;
  reserve(n: number) {
    if (this.length + n <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  }
  byte(value: number) {
    this.reserve(1);
    this.buffer[this.length++] = value;
  }
  u16(value: number) {
    this.byte(value & 255);
    this.byte((value >> 8) & 255);
  }
  bytes(values: ArrayLike<number>) {
    this.reserve(values.length);
    this.buffer.set(values, this.length);
    this.length += values.length;
  }
  ascii(text: string) {
    for (let i = 0; i < text.length; i++) this.byte(text.charCodeAt(i));
  }
}

/**
 * Variable-length LZW, the GIF flavour, with the open-addressing table every GIF encoder since
 * compress(1) has used: clearing 5003 slots is cheap where a full trie would not be.
 */
function lzw(indices: Uint8Array, minCodeSize: number, out: Bytes) {
  out.byte(minCodeSize);
  const HSIZE = 5003;
  const htab = new Int32Array(HSIZE).fill(-1);
  const codetab = new Int32Array(HSIZE);
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let size = minCodeSize + 1;
  let maxcode = (1 << size) - 1;
  let free = clear + 2;
  let clearing = false;
  let acc = 0;
  let nbits = 0;
  const block = new Uint8Array(255);
  let blen = 0;
  const flushBlock = () => {
    if (!blen) return;
    out.byte(blen);
    out.bytes(block.subarray(0, blen));
    blen = 0;
  };
  const emit = (code: number) => {
    acc |= code << nbits;
    nbits += size;
    while (nbits >= 8) {
      block[blen++] = acc & 255;
      acc >>>= 8;
      nbits -= 8;
      if (blen === 255) flushBlock();
    }
    if (clearing) {
      size = minCodeSize + 1;
      maxcode = (1 << size) - 1;
      clearing = false;
    } else if (free > maxcode) {
      size++;
      maxcode = size === 12 ? 4096 : (1 << size) - 1;
    }
  };
  emit(clear);
  let ent = indices[0]!;
  outer: for (let i = 1; i < indices.length; i++) {
    const c = indices[i]!;
    const fcode = (c << 12) + ent;
    let h = (c << 4) ^ ent;
    if (htab[h] === fcode) {
      ent = codetab[h]!;
      continue;
    }
    if (htab[h]! >= 0) {
      const disp = h === 0 ? 1 : HSIZE - h;
      do {
        h -= disp;
        if (h < 0) h += HSIZE;
        if (htab[h] === fcode) {
          ent = codetab[h]!;
          continue outer;
        }
      } while (htab[h]! >= 0);
    }
    emit(ent);
    ent = c;
    if (free < 4096) {
      codetab[h] = free++;
      htab[h] = fcode;
    } else {
      htab.fill(-1);
      free = clear + 2;
      clearing = true;
      emit(clear);
    }
  }
  emit(ent);
  emit(eoi);
  if (nbits > 0) {
    block[blen++] = acc & 255;
    if (blen === 255) flushBlock();
  }
  flushBlock();
  out.byte(0);
}

/**
 * Turns a run of same-size RGBA pictures into a small GIF.
 *
 * Opaque animations only send what changed: a pixel within `tolerance` of the colour it was
 * last written with stays transparent, so the viewer keeps showing it, and each frame is cut to
 * the rectangle that changed. Measuring against the last written colour, not the previous
 * frame, keeps a slow fade from drifting further than the tolerance. A frame with no change
 * just lengthens the one before it.
 *
 * Animations with see-through pixels cannot work that way (a pixel cannot go from drawn back to
 * clear while keeping the rest), so every frame is sent whole and cleared after it shows.
 */
export class AnimationEncoder {
  private writer: GifWriter;
  private pending: WrittenFrame | null = null;
  private ref: Uint8ClampedArray | null = null;
  frames = 0;
  constructor(
    readonly width: number,
    readonly height: number,
    private options: { opaque: boolean; tolerance?: number },
  ) {
    this.writer = new GifWriter(width, height);
  }
  /** Bytes written so far; the frame still waiting for its full delay is not counted. */
  get size() {
    return this.writer.size;
  }
  add(rgba: Uint8ClampedArray, delay: number) {
    const { width, height } = this;
    const pixels = width * height;
    const tolerance = this.options.tolerance ?? 6;
    let left = 0;
    let top = 0;
    let right = width - 1;
    let bottom = height - 1;
    let include: (i: number) => boolean;
    if (!this.options.opaque) {
      include = (i) => rgba[i * 4 + 3]! >= 128;
    } else if (!this.ref) {
      this.ref = new Uint8ClampedArray(rgba);
      include = () => true;
    } else {
      const ref = this.ref;
      const keep = new Uint8Array(pixels);
      left = width;
      top = height;
      right = -1;
      bottom = -1;
      for (let i = 0, p = 0; i < pixels; i++, p += 4) {
        if (
          Math.abs(rgba[p]! - ref[p]!) <= tolerance &&
          Math.abs(rgba[p + 1]! - ref[p + 1]!) <= tolerance &&
          Math.abs(rgba[p + 2]! - ref[p + 2]!) <= tolerance
        ) {
          keep[i] = 1;
          continue;
        }
        ref[p] = rgba[p]!;
        ref[p + 1] = rgba[p + 1]!;
        ref[p + 2] = rgba[p + 2]!;
        const x = i % width;
        const y = (i - x) / width;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
      if (right < 0) {
        if (this.pending) this.pending.delay += delay;
        return;
      }
      include = (i) => !keep[i];
    }
    const w = right - left + 1;
    const h = bottom - top + 1;
    // Does the written rectangle leave any pixel to the frames before it?
    let holes = false;
    for (let y = top; y <= bottom && !holes; y++)
      for (let x = left; x <= right; x++)
        if (!include(y * width + x)) {
          holes = true;
          break;
        }
    const q = quantize(rgba, include, holes ? 255 : 256);
    const transparentIndex = holes ? q.colors : -1;
    const palette = new Uint8Array((q.colors + (holes ? 1 : 0)) * 3);
    palette.set(q.palette.subarray(0, q.colors * 3));
    const indices = new Uint8Array(w * h);
    for (let y = 0, o = 0; y < h; y++)
      for (let x = 0; x < w; x++, o++) {
        const i = (top + y) * width + left + x;
        if (!include(i)) {
          indices[o] = transparentIndex;
          continue;
        }
        const p = i * 4;
        indices[o] = q.lookup[colorKey(rgba[p]!, rgba[p + 1]!, rgba[p + 2]!)]!;
      }
    if (this.pending) this.writer.frame(this.pending);
    this.pending = {
      left,
      top,
      width: w,
      height: h,
      indices,
      palette,
      delay,
      transparentIndex,
      disposal: this.options.opaque ? 1 : 2,
    };
    this.frames++;
  }
  /** Lengthens the last frame, for frames dropped to save space. */
  extend(delay: number) {
    if (this.pending) this.pending.delay += delay;
  }
  finish(): Uint8Array {
    if (this.pending) this.writer.frame(this.pending);
    this.pending = null;
    return this.writer.finish();
  }
}

export type WrittenFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
  indices: Uint8Array;
  /** RGB triples, at most 256 entries. */
  palette: Uint8Array;
  delay: number;
  transparentIndex: number;
  disposal: number;
};

/** Writes a looping GIF89a, one frame at a time, each with its own colour table. */
export class GifWriter {
  private out = new Bytes();
  private done = false;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    const out = this.out;
    out.ascii('GIF89a');
    out.u16(width);
    out.u16(height);
    out.byte(0);
    out.byte(0);
    out.byte(0);
    // NETSCAPE2.0: loop forever.
    out.bytes([0x21, 0xff, 0x0b]);
    out.ascii('NETSCAPE2.0');
    out.bytes([3, 1, 0, 0, 0]);
  }
  /** Bytes written so far, so a caller can stop a file that is already too big. */
  get size() {
    return this.out.length;
  }
  frame(frame: WrittenFrame) {
    const out = this.out;
    const colors = Math.max(2, frame.palette.length / 3);
    let bits = 1;
    while (1 << bits < colors) bits++;
    const transparent = frame.transparentIndex >= 0;
    out.bytes([
      0x21,
      0xf9,
      4,
      ((frame.disposal & 7) << 2) | (transparent ? 1 : 0),
    ]);
    out.u16(Math.max(2, Math.round(frame.delay / 10)));
    out.byte(transparent ? frame.transparentIndex : 0);
    out.byte(0);
    out.byte(0x2c);
    out.u16(frame.left);
    out.u16(frame.top);
    out.u16(frame.width);
    out.u16(frame.height);
    out.byte(0x80 | (bits - 1));
    const table = new Uint8Array(3 * (1 << bits));
    table.set(frame.palette.subarray(0, table.length));
    out.bytes(table);
    lzw(frame.indices, Math.max(2, bits), out);
  }
  finish(): Uint8Array {
    if (!this.done) this.out.byte(0x3b);
    this.done = true;
    return this.out.buffer.slice(0, this.out.length);
  }
}
