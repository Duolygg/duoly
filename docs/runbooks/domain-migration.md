# Duoly domain migration checkpoint

## Completed cutover: 2026-10-21T22:36:43+0200

The owner approved the domain cutover and saved the Namecheap web DNS records. The agent rechecked Vercel's live recommendations, then activated both aliases and certificates against production deployment `dpl_EhBubZytDjfgPkuyLvPGjKod8J7c`, released code `9370d9c6fa8cdaebf48ab3ef248e9b17a180acae`.

- Primary public URL: **https://duoly.gg**. The new Astro design demo is served without Vercel login.
- `https://www.duoly.gg` returns HTTP 308 to the apex, preserving paths and query strings. HTTP redirects to HTTPS. Both certificates validate.
- Authoritative apex A records: `216.150.1.1` and `216.150.16.1`. Both Cloudflare and Google public resolvers return this set.
- `www` CNAME: `56a5b35a0a5c88d7.vercel-dns-016.com.`
- Apex MX, TXT and nameservers match the pre-cutover snapshot exactly. No nameserver migration or mail-provider change was made.
- Actual anonymous acceptance on duoly.gg passed 19 HTTP checks and 26 desktop/mobile browser views with no runtime/console errors, broken loaded imagery or horizontal overflow. Robots meta remains noindex/nofollow and robots.txt disallows all indexing.
- Both custom aliases were read back against the exact production deployment ID. Vercel reports both DNS configurations as not misconfigured.
- The secondary public URL https://duoly-pi.vercel.app remains available. Developer previews remain authenticated. Future production releases and custom-domain promotion remain manual.
- The site is still a sample-data design demo. Accounts, payments and persistent business operations remain disconnected. Domain cutover did not activate those services.

### Rollback

The previous apex A was `34.111.179.208`. Restore that web record only with owner approval and first confirm the old Replit deployment is still healthy. The old app was not deleted. Preserve mail and nameserver records. There was no www web record in the initial snapshot. DNS rollback may take time to propagate and is separate from rolling back a Vercel deployment.

## Historical preparation snapshot

Recorded 21 October 2026. No authoritative DNS changes made.

## Completed

- Vercel Git connection succeeded and exact project readback confirms GitHub Duolygg/duoly, production branch main.
- Added duoly.gg to Vercel project duoly, verified ownership by provider.
- Added www.duoly.gg with a 308 redirect to duoly.gg, exact readback confirmed.
- Both remain DNS-misconfigured in Vercel because current authoritative web records still point elsewhere.
- All-deployment Vercel Authentication remains enabled. Custom-domain automatic assignment remains disabled. No production promotion or customer-domain cutover performed.
- Git-based preview creation is explicitly enabled in project settings. Production branch auto-deploy is disabled by `git.deploymentEnabled.main = false` in vercel.json, with a regression test. Other branches retain Vercel's documented default of enabled. Do not remove this gate until release approval.

## Current DNS and rollback data

Authoritative nameservers:

- dns1.registrar-servers.com.
- dns2.registrar-servers.com.

Current apex A: 34.111.179.208 (existing Replit-connected site). HTTPS returned200.
No apex AAAA returned. No www CNAME or A returned in the initial check. No CAA returned.

Current apex MX, preserve:

- priority10 eforward1.registrar-servers.com.
- priority10 eforward2.registrar-servers.com.
- priority10 eforward3.registrar-servers.com.
- priority15 eforward4.registrar-servers.com.
- priority20 eforward5.registrar-servers.com.

Current apex TXT, preserve until migration explicitly reviewed:

- replit-verify=ed6e4205-c57e-478e-8982-1729ab319f69
- v=spf1 include:spf.efwd.registrar-servers.com ~all

This is a public DNS snapshot, not a full registrar-zone export. Obtain a complete zone export before any nameserver migration. Do not replace existing MX with Resend until the inbound handler and forwarding destination are ready.

## Exact Vercel-recommended web records at inspection

Recommended apex IPv4 set, rank1: 216.150.1.1 and216.150.16.1. Rank2 fallback76.76.21.21.
Recommended www CNAME, rank1: 56a5b35a0a5c88d7.vercel-dns-016.com. Rank2 fallback cname.vercel-dns.com.

Re-read /v6/domains/duoly.gg/config and /v6/domains/www.duoly.gg/config immediately before editing. Use returned values, not generic remembered records.

## Approved cutover timing

The owner explicitly selected: prepare the domain now, switch off Replit when the new site is ready. Keep current web DNS and the Replit site unchanged until a separately approved cutover. The new deployment is a protected technical foundation, not a product launch. Confirm DNS account access and an approved release target before any later web-record change. Current main is README bootstrap and the application remains in PR7; attaching DNS alone is insufficient.

Prefer minimal web A/CNAME edits at the existing DNS provider for this cutover; preserve nameservers and mail records. A future Vercel DNS migration requires a full zone export and separate approval to avoid mail disruption.
