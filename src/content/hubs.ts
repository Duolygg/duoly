// Hub page copy for /games/social. Every game hub lives in src/content/game-hubs.
// **Bold** and [links](/path) are rendered by src/components/seo/rich.ts.
export interface HubCopy {
  title: string;
  h1: string;
  lead: string;
  eyebrow: string;
  cta: string;
  facts: string[];
  format: string;
  steps: string[];
  sections: { heading: string; paragraphs: string[] }[];
  faq: [string, string][];
  closing: { heading: string; text: string };
}
export const socialContent: HubCopy = {
  title: 'Play With an E-Girl: Social Sessions and Prices | Duoly',
  h1: 'Play with an e-girl or book friendly Social time',
  lead: 'Book a verified Gamer Girl for a friendly voice session on Discord. Pick Just Chat, Watch Together, Sleep Call or Karaoke, with no game needed.',
  eyebrow: 'Duoly Social',
  cta: 'Book a Social session',
  facts: [
    'Verified Gamer Girls',
    '1 hour voice sessions',
    'Just you, voice and Discord',
  ],
  format:
    'Social sessions are hourly voice calls. Choose an activity and the number of hours, then coordinate in your order chat. You give your Discord name, pick your region for the time zone, and no rank is required.',
  steps: [
    'Pick an activity and the number of hours.',
    'Check out and give your Discord name.',
    'Say hi in the order chat and join the voice call.',
  ],
  sections: [
    {
      heading: 'Choose the activity you want',
      paragraphs: [
        '**Just Chat** is for talking about games, music or your day. Bring a topic or keep it casual. **Watch Together** adds a shared movie, show or stream with voice conversation. Pick something you can both stream.',
        '**Sleep Call** is calm background chat while you wind down. Agree the volume, conversation and ending before the call begins. **Karaoke** lets you pick songs and sing together. Agree requests with your host. A playlist helps, and it is fine to pick a different song.',
      ],
    },
    {
      heading: 'Want to play a game instead?',
      paragraphs: [
        'Searching for a Valorant e-girl to queue with? Pick Valorant on the homepage and open the Gamer Girls tab for real games, priced per game, or start with the [Valorant hub](/games/valorant).',
      ],
    },
    {
      heading: 'A comfortable first hour',
      paragraphs: [
        'A Just Chat hour can start with introductions and a topic you both enjoy. Check audio and agree how you will end the call. Spend most of the hour on the conversation, then leave a few minutes to wrap up. For Watch Together, set up the content and playback at the start.',
        'Have Discord, headphones and a quiet room ready if you can. Use a screen name and keep addresses, payment details and personal notifications private. Ask before recording anything. Either of you can decline a topic, and a good session leaves both people free to state their limits.',
      ],
    },
    {
      heading: 'Verification and boundaries',
      paragraphs: [
        'Duoly reviews every Gamer Girl application before she can take Social orders. When you choose an e-girl website, look for clear session rules, real prices and a way to report problems; Duoly has all three.',
        'If a request or behavior crosses a boundary, use the order tools and contact support. Keep payment and messages on Duoly so the booking stays on record, and never send private payments or account credentials. Read the terms for cancellation, refunds and disputes.',
      ],
    },
  ],
  faq: [
    [
      'Is Social a dating service?',
      'No. Social is friendly company only, never dating, romantic or sexual services. Everyone must be at least 18.',
    ],
    [
      'Can I play Valorant during a Social booking?',
      'Social is voice company without a game. For games, book a Valorant Gamer Girl service, priced per game.',
    ],
    [
      'What does verified Gamer Girl mean?',
      'Duoly reviewed the application and granted Gamer Girl access. Only verified Gamer Girls can accept Social orders.',
    ],
    [
      'How long is a session?',
      'One hour per unit, and you can book several hours in one order.',
    ],
    [
      'What do I need?',
      'Discord with working voice and your Discord name. You do not need a game account.',
    ],
    [
      'Are several hours discounted?',
      'Yes. 3 hours get 10 percent off, 5 get 15 percent and 10 get 25 percent.',
    ],
  ],
  closing: {
    heading: 'Ready for a friendly hour?',
    text: 'Pick an activity, give your Discord name and meet your host on voice.',
  },
};
