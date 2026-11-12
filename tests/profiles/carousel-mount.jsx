/*
 * Mounts the "Meet your teammates" carousel on its own for home-carousel-links.spec.ts.
 *
 * Almost everything that spec checks is in the markup, so it renders the homepage to static HTML
 * and reads it. One behaviour is not: the strip puts its sideways scroll back when focus leaves,
 * which only the browser can show. The dev server (vite) transforms and serves this module, so
 * that one test gets a real React carousel with real listeners without any of it reaching the
 * site's own pages. Nothing here ships: the build only ever looks at src/.
 *
 * The props are the ones Home.jsx builds for it (src/components/home/Home.jsx, `crew`), handed
 * over as JSON in the page.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import TeammateCarousel from '../../src/components/home/TeammateCarousel.jsx';

createRoot(document.getElementById('tc-root')).render(
  React.createElement(TeammateCarousel, {
    crew: JSON.parse(document.getElementById('tc-crew').textContent),
    game: { online: '', name: 'League of Legends' },
    onlineText: 'Nobody online right now.',
  }),
);
window.tcMounted = true;
