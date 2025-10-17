import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { URL } from "node:url";

export const OAUTH_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

export type OAuthErrorCode = "missing_token" | "invalid_token" | "insufficient_scope" | "configuration";

export class OAuthError extends Error {
  public readonly code: OAuthErrorCode;
  public readonly details?: unknown;

  constructor(message: string, code: OAuthErrorCode, details?: unknown) {
    super(message);
    this.name = "OAuthError";
    this.code = code;
    this.details = details;
  }
}

export type OAuthConfig = {
  issuer: string;
  jwksUri: string;
  resourceIndicator: string;
  requiredScopes: string[];
  optionalScopes: string[];
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  registrationEndpoint?: string;
  resourceDocumentation?: string;
  audience?: string;
};

const scopeSplitter = /[\s,]+/;

const normalizeScopes = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(scopeSplitter)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
};

const ensureUrl = (value: string, fieldName: string): string => {
  const trimmed = value.trim();
  try {
    // Parse to validate but return the caller-provided representation so token claims match exactly.
    // URL constructor throws on invalid inputs (missing protocol, hostname, etc.).
    const url = new URL(trimmed);
    if (!url.protocol || !url.hostname) {
      throw new Error("URL must include protocol and hostname");
    }
    return trimmed;
  } catch (error) {
    throw new OAuthError(`Invalid URL for ${fieldName}: ${value}`, "configuration", error);
  }
};

const resolveJwksUri = (issuer: string, override?: string): string => {
  if (override && override.trim().length > 0) {
    return ensureUrl(override.trim(), "NEONVIDEO_OAUTH_JWKS_URL");
  }

  return new URL("/.well-known/jwks.json", ensureUrl(issuer, "NEONVIDEO_OAUTH_ISSUER_URL")).toString();
};

export const loadOAuthConfig = (): OAuthConfig | null => {
  const issuer = process.env.NEONVIDEO_OAUTH_ISSUER_URL?.trim();
  const resourceIndicator = process.env.NEONVIDEO_OAUTH_RESOURCE?.trim();

  if (!issuer || !resourceIndicator) {
    return null;
  }

  const jwksUri = resolveJwksUri(issuer, process.env.NEONVIDEO_OAUTH_JWKS_URL);
  const resolvedResource = ensureUrl(resourceIndicator, "NEONVIDEO_OAUTH_RESOURCE");

  const requiredScopes = normalizeScopes(process.env.NEONVIDEO_OAUTH_REQUIRED_SCOPES);
  const optionalScopes = normalizeScopes(process.env.NEONVIDEO_OAUTH_OPTIONAL_SCOPES);

  const authorizationEndpoint = process.env.NEONVIDEO_OAUTH_AUTHORIZATION_ENDPOINT?.trim();
  const tokenEndpoint = process.env.NEONVIDEO_OAUTH_TOKEN_ENDPOINT?.trim();
  const registrationEndpoint = process.env.NEONVIDEO_OAUTH_REGISTRATION_ENDPOINT?.trim();
  const resourceDocumentation = process.env.NEONVIDEO_OAUTH_RESOURCE_DOCUMENTATION?.trim();
  const audience = process.env.NEONVIDEO_OAUTH_AUDIENCE?.trim();

  return {
    issuer: ensureUrl(issuer, "NEONVIDEO_OAUTH_ISSUER_URL"),
    jwksUri,
    resourceIndicator: resolvedResource,
    requiredScopes,
    optionalScopes,
    authorizationEndpoint: authorizationEndpoint ? ensureUrl(authorizationEndpoint, "NEONVIDEO_OAUTH_AUTHORIZATION_ENDPOINT") : undefined,
    tokenEndpoint: tokenEndpoint ? ensureUrl(tokenEndpoint, "NEONVIDEO_OAUTH_TOKEN_ENDPOINT") : undefined,
    registrationEndpoint: registrationEndpoint ? ensureUrl(registrationEndpoint, "NEONVIDEO_OAUTH_REGISTRATION_ENDPOINT") : undefined,
    resourceDocumentation: resourceDocumentation
      ? ensureUrl(resourceDocumentation, "NEONVIDEO_OAUTH_RESOURCE_DOCUMENTATION")
      : undefined,
    audience: audience && audience.length > 0 ? audience : undefined
  };
};

const jwksClientCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const getRemoteJwks = (jwksUri: string) => {
  let jwks = jwksClientCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksClientCache.set(jwksUri, jwks);
  }

  return jwks;
};

const uniqueScopes = (scopes: string[]): string[] => {
  return Array.from(new Set(scopes));
};

const extractScopes = (payload: JWTPayload): string[] => {
  const claims = payload as Record<string, unknown>;
  const accumulator: string[] = [];
  const candidateValues: Array<unknown> = [
    claims.scope,
    claims.scopes,
    claims.scp,
    claims.permissions,
    claims.roles
  ];

  for (const candidate of candidateValues) {
    if (!candidate) {
      continue;
    }

    if (Array.isArray(candidate)) {
      for (const value of candidate) {
        if (typeof value === "string" && value.trim().length > 0) {
          accumulator.push(value.trim());
        }
      }
      continue;
    }

    if (typeof candidate === "string" && candidate.trim().length > 0) {
      accumulator.push(
        ...candidate
          .split(scopeSplitter)
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      );
    }
  }

  return uniqueScopes(accumulator);
};

const sanitizeChallengeValue = (value: string): string => value.replace(/"/g, "'");

export const getProtectedResourceMetadataUrl = (config: OAuthConfig): string => {
  return new URL(OAUTH_PROTECTED_RESOURCE_PATH, config.resourceIndicator).toString();
};

export const buildBearerChallenge = (
  config: OAuthConfig,
  options?: {
    error?: string;
    description?: string;
  }
): string => {
  const parts: string[] = [
    `authorization_uri="${sanitizeChallengeValue(getProtectedResourceMetadataUrl(config))}"`,
    `realm="${sanitizeChallengeValue(config.resourceIndicator)}"`
  ];

  if (config.requiredScopes.length > 0) {
    parts.push(`scope="${sanitizeChallengeValue(config.requiredScopes.join(" "))}"`);
  }

  if (options?.error) {
    parts.push(`error="${sanitizeChallengeValue(options.error)}"`);
  }

  if (options?.description) {
    parts.push(`error_description="${sanitizeChallengeValue(options.description)}"`);
  }

  return `Bearer ${parts.join(", ")}`;
};

export const getProtectedResourceMetadata = (config: OAuthConfig): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {
    resource: config.resourceIndicator,
    authorization_servers: [config.issuer]
  };

  if (config.requiredScopes.length > 0) {
    metadata.resource_scopes = config.requiredScopes;
  }

  const supportedScopes = uniqueScopes([...config.requiredScopes, ...config.optionalScopes]);
  if (supportedScopes.length > 0) {
    metadata.scopes_supported = supportedScopes;
  }

  if (config.authorizationEndpoint) {
    metadata.authorization_endpoint = config.authorizationEndpoint;
  }

  if (config.tokenEndpoint) {
    metadata.token_endpoint = config.tokenEndpoint;
  }

  if (config.registrationEndpoint) {
    metadata.registration_endpoint = config.registrationEndpoint;
  }

  if (config.resourceDocumentation) {
    metadata.resource_documentation = config.resourceDocumentation;
  }

  return metadata;
};

const resolveClientId = (payload: JWTPayload): string => {
  const claims = payload as Record<string, unknown>;
  const candidates = [claims.azp, claims.client_id, claims.clientId];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "unknown-client";
};

export const verifyAccessToken = async (token: string, config: OAuthConfig): Promise<AuthInfo> => {
  if (!token || token.trim().length === 0) {
    throw new OAuthError("Missing access token", "missing_token");
  }

  const jwks = getRemoteJwks(config.jwksUri);

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience ?? config.resourceIndicator
    });

    const scopes = extractScopes(payload);

    if (config.requiredScopes.length > 0) {
      const missingScopes = config.requiredScopes.filter((scope) => !scopes.includes(scope));
      if (missingScopes.length > 0) {
        throw new OAuthError(
          `Access token is missing required scope(s): ${missingScopes.join(", ")}`,
          "insufficient_scope",
          { missingScopes }
        );
      }
    }

    const extra: Record<string, unknown> = { claims: payload };
    if (payload.sub) {
      extra.subject = payload.sub;
    }

    const authInfo: AuthInfo = {
      token,
      clientId: resolveClientId(payload),
      scopes,
      expiresAt: typeof payload.exp === "number" ? payload.exp : undefined,
      resource: new URL(config.resourceIndicator),
      extra
    };

    return authInfo;
  } catch (error) {
    if (error instanceof OAuthError) {
      throw error;
    }

    throw new OAuthError("Invalid access token", "invalid_token", error);
  }
};
