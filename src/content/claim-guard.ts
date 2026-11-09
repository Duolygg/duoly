/**
 * Claims no customer-facing page may make, whatever the game or the service.
 *
 * Duoly sells shared playing time and coaching time, never a result. Ubisoft's
 * Player Protection Core Rules prohibit paying to inflate a rank outright, and
 * nobody else here promises one either, so the wording a seller reaches for
 * first is the wording to keep out of the copy registries.
 *
 * This is the only rank guard the site keeps. The rank-gap registry that used to
 * sit beside it was withdrawn by owner decision on 8 November 2026: the catalog
 * and the services are the co-founder's domain, so pages describe what is on
 * offer rather than policing who may book it.
 *
 * tests/unit/claim-guard.test.ts runs these over every copy registry.
 */
export const FORBIDDEN_CLAIMS: RegExp[] = [
  /\b(?:raise|raises|raising|boost|boosts|boosting|inflate|inflates|increase|increases|increasing)\s+(?:your|their|the customer['’]s)\s+rank\b/i,
  /\brank\s+(?:boost|boosting|inflation)\b/i,
  /\bguaranteed\s+(?:rank|promotion|win|climb)\b/i,
  /\bwe\s+(?:will\s+)?(?:get|take)\s+you\s+to\s+[A-Z]/,
];
