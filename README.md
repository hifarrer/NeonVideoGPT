# NeonVideo.AI ChatGPT App

NeonVideo.AI is a ChatGPT app that lets users launch NeonVideo music-video jobs and watch the results without leaving the conversation. It uses the Apps SDK conventions from `APPS_SDK.md`, the MCP TypeScript server patterns from `MCP_TS_SDK.md`, and the external API contract in `API_DOC.md`.

## Project layout

- `src/server.ts` &mdash; MCP server that exposes the `neonvideo_action` tool and serves the widget resource.
- `web/neonvideo-widget.html` &mdash; Skybridge HTML template that renders the inline UI and talks to `window.openai`.
- `package.json`, `tsconfig.json` &mdash; TypeScript build/runtime configuration.

## Prerequisites

- Node.js 18 or newer (for native `fetch` support).
- NeonVideo account plus either:
  - an OAuth 2.1 authorization server configured for NeonVideo (recommended), or
  - a static JWT token (see `API_DOC.md` for temporary/manual workflows).

## Install dependencies

```bash
npm install
```

## Configuration

Set the following environment variables before starting the server:

| Variable | Purpose |
| --- | --- |
| `NEONVIDEO_API_BASE_URL` | Optional override for the NeonVideo API origin (defaults to `https://neonvideo.ai`). |
| `NEONVIDEO_AUTH_TOKEN` | Bearer token forwarded to the NeonVideo API (`Authorization: Bearer <token>`). |
| `NEONVIDEO_AUTH_COOKIE` | Optional cookie-based credential (sent as `auth_token=<token>`). |
| `NEONVIDEO_API_TIMEOUT_MS` | Optional request timeout in milliseconds (defaults to `60000`). |

You can also provide an `authToken` per call from the widget; it is held in-memory for the current iframe session only.

### OAuth settings

Set these in addition to the base settings to enable OAuth 2.1 token verification (all URLs must be absolute):

| Variable | Purpose |
| --- | --- |
| `NEONVIDEO_OAUTH_ISSUER_URL` | **Required.** Issuer URL for your OAuth authorization server (also used for discovery). |
| `NEONVIDEO_OAUTH_RESOURCE` | **Required.** Fully qualified resource indicator for this MCP endpoint (for example `https://your-domain.example/mcp`). |
| `NEONVIDEO_OAUTH_REQUIRED_SCOPES` | Space-separated scopes that must be present on accepted access tokens. |
| `NEONVIDEO_OAUTH_JWKS_URL` | Optional override for the JWKS document; defaults to `<issuer>/.well-known/jwks.json`. |
| `NEONVIDEO_OAUTH_AUTHORIZATION_ENDPOINT` | Optional hint included in the protected-resource metadata. |
| `NEONVIDEO_OAUTH_TOKEN_ENDPOINT` | Optional token endpoint URL included in the metadata. |
| `NEONVIDEO_OAUTH_REGISTRATION_ENDPOINT` | Optional dynamic client registration endpoint exposed to ChatGPT. |
| `NEONVIDEO_OAUTH_OPTIONAL_SCOPES` | Additional scopes to advertise in metadata but not enforce. |
| `NEONVIDEO_OAUTH_AUDIENCE` | Optional explicit audience claim to validate (defaults to `NEONVIDEO_OAUTH_RESOURCE`). |
| `NEONVIDEO_OAUTH_RESOURCE_DOCUMENTATION` | Optional link to human-readable docs for the protected resource. |

When configured, the server exposes `/.well-known/oauth-protected-resource`, which ChatGPT uses to discover your authorization server and scopes.

## Run the MCP server

```bash
npm run dev
```

This starts the Streamable HTTP transport on `http://localhost:3000/mcp` as described in `MCP_TS_SDK.md`. Point an MCP Inspector or the ChatGPT Apps connector to that endpoint to exercise the tool.

## Tool behavior

- **`help`** &mdash; surfaces available slash commands and usage tips inside the widget.
- **`generate_video`** &mdash; posts the user prompt to `POST /api/neon-single-prompt` (`API_DOC.md`) and returns the project metadata.
- **`check_status`** &mdash; polls `GET /api/projects/{projectId}` so users can refresh progress or load the final video.

Each response includes structured content (`window.openai.toolOutput`) plus prose `content` so the assistant can narrate results, matching the guidance in `APPS_SDK.md`.

## Widget highlights

- Renders help, status, and error states inline with glassmorphism styling to echo the "neon" brand.
- Persists the last prompt/project ID with `window.openai.setWidgetState` so follow-up prompts restore context.
- Calls back into the MCP server with `window.openai.callTool` for generation and refresh actions.
- Streams the final video, audio, and scene imagery directly when available.

## Next steps

- Publish OAuth metadata (issuer, JWKS, token, registration) on your authorization server and set the `NEONVIDEO_OAUTH_*` variables accordingly.
- Add automated `tsc` checks or integration tests once dependencies are installed.
- Deploy the MCP server to your hosting of choice and update the ChatGPT app manifest accordingly.



