# IndexNow

Run manually **after a production deployment** that adds or changes public pages. Wait until the deployed URLs, sitemap and key file return the new content. This is a discovery notification, not proof of crawling, indexing or ranking. It is intentionally absent from CI and `vercel.json`.

Public verification file: `public/ef93dbc5aa33702f80250d826948b1cf.txt`. It must return HTTP 200 at `https://duoly.gg/ef93dbc5aa33702f80250d826948b1cf.txt` with the key as its text. The key is public, not an API secret.

With the project Node version, notify specific changed canonical URLs:

```sh
node scripts/indexnow.mjs \
  https://duoly.gg/games/league-of-legends/play-with-someone \
  https://duoly.gg/games/marvel-rivals/duo-partner \
  https://duoly.gg/games/pokemon-unite/teammate
```

Without arguments, the script fetches `https://duoly.gg/sitemap.xml` and submits its URL locations:

```sh
node scripts/indexnow.mjs
```

Use the explicit list for routine changes. Submit only meaningful public changes, never private order, checkout or account URLs. The script deduplicates URLs, accepts only absolute HTTPS URLs on duoly.gg and enforces the protocol's 10000 URL limit. It posts JSON to `https://api.indexnow.org/indexnow` with the host, key, keyLocation and urlList. It prints the HTTP response status and fails on unsuccessful responses. HTTP 200 means the submission was received; 202 means the key validation is pending. Neither means a URL is indexed. On a 403, check the public key file; on a 422, check the URLs; on a 429, wait before retrying.

## Verify in Bing Webmaster Tools

1. Open the verified duoly.gg property in [Bing Webmaster Tools](https://www.bing.com/webmasters/). Import the property from Search Console if it has not been added.
2. Open the IndexNow section and look for the submitted URLs and their receipt time after running the command. Reporting can lag.
3. Use URL Inspection on each priority page to check discovery, crawl and index status. Inspect the canonical URL and resolve any access or indexing errors separately.
4. Keep `https://duoly.gg/sitemap.xml` submitted in Sitemaps and retain honest content revision dates. Recheck important URLs after Bing has crawled them.

No production notification was sent while implementing this feature. Unit tests replace network requests with mocked responses.
