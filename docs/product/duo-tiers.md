# Duo tiers and teammate levels

Fabian's rules (2026-10-30). Builds on the performance ranking (`docs/product/performance-ranking.md`).

## Tiers

Every game's duo services come in tiers by service id, whatever the game calls them:

| Id     | Tier | Examples                                                              |
| ------ | ---- | --------------------------------------------------------------------- |
| `duo1` | Plus | Duo Plus, Double Up (TFT), PvP Duo (Minecraft)                        |
| `duo2` | Pro  | Duo Pro, Board Coach (TFT), Co-op Rivals (EA FC)                      |
| `duo3` | Apex | Duo Apex, FACEIT Duo (CS2), Warzone Ranked (CoD), Co-op Elite (EA FC) |

Apex Legends has no Apex tier. Gamer Girl and Social orders are not tiered.

## Teammate levels

Set per teammate by an admin in Admin → Users → Edit access → Teammate level.

| Level              | Can claim                                                                |
| ------------------ | ------------------------------------------------------------------------ |
| Standard (default) | Plus and Pro right away, Apex once it opens (below), every other service |
| Plus only          | The Plus tier only. Never Pro, Apex or any other non Gamer Girl service  |

## Apex orders

- First, only teammates ranked **TOP 1%** or **TOP 5%** in the latest performance run can claim them.
- **100 seconds** after the order goes public (the same moment it is posted in Discord), every
  Standard teammate approved for the game can claim it, on the site and through the Discord link.
- Plus only teammates never can.
- A Diamond customer's pick wins: the picked teammate gets the Apex order right away, unless they
  are Plus only (then there is no pick window and the order goes to the normal queue).
- Admin handover links give any order to anyone, as before.
- Until enough teammates are ranked (TOP 5% needs 20), nobody is TOP 1/5%, so Apex orders open
  to Standard teammates after 100 seconds.

## Where it is enforced

All in the database (migration `20261030140000_duo_tiers.sql`), through one function,
`order_tier_open_at(order, access)`: when a teammate may claim an order, or never.

- `order_eligible`: the teammate queue and accepting on the site.
- `accept_handover` and `handover_info`: the Discord bot link (admin links are not tiered).
- `order_pick_start`: Diamond picks.
- `order_expire_locked`: a teammate is only charged a missed order from the moment it opened for them.

The usual priority delay still applies on top.

## Deploy order

Apply `20261030120000_performance_ranking.sql` first, then `20261030140000_duo_tiers.sql`. Until the
level column exists, the level picker in Admin → Users stays hidden.
