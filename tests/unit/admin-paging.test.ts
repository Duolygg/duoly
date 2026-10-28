import { describe, expect, it, vi } from 'vitest';
import { allAdminPages } from '../../src/components/admin/api';

describe('admin paging', () => {
  it('loads every page without truncating records', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: { total: 3, orders: [{ id: 1 }, { id: 2 }] },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { total: 3, orders: [{ id: 3 }] },
      });
    const result = await allAdminPages(
      { get },
      '/api/admin/orders',
      'orders',
      2,
    );
    expect(result).toEqual({
      ok: true,
      data: { total: 3, orders: [{ id: 1 }, { id: 2 }, { id: 3 }] },
    });
    expect(get).toHaveBeenLastCalledWith('/api/admin/orders?limit=2&offset=2');
  });
});
