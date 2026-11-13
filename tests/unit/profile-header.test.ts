import { beforeEach, expect, it, vi } from 'vitest';
import {
  decodeHeader,
  MAX_HEADER_BYTES,
  storeHeader,
  removeHeader,
} from '../../src/server/teammates/profile-header';
import { supportService } from '../../src/server/support/store';
vi.mock('../../src/server/support/store', () => ({ supportService: vi.fn() }));
export function webp(size = 64) {
  const bytes = Buffer.alloc(size);
  bytes.write('RIFF');
  bytes.write('WEBP', 8);
  return 'data:image/webp;base64,' + bytes.toString('base64');
}
it('accepts only bounded WebP data URLs with the real signature', () => {
  expect(decodeHeader(webp())?.type).toBe('image/webp');
  expect(decodeHeader(webp(MAX_HEADER_BYTES))?.bytes.length).toBe(
    MAX_HEADER_BYTES,
  );
  for (const value of [
    null,
    '',
    webp(12),
    webp(MAX_HEADER_BYTES + 1),
    webp().replace('webp;', 'jpeg;'),
    jpeg().replace('jpeg;', 'webp;'),
    'data:image/png;base64,' + Buffer.alloc(64).toString('base64'),
    'data:image/webp;base64,' + Buffer.alloc(64).toString('base64'),
  ]) {
    expect(decodeHeader(value)).toBeNull();
  }
});
export function jpeg(size = 64) {
  const bytes = Buffer.alloc(size);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return 'data:image/jpeg;base64,' + bytes.toString('base64');
}
it('accepts a real JPEG for browsers that cannot encode WebP', () => {
  const decoded = decodeHeader(jpeg());
  expect(decoded?.type).toBe('image/jpeg');
  expect(decoded?.ext).toBe('jpg');
  expect(decodeHeader(jpeg(MAX_HEADER_BYTES + 1))).toBeNull();
});
const upload = vi.fn();
const remove = vi.fn();
const single = vi.fn();
const updateSingle = vi.fn();
const bucket = {
  upload,
  remove,
  getPublicUrl: (path: string) => ({
    data: {
      publicUrl:
        'https://example.supabase.co/storage/v1/object/public/profile-headers/' +
        path,
    },
  }),
};
const previous =
  'https://example.supabase.co/storage/v1/object/public/profile-headers/9f000000-0000-4000-8000-000000000001/0123456789abcdef.webp';
const id = '9f000000-0000-4000-8000-000000000001';
beforeEach(() => {
  vi.resetAllMocks();
  single.mockResolvedValue({ data: { header_image: previous }, error: null });
  updateSingle.mockResolvedValue({ data: { user_id: id }, error: null });
  upload.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
  const query = {
    eq: () => query,
    is: () => query,
    select: () => query,
    single: updateSingle,
  };
  vi.mocked(supportService).mockReturnValue({
    storage: { from: () => bucket },
    from: () => ({
      select: () => ({ eq: () => ({ single }) }),
      update: () => query,
    }),
  } as unknown as NonNullable<ReturnType<typeof supportService>>);
});
it('replaces the database URL before removing the previous file', async () => {
  const result = await storeHeader(id, decodeHeader(webp())!);
  expect(result).toMatch(new RegExp('/' + id + '/[a-f0-9]{16}\\.webp$'));
  expect(upload).toHaveBeenCalledWith(
    expect.stringMatching(/\.webp$/),
    expect.any(Buffer),
    expect.objectContaining({ contentType: 'image/webp' }),
  );
  expect(remove).toHaveBeenCalledWith([id + '/0123456789abcdef.webp']);
  expect(updateSingle.mock.invocationCallOrder[0]).toBeLessThan(
    remove.mock.invocationCallOrder[0]!,
  );
});
it('does not remove the previous image when upload or persistence fails', async () => {
  upload.mockResolvedValueOnce({ error: new Error('upload') });
  expect(await storeHeader(id, decodeHeader(webp())!)).toBeNull();
  expect(remove).not.toHaveBeenCalled();
  updateSingle.mockResolvedValueOnce({ error: new Error('save') });
  expect(await storeHeader(id, decodeHeader(webp())!)).toBeNull();
  expect(remove).not.toHaveBeenCalled();
});
it('clears the header and deletes its storage object', async () => {
  expect(await removeHeader(id)).toBe(true);
  expect(remove).toHaveBeenCalledWith([id + '/0123456789abcdef.webp']);
});
