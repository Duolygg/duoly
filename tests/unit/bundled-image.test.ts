import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BundledImage from '../../src/components/shared/BundledImage';
import { GAME_ART_WIDTHS, gameArtSrcSet } from '../../src/site/game-art';

const render = (
  props: { src: string; width: number; style?: React.CSSProperties } & Record<
    string,
    unknown
  >,
) =>
  renderToStaticMarkup(
    React.createElement(BundledImage, { style: undefined, ...props }),
  );

describe('bundled responsive artwork', () => {
  it('adds responsive sources without changing dimensions, style, alt or loading', () => {
    const html = render({
      src: '/assets/games/valorant.png',
      width: 48,
      height: 48,
      alt: 'Valorant',
      loading: 'lazy',
      decoding: 'async',
      style: { width: '48px', height: '48px', borderRadius: '6px' },
    });
    expect(html).toContain('src="/assets/games/valorant.png"');
    expect(html).toContain('sizes="48px"');
    expect(html).toContain('width="48"');
    expect(html).toContain('height="48"');
    expect(html).toContain('alt="Valorant"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('style="width:48px;height:48px;border-radius:6px"');
    expect(html).toContain(
      `srcSet="${gameArtSrcSet('/assets/games/valorant.png')}"`,
    );
  });

  it.each(['/uploads/avatar.webp', 'https://example.test/avatar.png'])(
    'does not rewrite an uploaded or remote image: %s',
    (src) => {
      const html = render({
        src,
        width: 40,
        height: 40,
        alt: '',
        loading: 'lazy',
      });
      expect(html).toContain(`src="${src}"`);
      expect(html).not.toContain('srcSet=');
      expect(html).not.toContain('sizes=');
    },
  );

  it('never invents detail by upscaling a 128px game master for an audit', () => {
    expect(Math.max(...GAME_ART_WIDTHS)).toBe(128);
    expect(gameArtSrcSet('/assets/games/valorant.png')).not.toContain('256');
  });

  it('keeps the existing hero ratio and responsive width rules', () => {
    const html = render({
      src: '/assets/brand/logo-full.webp',
      width: 560,
      height: 461,
      alt: 'Duoly',
      style: { width: '100%', height: 'auto' },
    });
    expect(html).toContain('aspect-ratio:900 / 741');
    expect(html).toContain('(max-width: 608px) calc(100vw - 48px), 560px');
  });
});
