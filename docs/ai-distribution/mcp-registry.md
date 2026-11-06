# Registry publication draft

No registry publication or ownership change has been performed. `server.json` is a remote-only draft for the parallel MCP implementation. Version `0.1.0` is a proposed first metadata release, not evidence of a deployed release. Choose an unused release version at publication time.

## Official MCP Registry

Checked 6 November 2026:

- [Remote servers](https://modelcontextprotocol.io/registry/remote-servers) documents `remotes`, `streamable-http` and a public HTTPS endpoint. A hosted server does not require an npm package.
- [Authentication](https://modelcontextprotocol.io/registry/authentication) permits reverse-DNS namespaces with DNS or HTTP ownership proof. `gg.duoly/gaming` is the draft identity for the owned domain `duoly.gg`.
- [Quickstart](https://modelcontextprotocol.io/registry/quickstart) currently points to the [2025-12-11 JSON schema](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json). Registry schema version and MCP protocol revision are separate values. Recheck the official schema before publication.

The alternate `io.github.duolygg/gaming` identity requires GitHub authentication with permission for that organization. Confirm actual registry authorization and namespace case rules before choosing it. Do not publish both identities for the same service without a reason. Domain ownership avoids relying on a personal GitHub username. Repository metadata is omitted because backend source publication is unnecessary and a private repository should not be advertised as a public install artifact.

### Owner procedure, after deployment approval

1. Confirm the endpoint responds to MCP initialization, tool discovery and every tool call using the deployed schemas. Verify public docs, privacy and terms, price consistency, Social exclusion, no account requirement and rate limits.
2. Install the official `mcp-publisher` using the [quickstart](https://modelcontextprotocol.io/registry/quickstart), review the current binary release and run `mcp-publisher --help`.
3. Copy the draft to a local release workspace outside this checkout. Fetch the schema named in `$schema` and validate it with a JSON Schema Draft 7 capable validator (the fetched schema declares Draft 7). Confirm the exact release version is unused. Do not add an npm package solely for this remote endpoint.
4. Choose domain authentication. Follow the official DNS or HTTP instructions to generate an ownership proof. Keep the private signing key outside this repository and out of shell history and logs. DNS changes or a new `/.well-known/mcp-registry-auth` file need separate owner authorization and implementation; this PR adds neither.
5. Authenticate with the documented `mcp-publisher login dns` or `mcp-publisher login http` flow for `duoly.gg`. Inspect `server.json` and the CLI's current options. Only the owner runs `mcp-publisher publish` from the release workspace.
6. Read back `https://registry.modelcontextprotocol.io/v0.1/servers?search=gg.duoly%2Fgaming`. Match exact server name, version, remote transport and URL. Record the returned metadata and listing URL. A successful command alone is insufficient.
7. Publish subsequent changes using unique versions. The registry remains a preview and may change. Confirm downstream visibility individually; publication does not guarantee GitHub, Claude, Google or ChatGPT listing or commerce eligibility.

## Smithery

Source: [Publish](https://smithery.ai/docs/build/publish.md), as referenced in the supplied store research. Recheck its live flow before use.

1. Owner signs in and selects the hosted HTTPS server publishing route.
2. Supply `https://duoly.gg/mcp`, Duoly name, description, support and public documentation from the Claude draft. Set Streamable HTTP and no authentication for public v1.
3. Allow tool discovery and inspect the scan. Resolve annotation and reachability errors; use a server card only if the current guide requires it for scan failures.
4. Review gateway proxying, logging, retention, usage economics and any required permissions before routing production calls. Approve only first-party-owned metadata and domains.
5. Owner publishes after policy and technical gates pass, then opens the exact listing and calls each exposed tool through the intended client. Record whether the connection uses Smithery Gateway or the direct endpoint. Check official-vendor verification separately.

## Glama

Source: [MCP FAQ](https://glama.ai/mcp/faq), as referenced in the supplied store research. Recheck its live flow before use.

1. Owner chooses hosted connector submission with `https://duoly.gg/mcp`. The GitHub source route is optional for open-source servers and is not required for this private implementation.
2. Supply listing copy, Streamable HTTP, public no-auth v1 instructions, support and policy links. No testing credentials are needed for public tools.
3. Complete namespace or domain ownership verification through the supported current flow after owner authorization.
4. Inspect automated health and indexing results. Pending or unhealthy is not published. Review proxy logging and credential custody before enabling a gateway.
5. Read back the exact listing, endpoint, tools and working calls after publication. Save evidence outside this repository. Directory inclusion does not permit transactions in any assistant.
