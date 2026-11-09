/**
 * Claims no customer-facing page may make, whatever the game or the service.
 *
 * Duoly sells shared playing time and coaching time, never a result. Ubisoft's
 * Player Protection Core Rules prohibit paying to inflate a rank outright, and
 * nobody else here promises one either, so the wording a seller reaches for
 * first is the wording to keep out of the copy registries.
 *
 * The rank-gap registry that used to sit beside it was withdrawn by owner
 * decision on 8 November 2026: the catalog and the services are the co-founder's
 * domain, so pages describe what is on offer rather than policing who may book
 * it. RANK_GAP_PHRASES below keeps that rule's wording out for good.
 *
 * tests/unit/claim-guard.test.ts runs these over every copy registry.
 */
export const FORBIDDEN_CLAIMS: RegExp[] = [
  /\b(?:raise|raises|raising|boost|boosts|boosting|inflate|inflates|increase|increases|increasing)\s+(?:your|their|the customer['’]s)\s+rank\b/i,
  /\brank\s+(?:boost|boosting|inflation)\b/i,
  /\bguaranteed\s+(?:rank|promotion|win|climb)\b/i,
  /\bwe\s+(?:will\s+)?(?:get|take)\s+you\s+to\s+[A-Z]/,
];

/**
 * The wording of the withdrawn rank-gap rule, kept out by pattern rather than
 * by review.
 *
 * Until 8 November 2026 the site carried a rule of its own: it told a reader
 * which teammate or coach rank a publisher's queue would let them book, named
 * the ceiling that followed and sent the wider pairings to a five-stack or an
 * unranked mode. The owner withdrew that rule, because the catalog and the
 * services are the co-founder's domain and the site promotes what is offered
 * rather than policing who may book it.
 *
 * #193 rewrote the registries, and a copy pass on 9 November 2026 found seven
 * passages it had missed, in the Call of Duty and Siege guides and in two
 * coaching pages. Every pattern below is lifted from one of those passages, so
 * the same sentence cannot come back quietly in a later copy edit. A page that
 * needs to say something true about a mode may still do so; it may not grade,
 * cap or question the pairing a customer books.
 *
 * Replacing a pattern means the owner decision changed, so change the decision
 * first. tests/unit/claim-guard.test.ts runs these over every copy registry.
 */
export const RANK_GAP_PHRASES: RegExp[] = [
  // "Ranked 3.0 applies both players limits at once" (Siege guide).
  /\bRanked\s+3\.0\b/i,
  // "that partner tops out at Emerald rather than Diamond".
  /\btops?\s+out\s+at\b/i,
  // "the highest rank Ranked 3.0 admits beside your own".
  /\b(?:queue|lobby|Ranked(?:\s+Play)?|Ranked\s+3\.0)\s+(?:allows|admits|accepts|permits)\b/i,
  // "the top rank Ranked Play allows", "the highest teammate the queue allows".
  /\b(?:top|highest|best)\s+(?:rank|tier|teammate|coach)\b[^.?!]{0,60}\b(?:allows|admits|accepts|permits)\b/i,
  // "a coach the queue accepts", "a teammate the queue allows".
  /\b(?:coach|teammate|partner|duo)\s+the\s+\w+\s+(?:allows|admits|accepts|permits)\b/i,
  // "the coach assigned is one ranked lets you queue with".
  /\b(?:lets?|let)\s+you\s+queue\s+with\b/i,
  // "Diamond carries its own two-rank window", "a wider gap belongs in Flex".
  /\b(?:one|two|three|four|five)[-\s]rank\s+(?:window|gap|limit|spread)\b/i,
  /\brank[-\s](?:window|gap)\b/i,
  /\bwider\s+gap\b/i,
  // "Activision holds Crimson and above to one rank", "parties of one or two
  // inside one rank", "a four-player party mixes ranks only at Diamond".
  /\b(?:holds?|keeps?|limits?|restricts?)\s+[A-Z][a-z]+(?:\s+\w+){0,3}\s+to\s+(?:one|two|a single)\s+rank\b/,
  /\b(?:inside|within)\s+(?:one|a single)\s+rank\b/i,
  /\bmixes?\s+ranks?\s+only\b/i,
  // "a Gold player may only queue with Platinum", "cannot duo at all".
  /\b(?:may|can|could)\s+only\s+queue\b/i,
  /\b(?:cannot|can\s?not|can['’]t)\s+duo\b/i,
  // "Platinum I is the ceiling", "caps a Gold duo at Platinum I".
  /\bis\s+the\s+(?:rank\s+)?ceiling\b/i,
  /\bcaps?\s+(?:a|your|the)\s+[A-Z][a-z]+\s+(?:duo|player|party|teammate)\b/,
  // "a wider pairing belongs in Flex", "book Unrated instead".
  /\bbelongs?\s+in\s+(?:Flex|Unrated|a\s+five-stack|a\s+5-stack)\b/i,
  /\bbook\s+(?:Flex|Unrated|a\s+five-stack|a\s+5-stack)\s+instead\b/i,
];
