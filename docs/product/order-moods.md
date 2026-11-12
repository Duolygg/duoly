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

Review and apply the additive migration before deploying code that inserts the mood column. Existing code remains compatible with nullable columns and additive DTO keys. Only the owner applies reviewed migrations; regenerate and compare database types afterward.

SQL tests run in the `sql-tests` GitHub Actions job against a disposable local database; never run them against the hosted project.

## Tests

- `supabase/tests/order_moods.sql` (rollback only): mood copied onto the order, `null` without one,
  unknown moods refused by both tables, mood in the teammate DTO and the Discord due list.
- `tests/unit/order-moods.test.ts`: checkout schema and row, Social without mood, teammate contract
  and desk mapping, Discord post text, and that the three copied SQL functions differ from their
  originals only by the mood.
