# Admin corrections: win/loss reports and screenshots

When a teammate lies on a win/loss report or uploads the wrong screenshots, admins fix it.
Migration: `supabase/migrations/20261105140000_admin_correct_results.sql`. Needs the Teammates or Orders
permission (docs/product/admin-permissions.md).

## Win/loss reports

**Admin → Teammates → Match reports**, open a report, **Correct result**: change wins, losses and each
game's IGNs and match link, add a reason, **Save correction**.

- Wins and losses must add up to the games played, like the teammate's own report.
- The report shows **Corrected by {admin}** with the reason; the audit log has the before and after.
- The teammate's winrate (and the performance ranking at its next run) uses the corrected numbers.

## Screenshots

In the same report, or in the **Orders** drawer of a played order, under **Screenshots**:

- **Remove** (reason required): the customer and the teammate stop seeing it. The file stays stored
  privately for disputes; admins still see it, marked Removed, and can **Show again**.
- **Add screenshots**: upload the correct ones (PNG, JPEG or WebP up to 1.5 MB, up to 5 visible per
  order). They go through the same checks and private storage as a teammate's upload and are marked
  **Added by {admin}**.

The original completion record (what the teammate submitted when finishing) is never changed. What
the customer sees is the corrected set. Every removal, restore, upload and correction is in the audit log.
