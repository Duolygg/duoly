# Profile header browser investigation

## Scope and reproduction

Run `corepack pnpm exec playwright test --config tests/header-ui.config.ts`.
This starts the isolated settings fixture with public profiles enabled, uses Chromium desktop and real Playwright WebKit with the iPhone 13 device settings, and mocks only account APIs and storage. No production calls or credentials are used. These are macOS browser engines, not physical Windows Chrome or the reported iPhone running iOS 18.7. Hardware memory pressure and the native iOS picker are not reproduced.

The existing public hero tests run with `corepack pnpm exec playwright test --config playwright.profiles.config.ts profile-header.spec.ts`. The older settings tests run with `corepack pnpm exec playwright test --config playwright.teammate.config.ts public-profile-header.spec.ts`.

## Exact reported error

The current endpoint emits `Header could not be saved.` only for a POST where `storeHeader` returns null. That means invalid internal user ID, missing service configuration, a failed profile row read, storage upload failure, or failed compare-and-swap database update. A missing profile row and a concurrent header update are included in those failures. Errors thrown instead of returned reach the outer catch and say `Header images are unavailable right now.`

Browser reproduction in both engines: pick a JPG, upload against a mocked 503 with that exact error, then move the crop with ArrowDown. The error remains visible and the POST count stays one. It is the previous attempt's React state, not evidence of another request. Retry clears the message and a mocked successful response produces `Header saved.` and a decoded saved preview. Cancel and choosing a new valid file also clear the upload error. The error is not stored in local storage or session storage by this component.

A fresh document with GET settings 200 does not resurrect the old error. Both the profile page and the real account JSON responses inherit private no-cache/no-store headers from accountContext. The only service worker registration found is the admin worker, not a profile worker. History back in this Playwright harness created fresh documents in both engines, so it did not reproduce bfcache retention. A real retained document could keep React state, but this is not established as the reported iPhone's cause. A fresh settings GET cannot itself create the exact upload error.

## Proven defects fixed

- Force canvas `toDataURL` to throw after selecting an image: previously an unhandled rejection left `Uploading…` disabled forever with no POST and no alert. Now it resets busy state and says `This browser could not prepare the picture. Try a smaller JPG or PNG.` This tests fault recovery, not proof that the production iPhone exhausted memory.
- Force `getContext('2d')` to return null: previously a blank crop was offered for upload. Canvas draw errors and missing contexts now discard the unusable crop with the same preparation message.
- Start saving other profile settings, hold that response, successfully upload a header, then release a settings response with the older top-level `header: null`: previously the preview vanished despite `Header saved.` still showing. Header revisions now keep older settings reads/saves from overwriting newer successful uploads or removals.
- Return 404 for an already saved preview: previously only a broken image appeared. Now an explicit, separate preview error says `Your header is saved, but the picture could not load. Reload or try another picture.` It also detects images that failed before hydration. Replace and remove remain available.
- Abort fetch or return a non-JSON HTML 413: previously Chrome showed `Failed to fetch` or a JSON parser exception; WebKit showed `Load failed` or `The string did not match the expected pattern.` The shared settings request helper now gives an actionable connection or unreadable response message, without changing JSON API errors.
- Reject best-effort old-object cleanup after a successful database mutation: previously `storeHeader` or `removeHeader` rejected and the endpoint could report an unavailable error even though the change was durable. Cleanup errors are now logged and left to the existing durable cleanup queue without turning a successful mutation into a failed one.
- Invalid image API copy previously named only WebP despite accepting JPEG for Safari. It now says `Choose a JPG or WebP image up to 300 KB.`

## Format, size and browser results

A deterministic 4032 by 3024 photographic-like image generated from gradients plus seeded noise is genuinely JPEG encoded, selected, decoded, cropped to 1500 by 500, and uploaded in both engines. Chromium produced WebP: 229414 bytes, JSON body 305945 bytes. WebKit's unsupported WebP canvas encoder returned PNG and the existing JPEG fallback produced about 255081 bytes, JSON body 340165 bytes. WebKit JPEG output can vary by a few bytes between runs. Neither hit a size or memory failure.

A genuine HEIC fixture was created from the existing source image with macOS `sips`. WebKit decoded it and can encode the crop for upload. Chromium rejected it before any POST with `That picture could not be opened. Try a JPG or PNG.` The file input still advertises the supported common formats, not HEIC; native picker conversion behavior is outside this test.

Unit tests run the real API handler, real bounded-body reader, CSRF validation and real decoder, mocking account identity and persistence. JPEG and WebP fixtures padded with legal JPEG comments or WebP JUNK chunks to exactly 307200 bytes both pass. Their data URLs are 409623 characters and their JSON bodies with a real 64-character token are 409709 bytes, below the 410000-byte body limit. Thus ordinary allowed images do not exceed the body cap after base64 and JSON encoding. Images just above the binary cap are rejected with 400, not the reported 503. Oversized JSON is independently rejected with `Invalid or oversized request.` Platform-level rejection is represented by a mocked HTML 413, not exercised on Vercel.

## Other failure paths checked

- Not an image: `Pick a picture file, for example a JPG, a PNG or a WebP.`
- Pick over 20 MB: `That picture is over 20 MB. Try a smaller one.`
- Undecodable image: `That picture could not be opened. Try a JPG or PNG.`
- Width under 300 pixels: exact width and minimum-width explanation; no POST.
- Unsupported canvas output: `This browser could not save the picture. Try another browser.`
- Encoder remains above 300 KB through the quality steps: `That picture stays over 300 KB even at low quality. Try one with less fine detail.`
- API 400, 401, 403, 404 and 503 JSON errors are displayed verbatim; crop remains retryable. Session/CSRF/role failures do not manufacture the reported save error.
- Successful upload displays its returned URL. A subsequent unrelated settings save omitting `header` preserves it. A fresh GET with top-level `header` restores the saved preview after reload. The settings handler already passes RPC data through correctly.

## Verification

- `corepack pnpm check`: passed, zero errors, zero warnings, 60 existing diagnostic hints.
- `corepack pnpm lint`: passed.
- `corepack pnpm format:check`: passed.
- `corepack pnpm test:unit`: 235 files passed, 4121 tests passed.
- New Chromium and WebKit settings suite: 48 passed.
- Existing settings header suite: 8 passed.
- Existing public profile header suite: 8 passed, 2 optional screenshot tests skipped.

The reported iPhone's post-fix failure is not conclusively diagnosed. No new POST means no new response from this handler carrying the exact save error. Existing error state is reproducible, while unsupported images, failed encoding and pre-function network errors have distinct messages. No production system was inspected or changed.
