# Dependency and runtime decisions

Pinned development/CI Node: 24.21.0. Vercel runtime: 24.x. pnpm: 12.6.0.

The first scaffold used Astro6 to match the machine's older Node22.23.1. A real audit rejected that choice because of a critical Astro advisory and high-severity transitive advisories. The reviewed setup instead uses Astro7.4.2, Vercel adapter11.0.16 and React integration7.1.1.

The first Vercel build on Node22.x used22.23.3, below Astro7's minimum22.23.4, and failed. Node24 avoids depending on immediate platform patch rollout. The local Node24.21.0 binary was downloaded from nodejs.org into the agent scratch directory and its SHA256 matched the official SHASUMS256 manifest. No global runtime or system installation was replaced. Developers install the pinned version using their normal version manager.

## Narrow overrides

- `@vercel/routing-utils>path-to-regexp: 6.3.0` replaces vulnerable6.1.0 with a patched same-major release. Routing-utils currently declares both the older package and a newer alias.
- `esbuild@>=0.27.3 <0.28.1: 0.28.1` addresses the low-severity Windows development-server advisory and is verified by build/test execution.
- `@astrojs/react>@vitejs/plugin-react: 6.1.0` aligns the plugin's oxc-transform-react peer with Astro React's0.145.0 peer. Plugin6.1.2 requires0.152.0 while the integration still requires0.145.0. Pinning the compatible plugin avoids unresolved peers.

Revisit these overrides on dependency updates. Remove only after upstream resolution provides patched compatible versions and frozen install, peer checks, full audit, build and browser smoke pass. Do not suppress the audit or declare an ignored vulnerability safe merely because a mock test passes.

Current real local verification after updates: `pnpm verify` passes with 14 unit tests and 6 desktop/mobile browser tests; `pnpm audit --audit-level high` reports no known vulnerabilities; `pnpm peers check` reports no peer issues. Hosted verification is recorded separately in setup-status.md.
