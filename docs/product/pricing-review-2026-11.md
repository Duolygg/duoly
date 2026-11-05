# Pricing review, November 2026

Proposal to replace the catalog prices in `src/design-reference/lib/catalog.js`. Nothing is changed in code yet.

## Sources

- tapin.gg prices read from their public homepage on 2026-11-05 (USD, logged out, NA, 1 unit).
- Our USD figures use what checkout charges: ECB EUR→USD 1.1267 (2026-11-04) + our 1% = **1.138**.
- Average lengths include queue, champ select / agent select and lobby time, not only the match itself.

## What was wrong

1. **Prices ignore how long a game lasts.** Duo Pro was €5.99–8.99 per game in every game, so a 7-minute Rocket League match cost more than a 35-minute League game (€7.99 vs €5.99). Per hour that was ~€68/h for Rocket League, ~€28/h for Pokémon Unite, ~€24/h for Overwatch / Marvel Rivals, against ~€10/h for League.
2. **We were more expensive than tapin on the main products.** League Duo Pro +37%, Valorant top tier +85%, Marvel Rivals top tier +151%, coaching +14–31%. We were only cheaper on side modes nobody compares.
3. **Rocket League per game makes no sense.** At ~7 minutes a game, a fair price would be about €1 a game. It's moved to **per hour** like Fortnite.

## Method

- **tapin sells the same thing:** about 15% under tapin (10–20%), rounded to .49 / .99.
- **tapin doesn't sell it:** average length × an hourly rate, with the rates set from tapin's own implied hourly prices minus about 15%:

| Tier            | €/hour                            | Used for                               |
| --------------- | --------------------------------- | -------------------------------------- |
| Casual / social | ~5–6                              | Quick play, arcade, unrated, casual BR |
| Duo Plus        | ~6                                | Lowest duo tier                        |
| Duo Pro         | ~7.5                              | Main "Most picked" tier                |
| Duo Apex        | ~10.5                             | Top-rank teammate                      |
| Gamer Girl      | ~8 casual / ~9 ranked             |                                        |
| Coaching        | ~12 in-game, €9.99–14.99 per hour | Market-dependent                       |

- **Minimum price €1.99.** Below that the rank ladder (×0.8 for the lowest ranks) can push an order to €0.99, where the teammate's $0.99 minimum payout is more than we take in.
- Social modes are kept under the ranked duo price of the same game.
- Rank ladders (`lib/ranks.js`) unchanged. They already match tapin's: flat at low ranks, more at the top (tapin: Marvel Rivals Diamond ×1.1 → One Above All ×2.0; Valorant Immortal ×1.12, Radiant ×1.5).
- Quantity discounts unchanged (3 = −10%, 5 = −15%, 10 = −25%). tapin's bundles are only about 3% / 8% / 10% off, so ours make bundles clearly cheaper. For example, League 3 / 5 / 10 games come to $12.26 / $19.30 / $34.06, against tapin's $14.99 / $23.99 / $44.99, which is 18–24% less.
- The Teams tab is left alone: checkout refuses Teams services (`parseQuoteInput`). Price them per seat when the tab comes back.
- Social (Just Chat and the rest, €9.99/h = $11.37) stays as it is: already 19% under tapin's Hangout at $13.99/h.

## Applied

Applied to `src/design-reference/lib/catalog.js` on 2026-11-05, with the changes below.

### Raised again the same day (owner: "still too cheap", up to tapin's price)

The "New" prices in the full table below were then raised. **The catalog is the current source, not this table.**

- Every bookable service up about **30%** from the "New" column, rounded to the nearest .49 / .99.
- **Never above tapin:** where +30% would pass tapin's price, the price stops at the highest .49 / .99 at or under it, and never drops below the "New" price.
- **Every price ends in .49 or .99.** Play & Learn always ends in .99, so its half-price first session ends in .49.
- **Tiers keep their order:** Duo Plus stays under Duo Pro, Duo Pro under Duo Apex, Gamer Girl Duo under Gamer Girl Ranked, and casual modes under Duo Pro where they were before.
- Teams tab unchanged (off at checkout).
- tapin's price keeps these where they were: League Duo Plus / Duo Pro (€3.49 / €3.99: €4.49 would be $5.11, over tapin's $4.99), the League, Valorant and CS2 Gamer Girl modes, Valorant Skirmish (€1.99). Examples that went up: Valorant Duo Pro €4.99 → €6.49, CS2 Duo Pro €4.99 → €5.99, League Duo Apex €5.49 → €6.49, Fortnite Duo Pro €9.99 → €12.99/h, Social (Just Chat and the rest) €9.99 → €12.99/h, coaching €12.99 → €14.99–17.49/h.
- Services tapin also sells are now **0% to 34% under tapin, about 9% under on average**. None is above.

## Things to decide

- **Teammate pay drops with the prices** (60% at the mid rate). League Duo Pro goes from $4.05 to $2.70 a game, about $4.60/h. If that's too little to keep Master+ teammates, raise the teammate share instead of the customer price.
- **Valorant and Marvel Rivals drop a lot** (−44% to −68%). They were simply far above the market. tapin sells Marvel Rivals at $4.99 a game for its top tier.
- **Rocket League switches to per hour.** Descriptions need to say "an hour of …".
- Valorant Skirmish stays **per game** at €1.99 (tapin: $6.99 for three, $2.33 a game). A set of three per unit would break the per-game match reports.
- Rocket League duos left the win/loss list (migration 20261105170000_rocket_league_hourly.sql): hourly orders get no match reports, like the other hourly games.

## Result

The 56 services tapin also sells are now **4% to 48% under tapin, 21% under on average**. Before, many were above.

## Full table

Rocket League: "Now" is per game and "New" is per hour (~8 games), so its Change column compares a game with an hour.

### lol

| Service           | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ----------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus          | duo      | 35 min     | 4.49 ($5.11)   | **3.49** ($3.97)   | -22%   | 4.99    | +2% → -20%         | DuoX (Diamond 4+)            |
| Duo Pro           | duo      | 35 min     | 5.99 ($6.82)   | **3.99** ($4.54)   | -33%   | 4.99    | +37% → -9%         | Duo (Master+)                |
| Duo Apex          | duo      | 35 min     | 8.99 ($10.23)  | **5.49** ($6.25)   | -39%   | 7.5     | +36% → -17%        | Duo Ultra (GM+)              |
| Arena Partner     | duo      | 20 min     | 3.49 ($3.97)   | **3.49** ($3.97)   | 0%     | 5.99    | -34% → -34%        | Arena                        |
| Ranked 5s         | Teams    |            | 8.99 ($10.23)  | unchanged          |        |         |                    | Teams tab is off at checkout |
| Flex Squad        | Teams    |            | 7.99 ($9.09)   | unchanged          |        |         |                    | Teams tab is off at checkout |
| Clash Roster      | Teams    |            | 9.99 ($11.37)  | unchanged          |        |         |                    | Teams tab is off at checkout |
| Swiftplay         | social   | 22 min     | 2.99 ($3.40)   | **2.99** ($3.40)   | 0%     | —       | —                  | casual, kept under ranked    |
| ARAM Night        | social   | 22 min     | 2.99 ($3.40)   | **2.99** ($3.40)   | 0%     | 4.99    | -32% → -32%        | ARAM                         |
| Normal Draft      | social   | 35 min     | 3.49 ($3.97)   | **3.49** ($3.97)   | 0%     | 5.99    | -34% → -34%        | Duo Normal                   |
| Gamer Girl Duo    | gg       | 25 min     | 4.99 ($5.68)   | **4.99** ($5.68)   | 0%     | 6.49    | -12% → -12%        | Gamer Girl                   |
| Gamer Girl Ranked | gg       | 35 min     | 5.99 ($6.82)   | **5.49** ($6.25)   | -8%    | 6.49    | +5% → -4%          | Gamer Girl                   |
| Play & Learn      | training | 45 min     | 12.99 ($14.78) | **9.99** ($11.37)  | -23%   | 12.99   | +14% → -12%        | Coach (45 min)               |
| VOD Review        | training | 60 min     | 14.99 ($17.06) | **12.99** ($14.78) | -13%   | 17.32   | -2% → -15%         | Coach $12.99/45 min          |
| Champion Mastery  | training | 60 min     | 14.99 ($17.06) | **12.99** ($14.78) | -13%   | 17.32   | -2% → -15%         | Coach $12.99/45 min          |

### val

| Service            | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                          |
| ------------------ | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ------------------------------ |
| Duo Plus           | duo      | 42 min     | 5.99 ($6.82)   | **3.99** ($4.54)   | -33%   | 7.99    | -15% → -43%        | below Radiant Duo Ultra        |
| Duo Pro            | duo      | 42 min     | 8.99 ($10.23)  | **4.99** ($5.68)   | -44%   | 7.99    | +28% → -29%        | below Radiant Duo Ultra        |
| Duo Apex           | duo      | 42 min     | 12.99 ($14.78) | **5.99** ($6.82)   | -54%   | 7.99    | +85% → -15%        | Duo Ultra (Radiant)            |
| Skirmish 2v2       | duo      | 10 min     | 5.49 ($6.25)   | **1.99** ($2.26)   | -64%   | 2.33    | +168% → -3%        | 2v2 Skirmish $6.99 for 3 games |
| Stack Fill         | Teams    |            | 7.49 ($8.52)   | unchanged          |        |         |                    | Teams tab is off at checkout   |
| Premier Roster     | Teams    |            | 8.99 ($10.23)  | unchanged          |        |         |                    | Teams tab is off at checkout   |
| Swiftplay          | social   | 18 min     | 3.99 ($4.54)   | **2.99** ($3.40)   | -25%   | —       | —                  | 18 min × €7.5/h                |
| Unrated            | social   | 42 min     | 4.49 ($5.11)   | **3.49** ($3.97)   | -22%   | —       | —                  | casual, kept under ranked      |
| Deathmatch Warm-Up | social   | 12 min     | 2.99 ($3.40)   | **1.99** ($2.26)   | -33%   | —       | —                  | minimum price                  |
| Gamer Girl Duo     | gg       | 25 min     | 6.99 ($7.95)   | **4.99** ($5.68)   | -29%   | 6.49    | +22% → -12%        | Gamer Girl                     |
| Gamer Girl Ranked  | gg       | 42 min     | 7.99 ($9.09)   | **5.49** ($6.25)   | -31%   | 6.49    | +40% → -4%         | Gamer Girl                     |
| Play & Learn       | training | 50 min     | 14.99 ($17.06) | **9.99** ($11.37)  | -33%   | 12.99   | +31% → -12%        | Coaching (per game)            |
| VOD Review         | training | 60 min     | 17.99 ($20.47) | **12.99** ($14.78) | -28%   | 17.32   | +18% → -15%        | Coaching ≈$17/h                |
| Aim & Crosshair    | training | 60 min     | 17.99 ($20.47) | **12.99** ($14.78) | -28%   | 17.32   | +18% → -15%        | Coaching ≈$17/h                |

### cs2

| Service             | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ------------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus            | duo      | 45 min     | 5.99 ($6.82)   | **4.49** ($5.11)   | -25%   | 6.99    | -2% → -27%         | below Duo Premier            |
| Duo Pro             | duo      | 45 min     | 8.99 ($10.23)  | **4.99** ($5.68)   | -44%   | 6.99    | +46% → -19%        | Duo Premier                  |
| FACEIT Duo          | duo      | 45 min     | 12.99 ($14.78) | **6.49** ($7.39)   | -50%   | 8.99    | +64% → -18%        | Duo FACEIT                   |
| Wingman Duo         | duo      | 25 min     | 6.99 ($7.95)   | **3.99** ($4.54)   | -43%   | —       | —                  | 25 min × €9/h (GE)           |
| 5-Stack Premier     | Teams    |            | 7.99 ($9.09)   | unchanged          |        |         |                    | Teams tab is off at checkout |
| FACEIT Stack        | Teams    |            | 9.49 ($10.80)  | unchanged          |        |         |                    | Teams tab is off at checkout |
| Casual & Deathmatch | social   | 20 min     | 3.99 ($4.54)   | **2.49** ($2.83)   | -38%   | 4.99    | -9% → -43%         | Duo Casual                   |
| Retake Servers      | social   | 20 min     | 3.49 ($3.97)   | **2.49** ($2.83)   | -29%   | —       | —                  | same as casual               |
| Gamer Girl Duo      | gg       | 25 min     | 7.49 ($8.52)   | **4.99** ($5.68)   | -33%   | 6.49    | +31% → -12%        | Gamer Girl                   |
| Gamer Girl Ranked   | gg       | 45 min     | 7.99 ($9.09)   | **5.49** ($6.25)   | -31%   | 6.49    | +40% → -4%         | Gamer Girl                   |
| Play & Learn        | training | 50 min     | 14.99 ($17.06) | **10.99** ($12.51) | -27%   | 14.99   | +14% → -17%        | Coach (per game)             |
| Demo Review         | training | 60 min     | 17.99 ($20.47) | **14.99** ($17.06) | -17%   | 19.99   | +2% → -15%         | Coach $14.99/game ≈45 min    |
| Utility & Lineups   | training | 60 min     | 17.99 ($20.47) | **14.99** ($17.06) | -17%   | 19.99   | +2% → -15%         | Coach $14.99/game ≈45 min    |

### fn

| Service             | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ------------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus            | duo      | 60 min     | 9.99 ($11.37)  | **7.99** ($9.09)   | -20%   | —       | —                  | below Duo Ultra              |
| Duo Pro             | duo      | 60 min     | 12.99 ($14.78) | **9.99** ($11.37)  | -23%   | —       | —                  | below Duo Ultra              |
| Duo Apex            | duo      | 60 min     | 14.99 ($17.06) | **11.99** ($13.64) | -20%   | 15.99   | +7% → -15%         | Duo Ultra $11.99/45 min      |
| Tournament Teammate | Teams    |            | 19.99 ($22.75) | unchanged          |        |         |                    | Teams tab is off at checkout |
| Squad Fill          | Teams    |            | 14.99 ($17.06) | unchanged          |        |         |                    | Teams tab is off at checkout |
| Zero Build          | social   | 60 min     | 7.99 ($9.09)   | **6.49** ($7.39)   | -19%   | —       | —                  | casual rate                  |
| Reload              | social   | 60 min     | 7.99 ($9.09)   | **6.49** ($7.39)   | -19%   | —       | —                  | casual rate                  |
| Creative Box Fights | social   | 60 min     | 7.49 ($8.52)   | **6.99** ($7.95)   | -7%    | —       | —                  | casual, Unreal               |
| Gamer Girl Duo      | gg       | 60 min     | 9.49 ($10.80)  | **8.99** ($10.23)  | -5%    | 12.98   | -17% → -21%        | Gamer Girl $6.49/30 min      |
| Gamer Girl Ranked   | gg       | 60 min     | 11.99 ($13.64) | **9.99** ($11.37)  | -17%   | 12.98   | +5% → -12%         | Gamer Girl $6.49/30 min      |
| Play & Learn        | training | 60 min     | 16.99 ($19.33) | **12.99** ($14.78) | -24%   | 17.32   | +12% → -15%        | Coach $12.99/45 min          |
| Build & Edit Course | training | 60 min     | 16.99 ($19.33) | **12.99** ($14.78) | -24%   | 17.32   | +12% → -15%        | Coach $12.99/45 min          |

### cod

| Service             | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ------------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus            | duo      | 60 min     | 10.99 ($12.51) | **7.99** ($9.09)   | -27%   | —       | —                  | like Fortnite Plus           |
| Duo Pro             | duo      | 60 min     | 11.99 ($13.64) | **8.99** ($10.23)  | -25%   | —       | —                  | between Plus and Apex        |
| Warzone Ranked      | duo      | 60 min     | 13.99 ($15.92) | **11.99** ($13.64) | -14%   | —       | —                  | like Fortnite top tier       |
| Rebirth Duo         | duo      | 60 min     | 10.99 ($12.51) | **7.99** ($9.09)   | -27%   | —       | —                  | like Plus                    |
| Warzone Quad Fill   | Teams    |            | 14.99 ($17.06) | unchanged          |        |         |                    | Teams tab is off at checkout |
| Ranked 4-Stack      | Teams    |            | 13.99 ($15.92) | unchanged          |        |         |                    | Teams tab is off at checkout |
| Zombies Run         | social   | 60 min     | 8.99 ($10.23)  | **6.99** ($7.95)   | -22%   | —       | —                  | casual, specialist           |
| Party Modes         | social   | 60 min     | 7.99 ($9.09)   | **5.99** ($6.82)   | -25%   | —       | —                  | casual rate                  |
| Gamer Girl Duo      | gg       | 60 min     | 9.99 ($11.37)  | **8.99** ($10.23)  | -10%   | —       | —                  | standard hourly GG           |
| Gamer Girl Ranked   | gg       | 60 min     | 12.49 ($14.21) | **9.99** ($11.37)  | -20%   | —       | —                  | standard hourly GG           |
| Play & Learn        | training | 60 min     | 16.99 ($19.33) | **12.99** ($14.78) | -24%   | —       | —                  | standard coaching            |
| Loadouts & Movement | training | 60 min     | 15.99 ($18.20) | **12.99** ($14.78) | -19%   | —       | —                  | standard coaching            |

### apex

| Service                | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                              |
| ---------------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------------- |
| Duo Plus               | duo      | 60 min     | 9.99 ($11.37)  | **8.99** ($10.23)  | -10%   | —       | —                  | below Duo Ultra                    |
| Duo Pro                | duo      | 60 min     | 12.99 ($14.78) | **11.99** ($13.64) | -8%    | 15.99   | -8% → -15%         | Duo Ultra (Predator) $11.99/45 min |
| Duos Playlist          | duo      | 60 min     | 9.99 ($11.37)  | **8.99** ($10.23)  | -10%   | 11.99   | -5% → -15%         | Duo Wildcard $8.99/45 min          |
| Full Trio              | Teams    |            | 17.99 ($20.47) | unchanged          |        |         |                    | Teams tab is off at checkout       |
| Mixtape                | social   | 60 min     | 7.49 ($8.52)   | **5.99** ($6.82)   | -20%   | —       | —                  | casual rate                        |
| Pubs & Legend Practice | social   | 60 min     | 7.99 ($9.09)   | **6.49** ($7.39)   | -19%   | —       | —                  | casual rate                        |
| Gamer Girl Duo         | gg       | 60 min     | 9.49 ($10.80)  | **8.99** ($10.23)  | -5%    | —       | —                  | standard hourly GG                 |
| Gamer Girl Ranked      | gg       | 60 min     | 11.99 ($13.64) | **9.99** ($11.37)  | -17%   | —       | —                  | standard hourly GG                 |
| Play & Learn           | training | 60 min     | 16.99 ($19.33) | **12.99** ($14.78) | -24%   | 17.32   | +12% → -15%        | Coach $12.99/45 min                |
| Movement Course        | training | 60 min     | 15.99 ($18.20) | **12.99** ($14.78) | -19%   | 17.32   | +5% → -15%         | Coach $12.99/45 min                |

### r6

| Service             | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ------------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus            | duo      | 30 min     | 5.49 ($6.25)   | **2.99** ($3.40)   | -46%   | —       | —                  | 30 min × €6/h                |
| Duo Pro             | duo      | 30 min     | 8.49 ($9.66)   | **3.99** ($4.54)   | -53%   | —       | —                  | 30 min × €7.5/h              |
| Duo Apex            | duo      | 30 min     | 11.99 ($13.64) | **5.49** ($6.25)   | -54%   | —       | —                  | 30 min × €10.5/h             |
| 5-Stack Fill        | Teams    |            | 6.49 ($7.39)   | unchanged          |        |         |                    | Teams tab is off at checkout |
| Quick Match         | social   | 18 min     | 3.99 ($4.54)   | **1.99** ($2.26)   | -50%   | —       | —                  | minimum price                |
| Arcade & Deathmatch | social   | 12 min     | 3.49 ($3.97)   | **1.99** ($2.26)   | -43%   | —       | —                  | minimum price                |
| Gamer Girl Duo      | gg       | 18 min     | 6.49 ($7.39)   | **2.49** ($2.83)   | -62%   | —       | —                  | 18 min × €8/h                |
| Gamer Girl Ranked   | gg       | 30 min     | 7.49 ($8.52)   | **4.49** ($5.11)   | -40%   | —       | —                  | 30 min × €9/h                |
| Play & Learn        | training | 40 min     | 13.99 ($15.92) | **7.99** ($9.09)   | -43%   | —       | —                  | 40 min × €12/h               |
| Operator Lab        | training | 60 min     | 16.99 ($19.33) | **12.99** ($14.78) | -24%   | —       | —                  | standard coaching            |
| Map & Callouts      | training | 60 min     | 15.99 ($18.20) | **12.99** ($14.78) | -19%   | —       | —                  | standard coaching            |

### mr

| Service              | Tab      | Avg length | Now € ($)      | New € ($)         | Change | tapin $ | vs tapin now → new | Basis                        |
| -------------------- | -------- | ---------- | -------------- | ----------------- | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus             | duo      | 20 min     | 4.99 ($5.68)   | **2.49** ($2.83)  | -50%   | 4.99    | +14% → -43%        | below Duo Ultra              |
| Duo Pro              | duo      | 20 min     | 7.99 ($9.09)   | **2.99** ($3.40)  | -63%   | 4.99    | +82% → -32%        | below Duo Ultra              |
| Duo Apex             | duo      | 20 min     | 10.99 ($12.51) | **3.49** ($3.97)  | -68%   | 4.99    | +151% → -20%       | Duo Ultra (top tier)         |
| Team-Up Duo          | duo      | 20 min     | 5.49 ($6.25)   | **2.99** ($3.40)  | -46%   | —       | —                  | same as Duo Pro              |
| 6-Stack Fill         | Teams    |            | 5.99 ($6.82)   | unchanged         |        |         |                    | Teams tab is off at checkout |
| Quick Match & Arcade | social   | 15 min     | 3.49 ($3.97)   | **1.99** ($2.26)  | -43%   | —       | —                  | minimum price                |
| Gamer Girl Duo       | gg       | 15 min     | 6.49 ($7.39)   | **2.99** ($3.40)  | -54%   | 6.49    | +14% → -48%        | Gamer Girl                   |
| Gamer Girl Ranked    | gg       | 20 min     | 6.99 ($7.95)   | **3.49** ($3.97)  | -50%   | 6.49    | +22% → -39%        | Gamer Girl                   |
| Play & Learn         | training | 30 min     | 12.99 ($14.78) | **5.99** ($6.82)  | -54%   | 9.99    | +48% → -32%        | Coach $9.99/45 min           |
| Hero Coaching        | training | 60 min     | 15.99 ($18.20) | **9.99** ($11.37) | -38%   | 13.32   | +37% → -15%        | Coach $9.99/45 min           |

### ow

| Service             | Tab      | Avg length | Now € ($)      | New € ($)         | Change | tapin $ | vs tapin now → new | Basis                        |
| ------------------- | -------- | ---------- | -------------- | ----------------- | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus            | duo      | 20 min     | 4.99 ($5.68)   | **2.49** ($2.83)  | -50%   | —       | —                  | same as Marvel Rivals        |
| Duo Pro             | duo      | 20 min     | 7.99 ($9.09)   | **2.99** ($3.40)  | -63%   | —       | —                  | same as Marvel Rivals        |
| Duo Apex            | duo      | 20 min     | 10.99 ($12.51) | **3.49** ($3.97)  | -68%   | —       | —                  | same as Marvel Rivals        |
| Stadium Duo         | duo      | 30 min     | 5.49 ($6.25)   | **3.99** ($4.54)  | -27%   | —       | —                  | 30 min × €7.5/h              |
| 5-Stack Role Queue  | Teams    |            | 5.99 ($6.82)   | unchanged         |        |         |                    | Teams tab is off at checkout |
| Quick Play & Arcade | social   | 15 min     | 3.49 ($3.97)   | **1.99** ($2.26)  | -43%   | —       | —                  | minimum price                |
| Gamer Girl Duo      | gg       | 15 min     | 6.49 ($7.39)   | **2.99** ($3.40)  | -54%   | —       | —                  | same as Marvel Rivals        |
| Gamer Girl Ranked   | gg       | 20 min     | 6.99 ($7.95)   | **3.49** ($3.97)  | -50%   | —       | —                  | same as Marvel Rivals        |
| Play & Learn        | training | 30 min     | 12.99 ($14.78) | **5.99** ($6.82)  | -54%   | —       | —                  | same as Marvel Rivals        |
| Role Coaching       | training | 60 min     | 15.99 ($18.20) | **9.99** ($11.37) | -38%   | —       | —                  | same as Marvel Rivals        |

### rl

| Service            | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ------------------ | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus           | duo      | 60 min     | 4.99 ($5.68)   | **5.99** ($6.82)   | +20%   | —       | —                  | now per hour (~8 games)      |
| Duo Pro            | duo      | 60 min     | 7.99 ($9.09)   | **7.49** ($8.52)   | -6%    | —       | —                  | now per hour (~8 games)      |
| Duo Apex           | duo      | 60 min     | 10.99 ($12.51) | **9.99** ($11.37)  | -9%    | —       | —                  | now per hour (~8 games)      |
| 3v3 Standard       | Teams    |            | 5.99 ($6.82)   | unchanged          |        |         |                    | Teams tab is off at checkout |
| Casual 3v3         | social   | 60 min     | 3.49 ($3.97)   | **4.99** ($5.68)   | +43%   | —       | —                  | now per hour                 |
| Extra Modes        | social   | 60 min     | 3.49 ($3.97)   | **4.99** ($5.68)   | +43%   | —       | —                  | now per hour                 |
| Gamer Girl Duo     | gg       | 60 min     | 6.49 ($7.39)   | **7.99** ($9.09)   | +23%   | —       | —                  | now per hour                 |
| Gamer Girl Ranked  | gg       | 60 min     | 6.99 ($7.95)   | **8.99** ($10.23)  | +29%   | —       | —                  | now per hour                 |
| Play & Learn       | training | 60 min     | 12.99 ($14.78) | **10.99** ($12.51) | -15%   | —       | —                  | now per hour                 |
| Mechanics Training | training | 60 min     | 15.99 ($18.20) | **10.99** ($12.51) | -31%   | —       | —                  | coaching, smaller market     |

### tft

| Service              | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                    |
| -------------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ------------------------ |
| Double Up            | duo      | 35 min     | 3.99 ($4.54)   | **4.99** ($5.68)   | +25%   | 7.99    | -43% → -29%        | Double Up                |
| Board Coach          | duo      | 38 min     | 4.99 ($5.68)   | **7.49** ($8.52)   | +50%   | 9.99    | -43% → -15%        | Duo Pilot                |
| Normals & Hyper Roll | social   | 25 min     | 2.99 ($3.40)   | **2.99** ($3.40)   | 0%     | 5.99    | -43% → -43%        | Duo Casual               |
| Gamer Girl Duo       | gg       | 30 min     | 4.99 ($5.68)   | **3.99** ($4.54)   | -20%   | 6.49    | -12% → -30%        | Gamer Girl               |
| Gamer Girl Ranked    | gg       | 35 min     | 5.49 ($6.25)   | **4.99** ($5.68)   | -9%    | 6.49    | -4% → -12%         | Gamer Girl               |
| Comp & Econ Review   | training | 60 min     | 12.99 ($14.78) | **11.99** ($13.64) | -8%    | —       | —                  | coaching, smaller market |

### fc

| Service                 | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ----------------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| Co-op Rivals            | duo      | 18 min     | 5.49 ($6.25)   | **2.49** ($2.83)   | -55%   | —       | —                  | 18 min × €7.5/h              |
| Co-op Elite             | duo      | 18 min     | 7.99 ($9.09)   | **3.49** ($3.97)   | -56%   | —       | —                  | 18 min × €10.5/h             |
| Clubs Lineup            | Teams    |            | 5.49 ($6.25)   | unchanged          |        |         |                    | Teams tab is off at checkout |
| Practice Match          | social   | 20 min     | 3.99 ($4.54)   | **2.99** ($3.40)   | -25%   | —       | —                  | elite opponent + feedback    |
| Kick-Off & Friendlies   | social   | 15 min     | 2.99 ($3.40)   | **1.99** ($2.26)   | -33%   | —       | —                  | minimum price                |
| Gamer Girl Duo          | gg       | 15 min     | 5.99 ($6.82)   | **2.49** ($2.83)   | -58%   | —       | —                  | GG minimum                   |
| Gamer Girl Ranked       | gg       | 18 min     | 6.99 ($7.95)   | **2.99** ($3.40)   | -57%   | —       | —                  | 18 min × €9/h                |
| Tactics & Squad Builder | training | 60 min     | 14.99 ($17.06) | **11.99** ($13.64) | -20%   | —       | —                  | coaching, smaller market     |
| Champions Prep          | training | 60 min     | 14.99 ($17.06) | **11.99** ($13.64) | -20%   | —       | —                  | coaching, smaller market     |

### arc

| Service           | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ----------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus          | duo      | 60 min     | 7.99 ($9.09)   | **6.99** ($7.95)   | -13%   | —       | —                  | hourly Plus                  |
| Duo Pro           | duo      | 60 min     | 9.99 ($11.37)  | **8.99** ($10.23)  | -10%   | —       | —                  | hourly Pro                   |
| Duo Apex          | duo      | 60 min     | 13.99 ($15.92) | **11.99** ($13.64) | -14%   | —       | —                  | hourly top tier              |
| Full Squad        | Teams    |            | 17.99 ($20.47) | unchanged          |        |         |                    | Teams tab is off at checkout |
| Escort Run        | Teams    |            | 15.99 ($18.20) | unchanged          |        |         |                    | Teams tab is off at checkout |
| Learn the Maps    | social   | 60 min     | 6.99 ($7.95)   | **5.99** ($6.82)   | -14%   | —       | —                  | casual rate                  |
| Gamer Girl Duo    | gg       | 60 min     | 8.49 ($9.66)   | **8.99** ($10.23)  | +6%    | —       | —                  | standard hourly GG           |
| Gamer Girl Ranked | gg       | 60 min     | 9.99 ($11.37)  | **9.99** ($11.37)  | 0%     | —       | —                  | standard hourly GG           |
| PvP & Extraction  | training | 60 min     | 14.99 ($17.06) | **12.99** ($14.78) | -13%   | —       | —                  | standard coaching            |

### mc

| Service           | Tab      | Avg length | Now € ($)      | New € ($)          | Change | tapin $ | vs tapin now → new | Basis                        |
| ----------------- | -------- | ---------- | -------------- | ------------------ | ------ | ------- | ------------------ | ---------------------------- |
| PvP Duo           | duo      | 60 min     | 6.99 ($7.95)   | **7.49** ($8.52)   | +7%    | —       | —                  | PvP                          |
| PvP Duo Pro       | duo      | 60 min     | 8.99 ($10.23)  | **9.99** ($11.37)  | +11%   | 17.32   | -41% → -34%        | Duo Ultra $12.99/45 min      |
| Survival Partner  | duo      | 60 min     | 6.49 ($7.39)   | **7.99** ($9.09)   | +23%   | 10.65   | -31% → -15%        | Duo Survival $7.99/45 min    |
| Server Squad      | Teams    |            | 9.99 ($11.37)  | unchanged          |        |         |                    | Teams tab is off at checkout |
| Survival Together | social   | 60 min     | 5.99 ($6.82)   | **6.49** ($7.39)   | +8%    | —       | —                  | casual rate                  |
| Beat the Game     | social   | 60 min     | 6.99 ($7.95)   | **7.49** ($8.52)   | +7%    | —       | —                  | casual, experienced          |
| Manhunt           | social   | 60 min     | 14.99 ($17.06) | **12.99** ($14.78) | -13%   | —       | —                  | per run, ~60 min avg         |
| Hardcore Survival | social   | 60 min     | 6.49 ($7.39)   | **6.99** ($7.95)   | +8%    | —       | —                  | casual, experienced          |
| Minigames Night   | social   | 60 min     | 5.49 ($6.25)   | **5.99** ($6.82)   | +9%    | —       | —                  | casual rate                  |
| Gamer Girl Duo    | gg       | 60 min     | 7.49 ($8.52)   | **8.99** ($10.23)  | +20%   | 12.98   | -34% → -21%        | Gamer Girl $6.49/30 min      |
| Gamer Girl Ranked | gg       | 60 min     | 8.49 ($9.66)   | **9.99** ($11.37)  | +18%   | 12.98   | -26% → -12%        | Gamer Girl $6.49/30 min      |
| PvP Coaching      | training | 60 min     | 14.99 ($17.06) | **14.99** ($17.06) | 0%     | 19.99   | -15% → -15%        | Coaching $14.99/45 min       |
| Bedwars Coaching  | training | 60 min     | 14.99 ($17.06) | **14.99** ($17.06) | 0%     | 19.99   | -15% → -15%        | Coaching $14.99/45 min       |

### pu

| Service                 | Tab      | Avg length | Now € ($)      | New € ($)         | Change | tapin $ | vs tapin now → new | Basis                        |
| ----------------------- | -------- | ---------- | -------------- | ----------------- | ------ | ------- | ------------------ | ---------------------------- |
| Duo Plus                | duo      | 13 min     | 3.99 ($4.54)   | **1.99** ($2.26)  | -50%   | —       | —                  | minimum ranked price         |
| Duo Pro                 | duo      | 13 min     | 5.99 ($6.82)   | **2.49** ($2.83)  | -58%   | —       | —                  | 13 min, minimum-bound        |
| Duo Apex                | duo      | 13 min     | 9.99 ($11.37)  | **2.99** ($3.40)  | -70%   | —       | —                  | 13 min, minimum-bound        |
| Full Squad              | Teams    |            | 4.99 ($5.68)   | unchanged         |        |         |                    | Teams tab is off at checkout |
| Standard & Quick Battle | social   | 10 min     | 2.99 ($3.40)   | **1.99** ($2.26)  | -33%   | —       | —                  | minimum price                |
| Gamer Girl Duo          | gg       | 10 min     | 5.49 ($6.25)   | **1.99** ($2.26)  | -64%   | —       | —                  | minimum price                |
| Gamer Girl Ranked       | gg       | 13 min     | 5.99 ($6.82)   | **2.49** ($2.83)  | -58%   | —       | —                  | minimum-bound                |
| Play & Learn            | training | 20 min     | 9.99 ($11.37)  | **3.99** ($4.54)  | -60%   | —       | —                  | 20 min × €12/h               |
| Draft & Macro           | training | 60 min     | 12.99 ($14.78) | **9.99** ($11.37) | -23%   | —       | —                  | coaching, smaller market     |
