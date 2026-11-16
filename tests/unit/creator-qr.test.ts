import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  QR_ECC_M,
  dataCodewords,
  gfExp,
  gfLog,
  qrMatrix,
  qrPng,
  rsGenerator,
} from '../../src/server/creators/qr';

/**
 * The QR code for a creator short link is generated here, without a new dependency, so these
 * tests stand in for a scanner. They check the three things that can silently break a QR:
 * the Galois field, the data codewords before error correction, and the placement and mask,
 * which a small independent decoder reads back out of the finished matrix.
 */

describe('Reed Solomon ground truth', () => {
  it('uses the QR Galois field (primitive 0x11d)', () => {
    expect([...gfExp.slice(0, 10)]).toEqual([
      1, 2, 4, 8, 16, 32, 64, 128, 29, 58,
    ]);
    expect(gfLog[1]).toBe(0);
    expect(gfLog[29]).toBe(8);
  });
  it('builds the published generator polynomials', () => {
    // ISO/IEC 18004 annex A, written as exponents of alpha: the 10 and 16 codeword
    // generators, which versions 1-M and 2-M use.
    const exponents = (degree: number) =>
      [...rsGenerator(degree)].map((value) => gfLog[value]);
    expect(exponents(10)).toEqual([
      0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45,
    ]);
    expect(exponents(16)).toEqual([
      0, 120, 104, 107, 109, 102, 161, 76, 3, 91, 191, 147, 169, 182, 194, 225,
      120,
    ]);
  });
});

describe('data codewords', () => {
  it('encodes byte mode, the length, the terminator and the pad bytes', () => {
    // "A" in version 1-M: 0100 (byte mode), 00000001 (one byte), 01000001 ("A"),
    // 0000 (terminator), then the alternating pad bytes up to 16 codewords.
    const { version, codewords } = dataCodewords('A');
    expect(version).toBe(1);
    expect([...codewords]).toEqual([
      0x40, 0x14, 0x10, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec,
      0x11, 0xec, 0x11, 0xec,
    ]);
  });
  it('picks the smallest version that fits', () => {
    expect(dataCodewords('x'.repeat(14)).version).toBe(1);
    expect(dataCodewords('x'.repeat(15)).version).toBe(2);
    expect(dataCodewords('https://duoly.gg/alex10').version).toBe(2);
    expect(dataCodewords('x'.repeat(26)).version).toBe(2);
    expect(dataCodewords('x'.repeat(27)).version).toBe(3);
    expect(dataCodewords('x'.repeat(106)).version).toBe(6);
    expect(() => dataCodewords('x'.repeat(107))).toThrow();
  });
  it('knows the error correction table it uses', () => {
    expect(QR_ECC_M[2]).toEqual({ data: 28, ec: 16, blocks: 1 });
    expect(QR_ECC_M[4]).toEqual({ data: 64, ec: 18, blocks: 2 });
    expect(QR_ECC_M[6]).toEqual({ data: 108, ec: 16, blocks: 4 });
  });
});

/** Reads a version 2 matrix back: format bits, mask, zigzag, de-interleave, bytes. */
function decodeVersion2(modules: boolean[][]): { mask: number; text: string } {
  const size = modules.length;
  expect(size).toBe(25);
  const fn = functionModules(size);
  // Format information, first copy, bits 0 to 14 (nayuki placement), unmasked with 0x5412.
  let bits = 0;
  const read = (row: number, col: number) => (modules[row]![col] ? 1 : 0);
  for (let i = 0; i <= 5; i++) bits |= read(i, 8) << i;
  bits |= read(7, 8) << 6;
  bits |= read(8, 8) << 7;
  bits |= read(8, 7) << 8;
  for (let i = 9; i < 15; i++) bits |= read(8, 14 - i) << i;
  const format = bits ^ 0x5412;
  expect(format >> 13).toBe(0); // error correction level M
  const mask = (format >> 10) & 7;
  // Undo the mask on every data module.
  const plain = modules.map((row) => [...row]);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      if (!fn[row]![col] && maskBit(mask, row, col))
        plain[row]![col] = !plain[row]![col];
  // The zigzag, two columns at a time, right to left, alternating upward and downward.
  const stream: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (!fn[row]![col]) stream.push(plain[row]![col] ? 1 : 0);
      }
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= stream.length; i += 8)
    bytes.push(stream.slice(i, i + 8).reduce((n, bit) => (n << 1) | bit, 0));
  // Version 2-M is one block of 28 data codewords followed by its 16 check codewords.
  const data = bytes.slice(0, 28);
  const head = data
    .slice(0, 2)
    .reduce((n, byte) => (n << 8) | byte, 0)
    .toString(2)
    .padStart(16, '0');
  expect(head.slice(0, 4)).toBe('0100');
  const length = parseInt(head.slice(4, 12), 2);
  const payload: number[] = [];
  let offset = 12;
  for (let i = 0; i < length; i++) {
    const byte =
      ((data[offset >> 3]! << 8) | data[(offset >> 3) + 1]!) >>
      (8 - (offset & 7));
    payload.push(byte & 0xff);
    offset += 8;
  }
  return { mask, text: Buffer.from(payload).toString('utf8') };
}

function maskBit(mask: number, row: number, col: number): boolean {
  const x = col;
  const y = row;
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

/** Which modules of a version 2 symbol are function patterns, worked out independently. */
function functionModules(size: number): boolean[][] {
  const fn = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const block = (row: number, col: number, height: number, width: number) => {
    for (let r = row; r < row + height; r++)
      for (let c = col; c < col + width; c++)
        if (r >= 0 && r < size && c >= 0 && c < size) fn[r]![c] = true;
  };
  // Three finder patterns with their separators, and the format information around them.
  block(0, 0, 9, 9);
  block(0, size - 8, 9, 8);
  block(size - 8, 0, 8, 9);
  // Timing patterns.
  block(6, 0, 1, size);
  block(0, 6, size, 1);
  // The single alignment pattern of version 2.
  block(size - 9, size - 9, 5, 5);
  return fn;
}

describe('the finished symbol', () => {
  it('reads back as the link it encodes', () => {
    const link = 'https://duoly.gg/alex10';
    const modules = qrMatrix(link);
    const decoded = decodeVersion2(modules);
    expect(decoded.text).toBe(link);
    expect(decoded.mask).toBeGreaterThanOrEqual(0);
    expect(decoded.mask).toBeLessThanOrEqual(7);
  });
  it('keeps the three finder patterns and the dark module', () => {
    const modules = qrMatrix('https://duoly.gg/alex10');
    const size = modules.length;
    for (const [row, col] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ] as const) {
      expect(modules[row]![col]).toBe(true);
      expect(modules[row + 1]![col + 1]).toBe(false);
      expect(modules[row + 2]![col + 2]).toBe(true);
    }
    expect(modules[size - 8]![8]).toBe(true);
  });
});

describe('the PNG', () => {
  it('is a valid 8 bit greyscale PNG with the quiet zone', () => {
    const png = qrPng('https://duoly.gg/alex10', 4, 4);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.from(png.subarray(12, 16)).toString('ascii');
    expect(ihdr).toBe('IHDR');
    const width = Buffer.from(png.subarray(16, 20)).readUInt32BE(0);
    const height = Buffer.from(png.subarray(20, 24)).readUInt32BE(0);
    expect(width).toBe((25 + 8) * 4);
    expect(height).toBe(width);
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(0); // greyscale
    // The last chunk is IEND: four zero length bytes, the name, then its checksum.
    expect(
      Buffer.from(png.subarray(png.length - 12, png.length - 4)).toString(
        'ascii',
      ),
    ).toBe('    IEND');
  });
  it('paints the modules it was given, with a white border', () => {
    const scale = 3;
    const quiet = 4;
    const modules = qrMatrix('https://duoly.gg/alex10');
    const png = qrPng('https://duoly.gg/alex10', scale, quiet);
    const width = (modules.length + quiet * 2) * scale;
    // One IDAT chunk holds the whole image.
    const idat = findChunk(png, 'IDAT');
    const raw = inflateSync(Buffer.from(idat));
    expect(raw.length).toBe((width + 1) * width);
    const pixel = (row: number, col: number) =>
      raw[row * (width + 1) + 1 + col];
    expect(pixel(0, 0)).toBe(255);
    expect(pixel(width - 1, width - 1)).toBe(255);
    for (const [row, col] of [
      [0, 0],
      [6, 6],
      [modules.length - 1, modules.length - 1],
    ] as const) {
      const expected = modules[row]![col] ? 0 : 255;
      expect(pixel((row + quiet) * scale, (col + quiet) * scale)).toBe(
        expected,
      );
    }
  });
});

function findChunk(png: Uint8Array, name: string): Uint8Array {
  const buffer = Buffer.from(png);
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === name) return buffer.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
  }
  throw new Error(`no ${name} chunk`);
}
