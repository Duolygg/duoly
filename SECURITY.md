# Security

Report vulnerabilities privately to the repository owner using an existing verified channel. A dedicated security mailbox is not configured. Do not put secrets or customer data in issues.

Revoke exposed credentials immediately; removing a commit is not rotation. Preserve a sanitized incident timeline and recovery evidence.

Validate inputs and enforce identity, role and object ownership on the server. Hidden UI is not authorization. Privileged Supabase keys stay server-side. Browser-accessible tables require tested RLS policies. Realtime notifications are not authority for money or order state changes.

Production resources and credentials must be isolated from previews, local development and PR CI. Workflow/auth/migration changes need maintainer review. This foundation does not implement authentication, payments or customer persistence; feature threat models remain required before launch.
