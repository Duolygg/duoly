# Order moods

Owner request 2026-11-01. At checkout the customer can pick how the session should feel. The
teammate sees it before accepting.

| Id        | Name         | Line at checkout                                |
| --------- | ------------ | ----------------------------------------------- |
| `chill`   | Chill        | Relaxed games, good vibes, zero pressure.       |
| `tryhard` | Tryhard      | Comms on, focus up, we play to win.             |
| `teach`   | Teach me     | They explain the why and drop tips as you play. |
| `fun`     | Just for fun | Banter, memes and off-meta picks.               |

- **Optional.** No pick (or tapping the picked card again) means no preference, stored as `null`.
- **Not for Social sessions.** A chat isn't a match, so the picker is hidden and the server drops a
  mood sent with a Social order.
- **Who sees it:** the teammate (queue card, accepted order, handover), admins in the Live Desk, and
  the Discord order post (`☕ Chill`, `🔥 Tryhard`, `🎓 Teach me`, `😂 Just for fun`). It is not
  added to any customer or public view.

## Where it lives

- Migration `supabase/migrations/20261101120000_order_moods.sql`:
  - `mood` on `checkout_intents` and `orders`, nullable, limited to the four ids by a check
    constraint.
  - `create_paid_order` copies the mood from the intent onto the order. Otherwise identical to the
    `20261026160000_perks.sql` version.
  - `order_teammate_dto` and `discord_order_posts_due` add `mood`. Otherwise identical to their
    current versions.
  - No grants, RLS or customer projections change.
- Server: `CheckoutRequestSchema` accepts `mood`; `buildCheckout` only puts it on the intent row
  when one was picked (`src/server/payments/checkout.ts`).
- Contracts: `ORDER_MOODS`, `MoodSchema`, optional `mood` on `TeammateOrderSchema`
  (`src/contracts/orders.ts`).
- UI: `src/components/shared/moods.jsx` (names, colours, icons, badge),
  `src/components/home/MoodPicker.jsx` (checkout), the teammate desk in
  `src/components/teammate/Teammate.jsx`, styles `mp-*`, `mood-*` and `tm-mood` in
  `src/design-reference/globals.css`.
- Discord: `moodFact` in `src/server/discord/order-posts.ts`.

## Deploy order

The migration must be live **before** the code. Until then, a customer who picks a mood would get
"Checkout is unavailable" (the intent insert names a column that does not exist yet). Customers who
pick no mood are unaffected either way.

1. Check the version is still free: `select max(version) from supabase_migrations.schema_migrations`
   on the linked project, and `ls supabase/migrations` in any other open worktree.
2. Run the rollback-only check against the linked project (it applies the migration inside a
   transaction, runs the checks, and rolls everything back):

   ```bash
   { echo 'begin;'; sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261101120000_order_moods.sql; echo 'savepoint s;'; cat supabase/tests/order_moods.sql; echo 'rollback;'; } > order_moods_check.sql
   supabase db query --linked -f order_moods_check.sql
   ```

   It should end with `order_moods: all checks passed`. Delete `order_moods_check.sql` afterwards.

3. Apply the migration with the pinned Supabase CLI, development project first, then production.
4. Regenerate the database types and compare with `src/server/auth/database.types.ts` (the `mood`
   lines were added by hand to match).
5. Deploy the code.

Old code keeps working after step 3: the new columns are nullable, the teammate DTO and the Discord
due list only gain a key, and the teammate contract accepts the key being there or missing.

## Tests

- `supabase/tests/order_moods.sql` (rollback only): mood copied onto the order, `null` without one,
  unknown moods refused by both tables, mood in the teammate DTO and the Discord due list.
- `tests/unit/order-moods.test.ts`: checkout schema and row, Social without mood, teammate contract
  and desk mapping, Discord post text, and that the three copied SQL functions differ from their
  originals only by the mood.
