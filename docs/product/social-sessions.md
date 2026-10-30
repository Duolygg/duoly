# Social sessions

Fabian's request (2026-10-29, after epal.gg): Gamer Girl only sessions without a game. Customers book
time with a verified Gamer Girl to talk, watch something together, fall asleep on a call or sing.

## How it works

- **Social is the 16th entry in the game list** (`social` in `src/design-reference/lib/games.js`), with
  the pink heart icon `public/assets/games/social.png`. Because every page reads that list, it shows up
  in the homepage game picker, game pages, checkout, order pages, the teammate desk, admin screens,
  home stats and Discord order posts.
- **Services** (`src/design-reference/lib/catalog.js`), all per hour, all in the Gamer Girl tab:

  | Service        | What happens                                          | Price     |
  | -------------- | ----------------------------------------------------- | --------- |
  | Just Chat      | Talk about anything on voice                          | €9.99 / h |
  | Watch Together | A movie, show or stream together on Discord, on voice | €9.99 / h |
  | Sleep Call     | A calm call while the customer falls asleep           | €9.99 / h |
  | Karaoke        | Sing together or song requests on voice               | €9.99 / h |

  Bundles (3, 5, 10 hours) use Just Chat with the usual bundle discounts. The teammate gets the usual
  60%. **Sebastian approved EUR 9.99 per hour on 2026-10-30**. Existing bundle discounts and
  teammate share are unchanged.

- **Only Gamer Girls take them.** Every Social service is a Gamer Girl service (`cat: 'gg'`), so the
  existing routing applies: Gamer Girl orders only go to teammates with Gamer Girl access, and Gamer
  Girl access already covers every game. No extra approval: admins do not approve Social per game
  (`ACCESS_GAMES` leaves it out), and the apply form does not list it.
- **Region** is the customer's broad area (Europe, North America and so on), so the teammate knows
  their time zone. No rank. The "in-game name" field is the customer's Discord name.
- **Discord**: Social orders are posted like every game, in the `general` channel under a category
  named **Social**. That category and channel have to exist in the Duoly server.
- **Rules**: Terms and FAQ say Social sessions are friendly company, never dating, romantic or sexual
  services (`LEGAL_UPDATED` bumped to 29 October 2026). Everyone is 18+, as before.

## Not included

- **Wake-up calls**: every order starts right away (matched within 5 minutes or cancelled), so a call
  at a set time needs scheduled orders first.

## Deploy order

1. With pricing approved on 2026-10-30, apply `20261029130000_social_sessions.sql` (adds `social` to the
   order, checkout and queue-settings game lists, the queue-settings functions and home stats, and
   turns Social on for existing Gamer Girls).
2. Create the **Social** category with a `general` channel in Discord.
3. Merge the code.
