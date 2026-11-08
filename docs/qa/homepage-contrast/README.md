# Homepage contrast and responsive-image evidence

Scope: owner-approved homepage text hints and invisible artwork delivery only. No copy, title, layout, FAQ data, original image, shared stylesheet, email or dashboard changes.

## Contrast

All affected text is smaller than WCAG large text, so the threshold is 4.5:1. Starting colour is `#6A6086`. The new colours are the first passing 8-bit sRGB shades along an HSL lightness increase preserving the original hue and saturation (rounding to the nearest channel). The existing `#8E84AB` palette shade also passes, but is a larger lightness change.

| Element                                    | Background | Before | After  | New colour |
| ------------------------------------------ | ---------- | ------ | ------ | ---------- |
| Hero timer `2:00`                          | `#090414`  | 3.4937 | 4.5031 | `#7C7199`  |
| Rank price hint                            | `#120B22`  | 3.3102 | 4.5067 | `#80759C`  |
| Session mood optional hint                 | `#120B22`  | 3.3102 | 4.5067 | `#80759C`  |
| Homepage character and note optional hints | `#120B22`  | 3.3102 | 4.5067 | `#80759C`  |
| Closed FAQ numbers, all tabs               | `#120B22`  | 3.3102 | 4.5067 | `#80759C`  |
| Open FAQ numbers, all tabs                 | `#1B1033`  | 3.1067 | 4.5062 | `#847A9F`  |

The timer and mood overrides are component-local. The global `#6A6086` token is unchanged.

## Mobile Lighthouse

Real local Vercel production bundle, standard mobile settings, same local Chromium, one successful before/after run each. Concurrent machine load makes performance indicative rather than a statistically controlled benchmark.

| Category      | Before | After |
| ------------- | ------ | ----- |
| Performance   | 63     | 83    |
| Accessibility | 94     | 97    |

**Accessibility 100 is blocked by the unchanged, protected footer copyright text** (`#6A6086` on `#090414`, 3.4937:1). Lighthouse reports exactly that one remaining contrast node. It was not included in the owner-approved elements and was not changed. PR #185's separate star-rating ARIA fix is included through rebasing. Owner approval to change the footer is needed to reach 100.

Raw Lighthouse HTML/JSON and original PNG evidence are retained locally in `~/.hermes/cache/scratch/contrast/`.

## Images

54 new lossless WebP variants. Originals retained, including all PNG avatars. Only bundled homepage avatar/brand paths receive `srcset` and `sizes`; remote uploads pass through unchanged. Existing width/height attributes and styles are preserved. Hero art explicitly retains the original 900/741 intrinsic aspect ratio so rounding variant heights cannot shift the layout.

- Avatars: 50, 78, 100 and 156 pixels, covering 50/78 CSS pixel displays at 1x/2x.
- Hero: 342, 560, 684 and 1120 pixels, covering mobile and desktop at 1x/2x. The source is 900 pixels wide, so the 1120 variant does not invent extra detail.
- Header wordmarks: 96, 104, 192 and 208 pixels.
- Mascots: 40, 56, 72, 80, 112 and 144 pixels.

Unique original/variant avatar and brand resources selected in the complete 1x page captures:

| Viewport | Before bytes | After bytes | Saved bytes |
| -------- | ------------ | ----------- | ----------- |
| 390      | 645739       | 308281      | 337458      |
| 1440     | 645739       | 451183      | 194556      |

These are actual unique selected file-byte totals, not the original PageSpeed estimate. Shared account-room preview and protected footer/support images still use their original assets. [Per-variant dimensions and bytes](images.json).

## Visual proof and pixel differences

Full pages are split into sections no taller than 6000 pixels. Page heights are unchanged: 8492 at desktop, 14855 at mobile; no horizontal overflow at 390.

- [Desktop before, top](before-1440-section-0.webp), [bottom](before-1440-section-1.webp)
- [Desktop after, top](after-1440-section-0.webp), [bottom](after-1440-section-1.webp)
- [Mobile before, top](before-390-section-0.webp), [middle](before-390-section-1.webp), [bottom](before-390-section-2.webp)
- [Mobile after, top](after-390-section-0.webp), [middle](after-390-section-1.webp), [bottom](after-390-section-2.webp)
- Close-ups: files `before/after-{390,1440}-{timer,price,mood,faq-1,...,faq-6}.webp`. Close-ups use the same loaded DOM, restoring the original text colour for the before image.
- [Uncontrolled independent-page pixel statistics](pixel-diff.json)
- [Controlled same-DOM pixel statistics](controlled-pixel-diff.json)

Controlled pairs pause JavaScript timers and CSS animations, then restore only original image sources and original hint colours in the same document for the before capture. This separates the change from the pre-existing animated order-room preview. Files `controlled-before/after-{width}-section-{n}.webp` show those pairs; `controlled-diff-*` show changed pixels in red.

**The strict requirement that only text pixels differ is not achieved:** right-sizing changes resampling pixels even with lossless encoding. Controlled desktop differences are confined entirely to intended text/image rectangles. Mobile has nine additional image-edge pixels with a maximum one-channel delta of 1. Entire-section mean channel differences are 0.0174 to 0.0449 out of 255. There is no layout or copy change, and visual inspection found no distortion, compression blocks or overflow, but these results must not be described as pixel-identical images.

## Validation

- New Playwright contrast and responsive-source checks: failed before, four passed after (desktop/mobile).
- Astro check: zero errors, zero warnings (58 existing hints).
- ESLint, Prettier, unit tests and production build passed; unit tests: 2337 at the tested base.
- Main browser suite: 239/240 on first run; the existing mobile out-of-range booking URL check passed alone on retry.
- Chat: 12 passed. Completion: 16 passed. Teammate: 74 passed. Analytics: eight passed.
- Production SEO verifier: 34 passed at the tested base.
- Several managed preview/fixture servers were terminated during concurrent runs, producing connection-refused failures. Detached fixture servers completed teammate and analytics suites. No unrelated application changes were made to address infrastructure failures.

Citability is not applicable: this PR changes no editorial copy or structured data.
