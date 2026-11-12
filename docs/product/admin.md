# Admin panel

The original admin (`duoly-admin/duoly@7f0299f`, `components/admin/*` and `app/api/admin/*`) is being ported section by section. Screens keep the original UX. JSON-file storage is replaced by Supabase tables, and each admin command is one security-definer RPC that re-checks the admin role and writes its own audit row.

## Owners

`ADMIN_EMAILS` (Vercel production env, comma separated) lists the owners. On every sign-in the server mirrors that list into `account_roles.owner` through the service-only RPC `sync_account_owner`. Owners are always admin. The database refuses to change an owner's role, and an admin can't change their own. When `ADMIN_EMAILS` is unset (for example on previews), nothing is synced, so a preview never strips owners from the shared database.

## Connected sections

| Section       | Route                 | API                                         | Database                                                                 |
| ------------- | --------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| Users & roles | `/admin/users`        | `GET/POST /api/admin/users`                 | `admin_accounts`, `admin_set_role`, `admin_set_access`                   |
| Applications  | `/admin/applications` | `GET/POST /api/admin/applications`          | `admin_applications`, `admin_decide_application`                         |
| Audit log     | `/admin/audit`        | `GET /api/admin/audit`                      | `admin_audit` (rows written inside every command, newest 2000 kept)      |
| Apply form    | `/apply`              | `POST /api/apply` (CSRF, no account needed) | `submit_teammate_application` (one pending per email, 30/hour site-wide) |

Rules carried over from the original: you can't demote a teammate who is playing an order, and new teammates start with no games and priority 50. Approving an application makes the account with that email a teammate for that game. If no account exists yet, the applicant becomes a teammate as soon as they have a confirmed account with that email (trigger `on_auth_user_z_claim_application`). This is an improvement on the original, which told the admin to do it by hand. One extra rule: a customer with an open order can't be made staff until it finishes.

Emails: `application_received` on submit, `application_approved` or `application_declined` on decision (Resend, idempotent per application reference).

## Original to new

| Original                                            | New                                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `components/admin/AdminApp.jsx`                     | `src/components/admin/AdminApp.jsx` (URL sections, History API)               |
| `components/admin/Users.jsx`                        | `src/components/admin/Users.jsx`                                              |
| `components/admin/Teammates.jsx` (Applications tab) | `src/components/admin/Applications.jsx`                                       |
| `components/admin/AuditLog.jsx`                     | `src/components/admin/AuditLog.jsx`                                           |
| `lib/admin.js`, `lib/roles.js`                      | `src/server/admin/owners.ts`, migration `20261024090000_admin_foundation.sql` |
| `lib/applications.js`, `app/api/apply`              | `submit_teammate_application`, `src/server/admin/handlers.ts`                 |
| `lib/audit.js`                                      | `admin_audit_log` table                                                       |

## Not connected yet

Overview, cancel/refund/handover actions on the Live desk and Orders, Teammates roster, Customers and Settings can be built on the existing orders, payments and refund credits. Priority needs missed-order tracking. Payouts needs the payout ledger and Stripe Connect. Support and Safety need the support chat, order chat and reports backends. These sections render an honest "not connected yet" panel, never sample data.

## Tests

SQL tests run in the `sql-tests` GitHub Actions job against a disposable local database; never run them against the hosted project.

- `tests/unit/admin.test.ts`: owners, contracts and the RPC envelope.
