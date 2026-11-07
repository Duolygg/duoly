import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBookingPreferences } from '../../src/contracts/booking-link';
import { games, services } from '../../src/server/mcp/catalog';
import { rolesFor } from '../../src/contracts/roles';
import Home from '../../src/components/home/Home.jsx';

function open(search: string, props: Record<string, unknown> = {}) {
  let url = new URL('https://duoly.gg/' + search);
  vi.stubGlobal('window', {
    location: url,
    history: {
      replaceState: (_state: unknown, _unused: string, path: string) => {
        url = new URL(path, url);
      },
    },
  });
  vi.stubGlobal('document', { getElementById: () => null });
  const home = new Home({ recentMatches: [], ...props });
  home.setState = (patch, callback) => {
    Object.assign(home.state, patch);
    callback?.();
  };
  home.openGameFromLink();
  return { home, url };
}

afterEach(() => vi.unstubAllGlobals());

describe('homepage booking links', () => {
  it('forwards prefilled values through the unchanged checkout callback only after confirmation', async () => {
    const onCheckout = vi.fn(async () => ({}));
    const { home } = open(
      '?game=mc&service=squad&server=my+world&edition=Bedrock&seats=2&voice=false&mood=chill&ign=Player&note=Build+a+base&creatorCode=ABC123',
      { onCheckout },
    );
    expect(onCheckout).not.toHaveBeenCalled();
    await home.renderVals().placeOrder();
    expect(onCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        gameId: 'mc',
        serviceId: 'squad',
        server: 'my world',
        edition: 'Bedrock',
        seats: 2,
        voice: false,
        mood: 'chill',
        ign: 'Player',
        note: 'Build a base',
        creatorCode: 'ABC123',
        useWallet: true,
      }),
    );
  });

  it('accepts explicit private-text links without requesting these fields from assistants', () => {
    const { home, url } = open(
      '?game=lol&service=learn&ign=+Player%23123+&note=+Practice+laning+&creatorCode=ABC123',
    );
    expect(home.state).toMatchObject({
      ign: 'Player#123',
      orderNote: 'Practice laning',
      creatorCode: 'ABC123',
    });
    expect(url.search).toBe('');
  });
  it('accepts every exact public catalog rank, role, region, edition and seat count', () => {
    let checked = 0;
    for (const game of games())
      for (const service of services(game.id)) {
        const cases: Array<[string, string]> = [
          ...service.ranks.map((v) => ['rank', v] as [string, string]),
          ...rolesFor(game.id, service.id).map(
            (v) => ['role', v] as [string, string],
          ),
          ...service.regions.map((v) => ['region', v] as [string, string]),
          ...service.editions.map((v) => ['edition', v] as [string, string]),
        ];
        for (let seats = service.seats.min; seats <= service.seats.max; seats++)
          cases.push(['seats', String(seats)]);
        for (const [key, value] of cases) {
          expect(
            parseBookingPreferences(
              new URLSearchParams([[key, value]]),
              game.id,
              service.id,
            ).invalid,
          ).toEqual([]);
          checked++;
        }
      }
    expect(checked).toBeGreaterThan(1000);
  });
  it.each([
    'role=jungle',
    'role=Jungle&role=Top',
    'voice=0',
    'voice=False',
    'mood=Teach',
    'seats=2',
    'seats=1.5',
    'edition=Java',
    'server=hello',
    'qty=11',
    'character=' + 'x'.repeat(41),
  ])('silently ignores invalid or incompatible %s', (search) => {
    const { home, url } = open('?game=lol&service=duo2&' + search);
    expect(home.state).toMatchObject({
      role: '',
      character: '',
      voice: true,
      mood: '',
      seats: 1,
      qty: 1,
      mcServer: '',
      mcEdition: 'Java',
    });
    expect(url.search).toBe('');
  });
  it('preserves trimmed Minecraft world and edition while ignoring conflicting regions', () => {
    expect(
      open('?game=mc&service=squad&server=+my+world+&edition=Bedrock&seats=2')
        .home.state,
    ).toMatchObject({ mcServer: 'my world', mcEdition: 'Bedrock', seats: 2 });
    expect(
      parseBookingPreferences(
        new URLSearchParams('server=my+world&region=EU'),
        'mc',
        'squad',
      ).invalid,
    ).toEqual(['region', 'server']);
  });
  it('does not suppress an explicitly selected role with a main-service bundle', () => {
    const { home } = open('?game=lol&service=duo2&qty=3&role=Jungle');
    expect(home.state).toHaveProperty('bundle', null);
    expect(
      home.renderVals().roleOpts.find((r) => r.name === 'Jungle')?.pressed,
    ).toBe('true');
  });

  it('prefills existing coaching fields without suppressing roles in a bundle', () => {
    const { home, url } = open(
      '?game=lol&service=learn&role=Jungle&character=+Ahri+&voice=false&mood=teach&qty=3',
    );
    expect(home.state).toMatchObject({
      role: 'Jungle',
      character: 'Ahri',
      voice: false,
      mood: 'teach',
      qty: 3,
      bundle: null,
    });
    expect(url.search).toBe('');
  });
  it('prefills the catalog rank, server and matching main-service bundle', () => {
    const { home, url } = open(
      '?game=val&service=duo2&rank=Gold&region=NA&qty=3&agent=claude&other=keep#modes-h',
    );
    expect(home.state).toMatchObject({
      game: 'val',
      mode: 'duo2',
      rank: 'Gold',
      region: 'NA',
      qty: 3,
      bundle: 'Spike Plant',
    });
    expect(url.search).toBe('?agent=claude&other=keep');
    expect(url.hash).toBe('#modes-h');
  });

  it.each(['', '0', '-1', '1.5', '3oops', '1e2', 'NaN', 'Infinity'])(
    'ignores invalid quantity %j and invalid catalog tokens',
    (qty) => {
      const { home, url } = open(
        '?game=val&service=duo2&rank=gold&region=eu&qty=' + qty,
      );
      expect(home.state).toMatchObject({ rank: '', qty: 1, bundle: null });
      expect(home.state).not.toHaveProperty('region');
      expect(url.search).toBe('');
      expect(home.renderVals().rank).toBe('Platinum');
    },
  );

  it.each([
    ['duo2', '100', 1, null],
    ['duo1', '3', 3, null],
    ['vod', '100', 1, null],
    ['duo2', '2', 2, null],
  ])(
    'validates %s quantity %s without changing the service',
    (service, qty, expected, bundle) => {
      const { home } = open(`?game=val&service=${service}&qty=${qty}`);
      expect(home.state).toMatchObject({
        mode: service,
        qty: expected,
        bundle,
      });
    },
  );

  it('validates the service-specific ladder', () => {
    expect(open('?game=lol&service=arena&rank=Wood').home.state.rank).toBe(
      'Wood',
    );
    expect(open('?game=lol&service=duo2&rank=Wood').home.state.rank).toBe('');
    expect(open('?game=val&service=vod&rank=Gold').home.state.rank).toBe('');
  });

  it('keeps game-only and invalid-game fallbacks unchanged', () => {
    expect(open('?game=val').home.state).toMatchObject({
      game: 'val',
      qty: 3,
      rank: '',
    });
    const { home, url } = open(
      '?game=unknown&rank=Gold&region=EU&qty=5&agent=claude',
    );
    expect(home.state).toMatchObject({ game: 'lol', qty: 3, rank: '' });
    expect(url.search).toBe('?agent=claude');
    expect(open('?game=mc&region=Europe').home.state).not.toHaveProperty(
      'region',
    );
  });

  it('keeps the existing manual bundle and quantity-picker behavior', () => {
    const { home } = open('?game=val&service=duo2&rank=Gold&qty=3');
    const total = home.renderVals().total;
    home.setState({ tab: 'bundles', bundle: null, qty: 1 });
    home.renderVals().cards[0].pick();
    expect(home.state).toMatchObject({
      bundle: 'Spike Plant',
      mode: 'duo2',
      qty: 3,
    });
    expect(home.renderVals().total).toBe(total);
    home.renderVals().qtys[1]!.pick();
    expect(home.state).toMatchObject({ bundle: null, qty: 3 });
    expect(home.renderVals().total).toBe(total);
  });
});
