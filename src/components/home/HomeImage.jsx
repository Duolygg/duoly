import React from 'react';

// Only bundled homepage artwork is resized. Uploaded/remote images pass through.
export default function HomeImage({ src, width, style, ...props }) {
  let widths;
  let stem;
  let sizes = `${width}px`;
  let aspectRatio;
  if (/^\/assets\/avatars\/avatar-\d+\.png$/.test(src || '')) {
    widths = [50, 78, 100, 156];
    stem = src.replace(/\.png$/, '');
  } else if (src === '/assets/brand/logo-full.webp') {
    widths = [342, 560, 684, 1120];
    stem = src.replace(/\.webp$/, '');
    sizes = '(max-width: 608px) calc(100vw - 48px), 560px';
    // Keep the original intrinsic ratio, including fractional CSS pixel heights.
    aspectRatio = '900 / 741';
  } else if (src === '/assets/brand/logo-wordmark.webp') {
    widths = [96, 104, 192, 208];
    stem = src.replace(/\.webp$/, '');
  } else if (src === '/assets/brand/logo-mascots.webp') {
    widths = [40, 56, 72, 80, 112, 144];
    stem = src.replace(/\.webp$/, '');
  }
  return (
    <img
      {...props}
      src={src}
      width={width}
      srcSet={widths?.map((w) => `${stem}-${w}.webp ${w}w`).join(', ')}
      sizes={widths ? sizes : undefined}
      style={aspectRatio ? { ...style, aspectRatio } : style}
    />
  );
}
