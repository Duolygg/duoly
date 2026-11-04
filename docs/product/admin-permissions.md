# Admin permissions

Owners decide, per admin, which parts of the admin dashboard they can use.
Migration: `supabase/migrations/20261105130000_admin_permissions.sql`.

## Who is who

- **Owners**: the accounts in `ADMIN_EMAILS`. They always see everything, and only they can make
  someone admin, change an admin's role, or change what an admin can see.
- **Admins**: see only the sections an owner gave them. A new admin starts with the defaults.

## Sections

| Section            | Default for new admins | Notes                                                                                  |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------------- |
| Overview           | yes                    |                                                                                        |
| Live desk          | yes                    | Includes handing orders over and cancelling them. A refund to the card needs Orders.   |
| Priority           | yes                    |                                                                                        |
| Performance        | yes                    |                                                                                        |
| Teammates          | yes                    | Includes Applications and Match reports. Adjusting a teammate's balance needs Payouts. |
| Users and roles    | yes                    | Customers and teammates only. Never make anyone admin or change an admin.              |
| Support chat       | yes                    |                                                                                        |
| Reports and safety | yes                    | Includes chat moderation.                                                              |
| Audit log          | yes                    |                                                                                        |
| Settings           | yes                    |                                                                                        |
| Orders             | no                     |                                                                                        |
| Payouts            | no                     | Includes Stripe payouts and teammate balance adjustments.                              |
| Customers          | no                     | Includes blocks and wallet adjustments.                                                |
| Creators           | no                     | Includes creator payouts.                                                              |

Owners change them in **Users and roles**: every admin row has **Can see** with **Edit permissions**
(Defaults and Everything buttons, then Save). Changes apply on the admin's next page load and are
written to the audit log.

## How it is enforced

- The database: every admin function checks the caller's sections, so nothing can be reached
  around the dashboard.
- The server: every admin API refuses a section the admin doesn't have, before touching the database.
- The dashboard: sections an admin can't use are not in the menu. Opening one by its address goes to
  their first allowed section, and buttons that need another section (Refund, Adjust balance) are hidden.

Viewing an order's chat or proofs from an order is still possible for every admin.
