// Hub page copy for /games/social and /games/valorant.
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
export const valorantContent: HubCopy = {
  title: 'Valorant LFG: Find Teammates or Book a Duo | Duoly',
  h1: 'Valorant LFG: find teammates for your next session',
  lead: 'Looking for Valorant teammates? Free LFG communities are great for an ongoing group. Duoly gets you a strong teammate for the next game, with coaching when you want to learn.',
  eyebrow: 'Valorant teammates',
  cta: 'Book a Valorant teammate',
  facts: [
    'Ascendant+ to Radiant teammates',
    'Ranked and casual modes',
    'Voice on Discord',
  ],
  format:
    'Paid sessions cover ranked duo tiers and casual modes. **Duo Plus** comes with an Ascendant+ teammate, **Duo Pro** with an Immortal+ teammate and **Duo Apex** with a Radiant teammate. Ranked prices follow your own rank, so the table lists each one.',
  steps: [
    'Pick a service, your rank and the number of games.',
    'Check out and set your region, voice and mood.',
    'Meet your teammate in the order chat and queue together.',
  ],
  sections: [
    {
      heading: 'Free Valorant LFG options come first',
      paragraphs: [
        'Community Discord LFG channels work well when you are happy to post your region, platform, rank and preferred role, then wait for replies. Look for an actively moderated Valorant community with clear rules, read them before posting and avoid sending private information to people who message you out of nowhere.',
        'Reddit communities can help you find players with similar schedules. Check each community’s rules for teammate posts, since some use a weekly thread and others remove LFG requests. In-game social features are another free route: add someone after a good match or use party invites.',
      ],
    },
    {
      heading: 'Write a post that someone can answer',
      paragraphs: [
        'A useful val LFG post says when you play, your region and platform, your current rank, whether you use voice and which roles you prefer. For example: EU PC, evening games, controller or sentinel, calm comms, looking for a regular duo.',
        'Name the session style as well as the role. A duelist who wants coordinated entry utility needs a different partner from someone learning sentinel in relaxed games. Agree how you handle losses, breaks and criticism, and leave a group that ignores those expectations. A compatible evening matters more than an impressive profile.',
      ],
    },
    {
      heading: 'When a paid Duoly session makes sense',
      paragraphs: [
        'A booked session gives you a teammate for a set number of games instead of an open-ended search. **Swiftplay**, **Unrated** and **Deathmatch Warm-Up** cover different casual goals. Competitive tiers are priced per game and your ranks must be able to queue together.',
        'For a structured lesson, use the [Valorant coaching page](/games/valorant/coaching), with live Play and Learn, VOD Review and Aim and Crosshair. A duo teammate will happily answer a quick question, but a full analysis or training plan is what coaching is for.',
      ],
    },
    {
      heading: 'Check compatibility before opening the lobby',
      paragraphs: [
        'Confirm region, PC or console, current rank, mode and voice preferences before you play. Play on your own account and check that your ranks can queue together.',
        'A typical session starts with agent and role preferences, a quick audio check and an agreed approach to comms. During the game, keep calls useful: location, utility and the next action. Afterward, decide whether to book more games. Keep payment and messages on Duoly, and contact support if something goes wrong.',
      ],
    },
  ],
  faq: [
    [
      'Is Duoly a free Valorant teammate finder?',
      'No. Duoly books paid sessions. Discord, Reddit and in-game social features are free ways to find a regular group.',
    ],
    [
      'Can I choose an agent role?',
      'Yes. Share your preference in the order chat so your teammate can plan around it.',
    ],
    [
      'Can every rank queue together?',
      'No. Valorant party restrictions still apply, so your ranks and modes must be compatible.',
    ],
    [
      'Can I book several games?',
      'Yes. 3 games get 10 percent off, 5 get 15 percent and 10 get 25 percent.',
    ],
    [
      'What does a per-game price mean?',
      'You pay for one game in the selected service. Game length depends on the mode.',
    ],
    [
      'Where do I book a Valorant coach?',
      'On the Valorant coaching page, with training services, prices and preparation tips.',
    ],
  ],
  closing: {
    heading: 'Ready to queue?',
    text: 'Pick a service and your rank, then meet your teammate in the order chat.',
  },
};
