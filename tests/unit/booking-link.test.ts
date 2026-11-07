import { afterEach, describe, expect, it, vi } from 'vitest';
import Home from '../../src/components/home/Home.jsx';

function open(search: string) {
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
  const home = new Home({ recentMatches: [] });
  home.setState = (patch, callback) => {
    Object.assign(home.state, patch);
    callback?.();
  };
  home.openGameFromLink();
  return { home, url };
}

afterEach(() => vi.unstubAllGlobals());

describe('homepage booking links', () => {
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
