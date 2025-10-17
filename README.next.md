# NeonVideo.AI OAuth Launch Checklist

This document expands the “Next steps” from the main README into concrete actions to finish the OAuth rollout and harden the deployment.

## 1. Publish OAuth metadata on `https://neonvideo.ai`

1. Host the following discovery endpoints on **HTTPS**:
   - `/.well-known/oauth-protected-resource`
   - `/.well-known/openid-configuration`
   - `/.well-known/jwks.json` (or whatever you point `NEONVIDEO_OAUTH_JWKS_URL` to)
2. Ensure the `authorization_endpoint`, `token_endpoint`, and `registration_endpoint` values in your OpenID configuration match the real URLs.
3. Advertise the scope(s) the MCP server requires (for example `neonvideo.app`), and embed the same scope list in both:
   - the `resource_scopes` field of the protected-resource metadata, and
   - the access tokens returned by your authorization server.
4. After publishing, set these environment variables for the MCP server (all must be absolute URLs):
   ```
   NEONVIDEO_OAUTH_ISSUER_URL=https://neonvideo.ai
   NEONVIDEO_OAUTH_RESOURCE=https://neonvideo.ai/mcp
   NEONVIDEO_OAUTH_REQUIRED_SCOPES=neonvideo.app
   NEONVIDEO_OAUTH_JWKS_URL=https://neonvideo.ai/.well-known/jwks.json
   NEONVIDEO_OAUTH_AUTHORIZATION_ENDPOINT=https://neonvideo.ai/oauth/authorize
   NEONVIDEO_OAUTH_TOKEN_ENDPOINT=https://neonvideo.ai/oauth/token
   NEONVIDEO_OAUTH_REGISTRATION_ENDPOINT=https://neonvideo.ai/oauth/register
   ```
   Adjust the exact paths to match your identity provider.
5. Confirm the endpoints respond correctly by running (replace host if different):
   ```bash
   curl https://neonvideo.ai/.well-known/oauth-protected-resource | jq
   curl https://neonvideo.ai/.well-known/openid-configuration | jq
   curl https://neonvideo.ai/.well-known/jwks.json | jq
   ```

## 2. Decommission static secrets after OAuth is live

1. Verify ChatGPT can complete the OAuth dance:
   - Connect the app.
   - Trigger the tool and confirm the prompt opens the consent screen.
   - Complete consent and ensure tool calls succeed without `NEONVIDEO_AUTH_TOKEN` / `NEONVIDEO_AUTH_COOKIE` set.
2. Remove the legacy secrets from every deployment environment (env vars, secret managers, CI/CD configuration).
3. Update internal runbooks to note that user-level tokens are issued dynamically; operators should troubleshoot via the OAuth provider rather than distributing static API keys.

## 3. Add an automated integration test

1. Create a test script (Node, Python, or bash) that:
   - Calls the protected-resource metadata endpoint and validates required fields.
   - Fetches a short-lived access token from your OAuth server (use the client credentials grant or a dedicated test account).
   - Exercises the MCP `/mcp` endpoint with the token and asserts a 200 response.
2. Wire the script into CI so every deploy verifies the metadata and token flow.
3. Optional: add a regression test that intentionally omits the token and asserts the server returns `401` with a `WWW-Authenticate` challenge, ensuring auth failures signal the client properly.

Following this checklist ensures the OAuth flow is production-ready, removes reliance on static credentials, and adds guardrails that detect drift before it breaks users. When everything passes, you can update the ChatGPT manifest to mark the app as OAuth-protected. 
