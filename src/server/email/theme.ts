/** Brand tokens mirrored from the original design source (app/globals.css and components/*.jsx). */
export const color = {
  page: '#090414',
  card: '#120B22',
  inset: '#0D0819',
  raised: '#1B1033',
  border: '#261A40',
  hairline: '#1E1533',
  white: '#FFFFFF',
  text: '#F3EEFF',
  body: '#A79DC4',
  muted: '#8E84AB',
  faint: '#6A6086',
  link: '#CFC4EA',
  lavender: '#D6BBFF',
  onLavender: '#17092E',
  pink: '#F0A6FF',
  gold: '#FFD27A',
  green: '#5EEAA8',
  /**
   * Filled surfaces that carry text. Gmail's mobile apps invert text colours in dark mode
   * but keep gradients, so text on a filled surface must be light on a deep colour: dark
   * ink on a pastel fill turns invisible. White passes on both of these.
   */
  action: '#7C4DFF',
  actionTo: '#C25CF0',
  doneFill: '#16855A',
  greenInk: '#062A1B',
  red: '#FF8A9B',
  sky: '#9EE6FF',
} as const;

export const font = {
  display: "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif",
  body: "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif",
  mono: "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace",
} as const;

/** Loyalty tiers from the rebuild brief (Money section). Gradients mirror the dashboard tier card. */
export const loyaltyTiers = {
  bronze: {
    name: 'Bronze',
    level: 1,
    cashback: 1,
    from: '#F6D9C4',
    to: '#D99A6C',
    ink: '#2B1606',
  },
  silver: {
    name: 'Silver',
    level: 2,
    cashback: 2,
    from: '#F1F3F8',
    to: '#A9B1C4',
    ink: '#141826',
  },
  gold: {
    name: 'Gold',
    level: 3,
    cashback: 3,
    from: '#FFE7B0',
    to: '#E7A93C',
    ink: '#2A1A02',
  },
  platinum: {
    name: 'Platinum',
    level: 4,
    cashback: 5,
    from: '#DDF7FF',
    to: '#7FC8E8',
    ink: '#05202B',
  },
  diamond: {
    name: 'Diamond',
    level: 5,
    cashback: 7,
    from: '#F7D6FF',
    to: '#A98BFF',
    ink: '#1A0B33',
  },
} as const;

export type LoyaltyTier = keyof typeof loyaltyTiers;
