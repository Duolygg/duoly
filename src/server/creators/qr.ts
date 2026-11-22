import { deflateSync } from 'node:zlib';

/**
 * A QR code for one creator short link, as a PNG, without adding a dependency.
 *
 * Deliberately small: byte mode, error correction level M and versions 1 to 6, which covers
 * every `https://duoly.gg/<code>` link (17 characters plus a code of at most 20) with room to
 * spare. Anything longer throws, because a creator link is never longer and a silently wrong
 * symbol is worse than an error. Follows ISO/IEC 18004: mode and length, Reed Solomon check
 * codewords per block, interleaving, the function patterns, the zigzag placement, the eight
 * masks scored by the four penalty rules, and the BCH format information.
 *
 * tests/unit/creator-qr.test.ts decodes the finished matrix back into the link, which is what
 * stands in for a scanner here.
 */

/** Error correction level M: data codewords, check codewords per block, blocks. */
export const QR_ECC_M: Record<
  number,
  { data: number; ec: number; blocks: number }
> = {
  1: { data: 16, ec: 10, blocks: 1 },
  2: { data: 28, ec: 16, blocks: 1 },
  3: { data: 44, ec: 26, blocks: 1 },
  4: { data: 64, ec: 18, blocks: 2 },
  5: { data: 86, ec: 24, blocks: 2 },
  6: { data: 108, ec: 16, blocks: 4 },
};
const MAX_VERSION = 6;

// ---- the Galois field GF(256) with the QR primitive polynomial 0x11d ----------------------
export const gfExp = new Uint8Array(512);
export const gfLog = new Uint8Array(256);
{
  let value = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = value;
    gfLog[value] = i;
    value <<= 1;
    if (value > 0xff) value ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255]!;
}
const gfMul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : gfExp[gfLog[a]! + gfLog[b]!]!;

/** The generator polynomial for `degree` check codewords, highest power first. */
export function rsGenerator(degree: number): Uint8Array {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] = next[j]! ^ poly[j]!;
      next[j + 1] = next[j + 1]! ^ gfMul(poly[j]!, gfExp[i]!);
    }
    poly = next;
  }
  return Uint8Array.from(poly);
}

/** The check codewords for one block. */
export function rsEncode(data: Uint8Array, degree: number): Uint8Array {
  const generator = rsGenerator(degree);
  const remainder = new Uint8Array(degree);
  for (const byte of data) {
    const factor = byte ^ remainder[0]!;
    remainder.copyWithin(0, 1);
    remainder[degree - 1] = 0;
    for (let i = 0; i < degree; i++)
      remainder[i] = remainder[i]! ^ gfMul(generator[i + 1]!, factor);
  }
  return remainder;
}

// ---- data codewords -----------------------------------------------------------------------

/** Mode indicator, length, the bytes, the terminator and the alternating pad bytes. */
export function dataCodewords(text: string): {
  version: number;
  codewords: Uint8Array;
} {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > 255)
    throw new Error('creator QR: link too long for one 8 bit length field');
  const version = Number(
    Object.keys(QR_ECC_M).find(
      (key) => QR_ECC_M[Number(key)]!.data - 2 >= bytes.length,
    ) ?? 0,
  );
  if (!version || version > MAX_VERSION)
    throw new Error('creator QR: link too long for version 6');
  const total = QR_ECC_M[version]!.data;
  const codewords = new Uint8Array(total);
  // Byte mode (0100) and the 8 bit character count fit in the first 12 bits, so every payload
  // byte straddles two codewords by exactly half a byte.
  codewords[0] = 0x40 | (bytes.length >> 4);
  codewords[1] = (bytes.length << 4) & 0xff;
  for (let i = 0; i < bytes.length; i++) {
    codewords[i + 1] = codewords[i + 1]! | (bytes[i]! >> 4);
    codewords[i + 2] = (bytes[i]! << 4) & 0xff;
  }
  // The terminator is the low nibble that is already zero. Pad bytes fill the rest.
  for (let i = bytes.length + 2; i < total; i++)
    codewords[i] = (i - bytes.length) % 2 === 0 ? 0xec : 0x11;
  return { version, codewords };
}

/** Data blocks and check blocks interleaved, as the symbol stores them. */
function finalCodewords(version: number, data: Uint8Array): Uint8Array {
  const { ec, blocks } = QR_ECC_M[version]!;
  const short = Math.floor(data.length / blocks);
  const longBlocks = data.length % blocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let block = 0; block < blocks; block++) {
    const size = short + (block >= blocks - longBlocks ? 1 : 0);
    const slice = data.subarray(offset, offset + size);
    offset += size;
    dataBlocks.push(slice);
    ecBlocks.push(rsEncode(slice, ec));
  }
  const out: number[] = [];
  const longest = Math.max(...dataBlocks.map((block) => block.length));
  for (let i = 0; i < longest; i++)
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]!);
  for (let i = 0; i < ec; i++)
    for (const block of ecBlocks) out.push(block[i]!);
  return Uint8Array.from(out);
}

// ---- the matrix ---------------------------------------------------------------------------

const maskBit = (mask: number, row: number, col: number): boolean => {
  switch (mask) {
    case 0:
      return (col + row) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (col + row) % 3 === 0;
    case 4:
      return (Math.floor(col / 3) + Math.floor(row / 2)) % 2 === 0;
    case 5:
      return ((col * row) % 2) + ((col * row) % 3) === 0;
    case 6:
      return (((col * row) % 2) + ((col * row) % 3)) % 2 === 0;
    default:
      return (((col + row) % 2) + ((col * row) % 3)) % 2 === 0;
  }
};

type Grid = { size: number; modules: boolean[][]; fn: boolean[][] };

function emptyGrid(version: number): Grid {
  const size = version * 4 + 17;
  return {
    size,
    modules: Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    ),
    fn: Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    ),
  };
}

function drawFunctionPatterns(grid: Grid, version: number) {
  const { size, modules, fn } = grid;
  const set = (row: number, col: number, dark: boolean) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    modules[row]![col] = dark;
    fn[row]![col] = true;
  };
  const reserve = (row: number, col: number, height: number, width: number) => {
    for (let r = row; r < row + height; r++)
      for (let c = col; c < col + width; c++)
        if (r >= 0 && c >= 0 && r < size && c < size) fn[r]![c] = true;
  };
  // Timing patterns first: the finder patterns and their separators overwrite the part of them
  // that runs through the corners, which is what the standard shows.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // Finder patterns with their separators.
  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const)
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        set(top + r, left + c, ring !== 2 && ring <= 3);
      }
  // Alignment patterns: versions 2 to 6 have exactly one, opposite the top left finder.
  if (version >= 2) {
    const centres = [6, size - 7];
    for (const row of centres)
      for (const col of centres) {
        if (
          (row === 6 && col === 6) ||
          (row === 6 && col === size - 7) ||
          (row === size - 7 && col === 6)
        )
          continue;
        for (let r = -2; r <= 2; r++)
          for (let c = -2; c <= 2; c++)
            set(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
      }
  }
  // Format information areas and the always dark module.
  reserve(0, 0, 9, 9);
  reserve(0, size - 8, 9, 8);
  reserve(size - 8, 0, 8, 9);
  set(size - 8, 8, true);
}

function placeCodewords(grid: Grid, codewords: Uint8Array) {
  const { size, modules, fn } = grid;
  let bit = 0;
  const bits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (fn[row]![col] || bit >= bits) continue;
        modules[row]![col] =
          ((codewords[bit >> 3]! >> (7 - (bit & 7))) & 1) === 1;
        bit++;
      }
  }
}

/** BCH(15,5) format information for level M and one mask, as the standard defines it. */
export function formatBits(mask: number): number {
  const data = mask; // level M is 00 in the two high bits
  let remainder = data;
  for (let i = 0; i < 10; i++)
    remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537);
  return ((data << 10) | (remainder & 0x3ff)) ^ 0x5412;
}

function drawFormat(grid: Grid, mask: number) {
  const { size, modules } = grid;
  const bits = formatBits(mask);
  const bit = (index: number) => ((bits >> index) & 1) === 1;
  for (let i = 0; i <= 5; i++) modules[i]![8] = bit(i);
  modules[7]![8] = bit(6);
  modules[8]![8] = bit(7);
  modules[8]![7] = bit(8);
  for (let i = 9; i < 15; i++) modules[8]![14 - i] = bit(i);
  for (let i = 0; i < 8; i++) modules[8]![size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) modules[size - 15 + i]![8] = bit(i);
}

/** The four penalty rules (N1 = 3, N2 = 3, N3 = 40, N4 = 10). Lower is better. */
export function penalty(modules: boolean[][]): number {
  const size = modules.length;
  let score = 0;
  const lines: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    lines.push(modules[i]!);
    lines.push(modules.map((row) => row[i]!));
  }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i < size; i++) {
      if (line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
    // Finder-like 1:1:3:1:1 patterns with four light modules on either side.
    for (let i = 0; i + 11 <= size; i++) {
      const window = line.slice(i, i + 11).map((dark) => (dark ? 1 : 0));
      const pattern = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      const mirrored = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      if (
        pattern.every((value, index) => value === window[index]) ||
        mirrored.every((value, index) => value === window[index])
      )
        score += 40;
    }
  }
  for (let row = 0; row + 1 < size; row++)
    for (let col = 0; col + 1 < size; col++) {
      const first = modules[row]![col];
      if (
        first === modules[row]![col + 1] &&
        first === modules[row + 1]![col] &&
        first === modules[row + 1]![col + 1]
      )
        score += 3;
    }
  const dark = modules.flat().filter(Boolean).length;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;
  return score;
}

/** The finished module matrix, without the quiet zone. True is a dark module. */
export function qrMatrix(text: string): boolean[][] {
  const { version, codewords } = dataCodewords(text);
  const final = finalCodewords(version, codewords);
  let best: { score: number; modules: boolean[][] } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const grid = emptyGrid(version);
    drawFunctionPatterns(grid, version);
    placeCodewords(grid, final);
    for (let row = 0; row < grid.size; row++)
      for (let col = 0; col < grid.size; col++)
        if (!grid.fn[row]![col] && maskBit(mask, row, col))
          grid.modules[row]![col] = !grid.modules[row]![col];
    drawFormat(grid, mask);
    const score = penalty(grid.modules);
    if (!best || score < best.score) best = { score, modules: grid.modules };
  }
  return best!.modules;
}

// ---- the PNG -----------------------------------------------------------------------------

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, body: Uint8Array): Uint8Array {
  const name = new TextEncoder().encode(type);
  const out = new Uint8Array(body.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  out.set(name, 4);
  out.set(body, 8);
  const payload = new Uint8Array(name.length + body.length);
  payload.set(name);
  payload.set(body, name.length);
  view.setUint32(body.length + 8, crc32(payload));
  return out;
}

/** The QR code as an 8 bit greyscale PNG: `scale` pixels per module, `quiet` modules of border. */
export function qrPng(text: string, scale = 8, quiet = 4): Uint8Array {
  const modules = qrMatrix(text);
  const size = modules.length;
  const width = (size + quiet * 2) * Math.max(1, Math.trunc(scale));
  const step = Math.max(1, Math.trunc(scale));
  const raw = new Uint8Array((width + 1) * width);
  raw.fill(255);
  for (let row = 0; row < width; row++) {
    raw[row * (width + 1)] = 0; // filter type 0
    const moduleRow = Math.floor(row / step) - quiet;
    if (moduleRow < 0 || moduleRow >= size) continue;
    for (let col = 0; col < width; col++) {
      const moduleCol = Math.floor(col / step) - quiet;
      if (moduleCol < 0 || moduleCol >= size) continue;
      raw[row * (width + 1) + 1 + col] = modules[moduleRow]![moduleCol]
        ? 0
        : 255;
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, width);
  header[8] = 8; // bit depth
  header[9] = 0; // greyscale
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk('IEND', new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}
