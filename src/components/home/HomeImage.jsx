import React from 'react';

// Only bundled homepage artwork is resized. Uploaded/remote images pass through.
// Variants come from scripts/assets/optimize-images.mjs; keep the width ladders in step.
const FAMILIES = [
  {
    match: /^\/assets\/avatars\/avatar-\d+\.png$/,
    widths: [50, 78, 100, 156],
    stem: (src) => src.replace(/\.png$/, ''),
  },
  {
    match: /^\/assets\/brand\/logo-full\.webp$/,
    widths: [342, 560, 684, 1120],
    stem: (src) => src.replace(/\.webp$/, ''),
    sizes: '(max-width: 608px) calc(100vw - 48px), 560px',
    // Keep the original intrinsic ratio, including fractional CSS pixel heights.
    aspectRatio: '900 / 741',
  },
  {
    match: /^\/assets\/brand\/logo-wordmark\.webp$/,
    widths: [96, 104, 192, 208],
    stem: (src) => src.replace(/\.webp$/, ''),
  },
  {
    match: /^\/assets\/brand\/logo-mascots\.webp$/,
    widths: [40, 56, 72, 80, 112, 144],
    stem: (src) => src.replace(/\.webp$/, ''),
  },
  {
    match: /^\/assets\/games\/[a-z0-9-]+\.png$/,
    widths: [48, 96, 128, 256],
    stem: (src) => src.replace(/\.png$/, ''),
  },
  {
    match: /^\/assets\/payments\/[a-z0-9-]+\.png$/,
    widths: [56, 112, 168, 252],
    stem: (src) => src.replace(/\.png$/, ''),
  },
];

// Country flags are drawn in a 16x12 or 18x13 box. A single 54 px raster covers 3x screens and
// replaces SVGs up to 91 KB (es.svg) that each cost a rasterisation on the main thread.
const FLAG = /^\/assets\/flags\/svg\/([a-z]{2})\.svg$/;

export default function HomeImage({ src, width, style, ...props }) {
  const flag = FLAG.exec(src || '');
  if (flag)
    return (
      <img
        {...props}
        src={`/assets/flags/webp/${flag[1]}-54.webp`}
        width={width}
        style={style}
      />
    );
  const family = FAMILIES.find((f) => f.match.test(src || ''));
  const stem = family?.stem(src);
  const sizes = family ? (family.sizes ?? `${width}px`) : undefined;
  const aspectRatio = family?.aspectRatio;
  return (
    <img
      {...props}
      src={src}
      width={width}
      srcSet={family?.widths.map((w) => `${stem}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      style={aspectRatio ? { ...style, aspectRatio } : style}
    />
  );
}
