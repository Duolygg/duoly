import {
  AdminAccessSchema,
  type AdminAccess,
} from '../../contracts/admin-access';

export {
  ADMIN_SECTIONS,
  DEFAULT_ADMIN_SECTIONS,
  canUse,
  type AdminAccess,
  type AdminSection,
} from '../../contracts/admin-access';

/**
 * Admin permissions per dashboard section (migration 20261105130000_admin_permissions.sql).
 * Owners always have every section. The database is the real lock (every admin function checks
 * the caller's sections); this is the same rule early in the request, with a clear message.
 */
type RpcClient = {
  rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }>;
};

/** The caller's own access, or null when it can't be read (treated as no access). */
export async function adminAccess(
  client: unknown,
): Promise<AdminAccess | null> {
  const { data, error } = await (client as RpcClient).rpc('admin_me');
  if (error || !data) return null;
  const parsed = AdminAccessSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export const NO_SECTION_ACCESS =
  'You don’t have access to this part of the admin dashboard.';
