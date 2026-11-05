# Staying online, and going offline when AFK

How a teammate's online status behaves once they turned it on at the desk. Presence itself is in
`supabase/migrations/20261024142000_presence.sql` (heartbeat every 10 s, stale after 20 s).

## Online on every page

- The desk and every other Duoly page keep an online teammate online
  (`src/components/teammate/desk-keeper.js`, loaded by `SiteLayout.astro`). Moving between pages or
  tabs doesn't set them offline. Only the desk puts them online; other pages never do.
- Background tabs: the heartbeat runs from a small worker, so browsers slowing down hidden tabs
  doesn't push it past the 20 s timeout.
- Closing every Duoly tab sets them offline through the 20 s timeout. There is no "offline" beacon on
  leaving a page any more, because it also fired when moving to another page of the site.
- New orders: a browser notification on every page (the desk also plays its bell, other pages are
  silent), for orders that fit their games and voice setting. One notification per order across all
  open tabs. Clicking it opens the desk.

## Offline after 4 hours without activity

Migration `supabase/migrations/20261105160000_presence_afk_offline.sql`.

- Activity: clicking, typing, scrolling or moving the mouse on any Duoly page, or loading a page.
  Every heartbeat sends the latest one, and the server keeps the newest across tabs.
- After 4 hours without any activity the server switches them offline with the reason
  "No activity for 4 hours". The desk says: "You were set offline after 4 hours without any
  activity. Go online again when you’re back."
- Never while busy: while they play an order, or while a streaming booking for them waits to be
  accepted. The 4 hours start once they're free again.
- 5 minutes before: a browser notification "Still there?" (once, across tabs) and a banner on the
  desk. Any click or key press on a Duoly page keeps them online; clicking the notification counts.
- The heartbeat answer carries `afk_in`: seconds left, or null while busy or offline.
