import { z } from 'zod';

/**
 * Admin permissions per dashboard section (migration 20261105130000_admin_permissions.sql).
 * Shared by the server (src/server/admin/access.ts) and the admin dashboard.
 */
export const ADMIN_SECTIONS = [
  'overview',
  'live',
  'priority',
  'performance',
  'orders',
  'payouts',
  'customers',
  'teammates',
  'creators',
  'support',
  'users',
  'safety',
  'audit',
  'settings',
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];
export const AdminSectionSchema = z.enum(ADMIN_SECTIONS);

/** What a new admin starts with; owners turn the others on per person. */
export const DEFAULT_ADMIN_SECTIONS: AdminSection[] = [
  'overview',
  'live',
  'priority',
  'performance',
  'teammates',
  'users',
  'support',
  'safety',
  'audit',
  'settings',
];

export const AdminAccessSchema = z.object({
  owner: z.boolean(),
  sections: z.array(AdminSectionSchema),
});
export type AdminAccess = z.infer<typeof AdminAccessSchema>;

/** Owners have everything; others need one of these sections. */
export function canUse(
  access: AdminAccess | null | undefined,
  sections: readonly AdminSection[],
): boolean {
  if (!access) return false;
  return access.owner || sections.some((s) => access.sections.includes(s));
}
