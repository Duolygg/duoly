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
      heading: 'Which Social activity should you pick?',
      paragraphs: [
        'Pick the one that matches the evening you actually want. **Just Chat** is an hour of conversation about games, music or your day, and it works whether you bring a topic or none. **Watch Together** puts a film, a show or a stream on while you talk, so pick something you can both start at the same time. Both are the usual first booking.',
        '**Sleep Call** is quieter company while you wind down, so agree the volume and how the call should end before it starts. **Karaoke** is for picking songs and singing them badly together, and a rough playlist helps more than a perfect one. Nobody has to be good at it. Every activity is the same hourly voice call underneath, so the choice is about mood rather than money.',
      ],
    },
    {
      heading: 'Want to play a game instead?',
      paragraphs: [
        'Searching for a Valorant e-girl to queue with? Pick Valorant on the homepage and open the Gamer Girls tab for real games, priced per game, or start with the [Valorant hub](/games/valorant).',
      ],
    },
    {
      heading: 'What happens in the first hour?',
      paragraphs: [
        'It starts the way any voice call starts. You say hi in the order chat, agree a start time, then join Discord. A Just Chat hour usually opens with introductions and whatever you both feel like talking about, and it helps to settle how the call ends before you need to end it. For Watch Together, get the playback lined up first, because ten minutes of fixing a stream is ten minutes of the hour.',
        'Headphones and a room where you can talk make the difference. Use a screen name, keep your address and payment details to yourself, and mute the notifications you would not want read out. Ask before recording anything. Either of you can say no to a topic at any point, and the good hours are the ones where both people say what they are up for early.',
      ],
    },
    {
      heading: 'How is a Gamer Girl verified?',
      paragraphs: [
        'Duoly reviews every Gamer Girl application before she can accept a single Social order, and only verified accounts ever see them. That is the whole gate, and it is worth knowing what it is: no rank is checked here, because rank is not what you are booking. If you are comparing e-girl websites, the three things to look for are clear session rules, real prices on the page and a way to report a problem.',
        'Social is friendly company and nothing else. Nobody under 18 is on either side of a booking, and dating, romantic or sexual services are outside the service. If a request or a behaviour crosses a line, use the order tools and write to support. Keep payment and messages on Duoly so the booking stays on record, and never send a private payment or your account details to anyone. The [terms](/terms) carry the cancellation, refund and dispute rules.',
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
      'Yes. 3 hours get 10 percent off, 5 get 20 percent and 10 get 25 percent.',
    ],
  ],
  closing: {
    heading: 'Ready for a friendly hour?',
    text: 'Pick an activity, give your Discord name and meet your host on voice.',
  },
};
