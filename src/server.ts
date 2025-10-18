import "dotenv/config";
import express, { type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { decodeJwt } from "jose";
import { z } from "zod";
import {
  buildBearerChallenge,
  getProtectedResourceMetadata,
  getProtectedResourceMetadataUrl,
  loadOAuthConfig,
  OAuthError,
  OAUTH_PROTECTED_RESOURCE_PATH,
  verifyAccessToken
} from "./oauth.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT_DIR, "web");

const APP_NAME = "NeonVideo.AI";
const API_BASE_URL = process.env.NEONVIDEO_API_BASE_URL ?? "https://neonvideo.ai";
const CREATE_ENDPOINT = "/api/neon-single-prompt";
const STATUS_ENDPOINT = "/api/neon-single-prompt/status";
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.NEONVIDEO_API_TIMEOUT_MS ?? "60000", 10);

const DEFAULT_AUTH_TOKEN = process.env.NEONVIDEO_AUTH_TOKEN;
const DEFAULT_AUTH_COOKIE = process.env.NEONVIDEO_AUTH_COOKIE;

const NeonVideoActionSchema = z.object({
  action: z
    .enum(["help", "generate_video", "check_status"])
    .describe("NeonVideo.AI action to execute")
    .default("help"),
  prompt: z
    .string()
    .trim()
    .min(1, "A detailed prompt is required when action is generate_video")
    .optional()
    .describe("Detailed natural language description of the desired music video"),
  projectId: z
    .string()
    .trim()
    .min(1, "Project ID is required when checking status")
    .optional()
    .describe("Identifier returned by the NeonVideo API"),
  authToken: z
    .string()
    .trim()
    .min(1, "Auth token cannot be empty")
    .optional()
    .describe("Override bearer token to reach the NeonVideo API")
});

const NeonVideoErrorDetailSchema = z.object({
  type: z.enum(["auth", "validation", "network", "api", "unknown"]),
  message: z.string(),
  details: z.string().optional(),
  status: z.number().optional()
});

const NeonVideoHelpSchema = z.object({
  view: z.literal("help"),
  title: z.string(),
  timestamp: z.string(),
  commands: z.array(
    z.object({
      syntax: z.string(),
      description: z.string()
    })
  ),
  usageNotes: z.array(z.string())
});

const NeonVideoStatusSchema = z.object({
  view: z.literal("status"),
  projectId: z.string(),
  prompt: z.string(),
  message: z.string(),
  status: z.enum(["queued", "generating", "complete", "error"]),
  pollUrl: z.string().url(),
  checkedAt: z.string(),
  finalVideoUrl: z.string().url().nullable().optional(),
  audioUrl: z.string().url().nullable().optional(),
  sceneImages: z.array(z.string().url()).optional(),
  scenePrompts: z.array(z.string()).optional(),
  creditsRemaining: z.number().optional(),
  creditsRequired: z.number().optional(),
  error: NeonVideoErrorDetailSchema.optional()
});

const NeonVideoErrorSchema = z.object({
  view: z.literal("error"),
  timestamp: z.string(),
  error: NeonVideoErrorDetailSchema
});

const NeonVideoOutputSchema = z.union([NeonVideoHelpSchema, NeonVideoStatusSchema, NeonVideoErrorSchema]);

type NeonVideoActionInput = z.infer<typeof NeonVideoActionSchema>;
type NeonVideoStructuredContent = z.infer<typeof NeonVideoOutputSchema>;
type NeonVideoErrorDetail = z.infer<typeof NeonVideoErrorDetailSchema>;

const server = new McpServer({
  name: "neonvideo-ai",
  version: "0.1.0"
});

const summarizeToken = (token: string): string => {
  if (!token) {
    return "<empty>";
  }
  const lead = token.slice(0, 12);
  const tail = token.slice(-8);
  return `${lead}...${tail}`;
};

const loadWidgetTemplate = (): string => {
  const widgetPath = path.join(WEB_DIR, "neonvideo-widget.html");
  try {
    return readFileSync(widgetPath, "utf8").trim();
  } catch (error) {
    console.error(`[${APP_NAME}] Failed to load widget template at ${widgetPath}`, error);
    throw new Error(`Missing NeonVideo widget template at ${widgetPath}`);
  }
};

const widgetTemplate = loadWidgetTemplate();

const toAbsoluteUrl = (relativePath: string): string => {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  return new URL(relativePath.replace(/^\//, ""), base).toString();
};

type FetchInput = Parameters<typeof fetch>[0];
type FetchOptions = Parameters<typeof fetch>[1];

const oauthConfig = (() => {
  try {
    return loadOAuthConfig();
  } catch (error) {
    if (error instanceof OAuthError) {
      console.error(`[${APP_NAME}] OAuth configuration error: ${error.message}`);
    } else {
      console.error(`[${APP_NAME}] Unexpected OAuth configuration error`, error);
    }
    return null;
  }
})();

const oauthEnabled = oauthConfig !== null;
const oauthMetadataUrl = oauthConfig ? getProtectedResourceMetadataUrl(oauthConfig) : undefined;
const oauthMetadata = oauthConfig ? getProtectedResourceMetadata(oauthConfig) : null;

if (oauthConfig) {
  console.log(
    `[${APP_NAME}] Loaded OAuth config issuer=${oauthConfig.issuer} resource=${oauthConfig.resourceIndicator} audience=${oauthConfig.audience ?? "<default>"}`
  );
  console.log(`[${APP_NAME}] OAuth JWKS URL: ${oauthConfig.jwksUri}`);
}

const buildChallenge = (options?: { error?: string; description?: string }) => {
  if (!oauthConfig) {
    return undefined;
  }
  return buildBearerChallenge(oauthConfig, options);
};

const buildChallengeMeta = (options?: { error?: string; description?: string }) => {
  const challenge = buildChallenge(options);
  if (!challenge) {
    return undefined;
  }

  return {
    "mcp/www_authenticate": challenge
  };
};

if (!oauthEnabled) {
  console.warn(
    `[${APP_NAME}] OAuth is not configured. Set NEONVIDEO_OAUTH_* environment variables to enable authorization checks.`
  );
}

const withTimeout = async (request: FetchInput, init: FetchOptions = {}, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { ...init, signal: controller.signal });
    return response;
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const respondUnauthorized = (
  res: Response,
  options: {
    error?: string;
    description?: string;
  } = {}
) => {
  const challenge = buildChallenge({
    error: options.error,
    description: options.description
  });

  if (challenge) {
    res.setHeader("WWW-Authenticate", challenge);
  }

  res.status(401).json({
    error: options.description ?? "Authentication required."
  });
};

const buildHeaders = (authToken?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const token = authToken ?? DEFAULT_AUTH_TOKEN;
  const cookie = DEFAULT_AUTH_COOKIE;

  if (token) {
    headers["Authorization"] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }

  if (cookie) {
    headers["Cookie"] = cookie.includes("auth_token=") ? cookie : `auth_token=${cookie}`;
  }

  return headers;
};

const nowIso = (): string => new Date().toISOString();

const asErrorContent = (error: NeonVideoErrorDetail, overrides?: Partial<NeonVideoStructuredContent>): NeonVideoStructuredContent => {
  return {
    view: "error",
    timestamp: nowIso(),
    error,
    ...(overrides ?? {})
  } as NeonVideoStructuredContent;
};

const oauthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  if (!oauthEnabled || !oauthConfig) {
    return next();
  }

  const authorization = req.headers.authorization;
  console.log(
    `[${APP_NAME}] OAuth middleware processing ${req.method} ${req.originalUrl} (auth header present: ${
      Boolean(authorization)
    })`
  );
  if (!authorization) {
    respondUnauthorized(res, {
      error: "invalid_request",
      description: "Authorization header with a Bearer token is required."
    });
    return;
  }

  const [scheme, ...rest] = authorization.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || rest.length === 0) {
    respondUnauthorized(res, {
      error: "invalid_request",
      description: "Authorization header must use the Bearer scheme."
    });
    return;
  }

  const token = rest.join(" ").trim();
  if (token.length === 0) {
    respondUnauthorized(res, {
      error: "invalid_request",
      description: "Bearer token cannot be empty."
    });
    return;
  }

  try {
    const authInfo = await verifyAccessToken(token, oauthConfig);
    console.log(
      `[${APP_NAME}] OAuth token verified for client=${authInfo.clientId} scopes=${authInfo.scopes.join(
        " "
      )} expiresAt=${authInfo.expiresAt ?? "<undefined>"}`
    );
    req.auth = authInfo;
    return next();
  } catch (error) {
    if (error instanceof OAuthError) {
      let debugDescription: string | undefined;
      let decodedIss: string | undefined;
      let decodedAud: unknown;
      let decodedExp: number | undefined;
      if (error.code === "invalid_token") {
        const tokenPreview = summarizeToken(token);
        try {
          const decoded = decodeJwt(token);
          decodedIss = typeof decoded.iss === "string" ? decoded.iss : undefined;
          decodedAud = (decoded as Record<string, unknown>).aud ?? undefined;
          decodedExp = typeof decoded.exp === "number" ? decoded.exp : undefined;
          console.warn(
            `[${APP_NAME}] OAuth verification failed: ${error.message}; token=${tokenPreview}; iss=${decoded.iss}; aud=${JSON.stringify(
              decoded.aud ?? null
            )}; exp=${decoded.exp}`
          );
        } catch (decodeError) {
          console.warn(
            `[${APP_NAME}] OAuth verification failed: ${error.message}; token=${tokenPreview}; unable to decode JWT`,
            decodeError
          );
        }
        if (!debugDescription) {
          debugDescription = `token=${tokenPreview}; iss=${decodedIss ?? "undefined"}; aud=${JSON.stringify(
            decodedAud ?? null
          )}; exp=${decodedExp ?? "undefined"}`;
        }
      } else {
        console.warn(`[${APP_NAME}] OAuth verification failed: ${error.message}`);
      }
      if (error.code === "invalid_token" && !debugDescription) {
        const tokenPreview = summarizeToken(token);
        debugDescription = `token=${tokenPreview}; iss=unknown; aud=unknown; exp=unknown`;
      }
      const challengeError =
        error.code === "missing_token"
          ? "invalid_request"
          : error.code === "insufficient_scope"
          ? "insufficient_scope"
          : "invalid_token";

      const description =
        error.code === "insufficient_scope"
          ? "Access token does not include required NeonVideo scopes."
          : debugDescription
          ? `Access token could not be verified (${debugDescription}).`
          : "Access token could not be verified.";

      console.warn(`[${APP_NAME}] OAuth verification failed: ${error.message}`);
      respondUnauthorized(res, {
        error: challengeError,
        description
      });
      return;
    }

    console.error(`[${APP_NAME}] Unexpected error verifying OAuth access token`, error);
    respondUnauthorized(res, {
      error: "invalid_token",
      description: "Unable to verify access token."
    });
  }
};

server.registerResource(
  "neonvideo-widget",
  "ui://widget/neonvideo-player.html",
  {
    title: `${APP_NAME} Widget`,
    description: "Interactive NeonVideo.AI widget for launching jobs and tracking video generation"
  },
  async () => ({
    contents: [
      {
        uri: "ui://widget/neonvideo-player.html",
        mimeType: "text/html+skybridge",
        text: widgetTemplate,
        _meta: {
          "openai/widgetDescription":
            "Displays NeonVideo.AI commands, trigger status updates, and streams completed videos right inside ChatGPT.",
          "openai/widgetPrefersBorder": true
        }
      }
    ]
  })
);

server.registerTool(
  "neonvideo_action",
  {
    title: `${APP_NAME} actions`,
    description: "Generate NeonVideo music videos or retrieve project status.",
    _meta: {
      "openai/outputTemplate": "ui://widget/neonvideo-player.html",
      "openai/toolInvocation/invoking": "Contacting NeonVideo.AI…",
      "openai/toolInvocation/invoked": "NeonVideo.AI responded."
    },
    inputSchema: NeonVideoActionSchema.shape
  },
  async (input, extra) => {
    const actionInput: NeonVideoActionInput = {
      action: input.action ?? "help",
      prompt: input.prompt,
      projectId: input.projectId,
      authToken: input.authToken
    };

    const authInfo = extra?.authInfo;
    const effectiveAuthToken = actionInput.authToken ?? authInfo?.token ?? DEFAULT_AUTH_TOKEN;
    const hasNeonVideoAuth = Boolean(effectiveAuthToken || DEFAULT_AUTH_COOKIE);

    if (actionInput.action === "help") {
      const helpContent: NeonVideoStructuredContent = {
        view: "help",
        title: `${APP_NAME} Commands`,
        timestamp: nowIso(),
        commands: [
          {
            syntax: "@NeonVideo Create a music video of <description>",
            description: "Start a new NeonVideo project using the provided prompt."
          },
          {
            syntax: "@NeonVideo Make a music video about <description>",
            description: "Start a new NeonVideo project using the provided prompt."
          },
          {
            syntax: "@NeonVideo Help",
            description: "Show available commands and authentication guidance."
          }
        ],
        usageNotes: [
          oauthEnabled
            ? "Complete the NeonVideo OAuth prompt in ChatGPT when requested; this issues an access token automatically."
            : "Authenticate at https://neonvideo.ai/ to obtain an auth token before launching new videos.",
          "Each music video consumes credits; ensure your NeonVideo account has enough balance.",
          "Generations typically finish in about 10 minutes; the widget auto-refreshes progress for up to 30 minutes.",
          "For best results, follow the template: Create a music video of [Character] [Video description]."
        ]
      };

      return {
        content: [
          {
            type: "text",
            text: "Here are the NeonVideo.AI commands you can use. Launch a video using the widget below."
          }
        ],
        structuredContent: helpContent
      };
    }

    if (actionInput.action === "generate_video") {
      if (!actionInput.prompt) {
        return {
          content: [
            {
              type: "text",
              text: "Please provide a detailed prompt describing the music video you want NeonVideo.AI to create."
            }
          ],
          structuredContent: asErrorContent({
            type: "validation",
            message: "Prompt is required to create a NeonVideo project."
          })
        };
      }

      const normalizedPrompt = actionInput.prompt.trim();
      const promptWordCount = normalizedPrompt.split(/\s+/).filter((word) => word.length > 0).length;
      const promptHasDetail = promptWordCount >= 8 || normalizedPrompt.length >= 60;
      if (!promptHasDetail) {
        const guidance = "Template: Create a music video of [Character] [Video description]\nExample: Create a music video of a 3D animated cowboy mouse living on a farm.";
        return {
          content: [
            {
              type: "text",
              text: "Please share a more descriptive prompt for NeonVideo.AI.\n" + guidance
            }
          ],
          structuredContent: asErrorContent({
            type: "validation",
            message: "Prompt needs more detail.",
            details: guidance
          })
        };
      }

      if (!hasNeonVideoAuth) {
        const message = oauthEnabled
          ? "NeonVideo.AI requires a valid OAuth session. Reconnect the NeonVideo app to continue."
          : "NeonVideo.AI requires authentication. Set NEONVIDEO_AUTH_TOKEN or NEONVIDEO_AUTH_COOKIE for the MCP server.";
        const meta = oauthEnabled
          ? buildChallengeMeta({
              error: "invalid_token",
              description: "Authenticate with NeonVideo.AI to launch video generation."
            })
          : undefined;
        return {
          content: [
            {
              type: "text",
              text: message
            }
          ],
          structuredContent: asErrorContent({
            type: "auth",
            message
          }),
          ...(meta ? { _meta: meta } : {})
        };
      }

      try {
        const promptPreview = normalizedPrompt.slice(0, 120).replace(/\s+/g, " ").trim();
        const createStarted = Date.now();
        console.log(`[${APP_NAME}] generate_video start prompt="${promptPreview}"`);

        const response = await withTimeout(toAbsoluteUrl(CREATE_ENDPOINT), {
          method: "POST",
          headers: buildHeaders(effectiveAuthToken),
          body: JSON.stringify({ prompt: normalizedPrompt })
        });

        const rawText = await response.text();
        let payload: Record<string, unknown> | null = null;
        try {
          payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
        } catch (_error) {
          payload = null;
        }

        if (!response.ok || !payload) {
          console.warn(`[${APP_NAME}] generate_video failed status=${response.status}`);
          const isUnauthorized = response.status === 401 || response.status === 403;
          const errorDetail: NeonVideoErrorDetail = {
            type: isUnauthorized ? "auth" : "api",
            message:
              (payload?.error as string) ??
              `NeonVideo API returned ${response.status} ${response.statusText}`.trim(),
            details: rawText || undefined,
            status: response.status
          };

          const challengeMeta = isUnauthorized
            ? buildChallengeMeta({
                error: response.status === 403 ? "insufficient_scope" : "invalid_token",
                description:
                  response.status === 403
                    ? "Access token lacks required NeonVideo scopes."
                    : "Access token was rejected by NeonVideo.AI."
              })
            : undefined;

          return {
            content: [
              {
                type: "text",
                text: errorDetail.message
              }
            ],
            structuredContent: asErrorContent(errorDetail),
            ...(challengeMeta ? { _meta: challengeMeta } : {})
          };
        }

        const projectId = String(payload.projectId ?? "");
        const success = payload.success === true || projectId.length > 0;
        if (!projectId || !success) {
          console.warn(`[${APP_NAME}] generate_video missing projectId response=${rawText}`);
          return {
            content: [
              {
                type: "text",
                text: "NeonVideo.AI did not provide a project identifier."
              }
            ],
            structuredContent: asErrorContent({
              type: "api",
              message: "NeonVideo API response was missing expected fields.",
              details: rawText
            })
          };
        }

        const elapsedMs = Date.now() - createStarted;
        console.log(`[${APP_NAME}] generate_video accepted projectId=${projectId} (${elapsedMs}ms)`);

        const statusContent: NeonVideoStructuredContent = {
          view: "status",
          projectId,
          prompt: normalizedPrompt,
          message: String(payload.message ?? "Video generation started"),
          status: "queued",
          pollUrl: toAbsoluteUrl(`${STATUS_ENDPOINT}/${projectId}`),
          checkedAt: nowIso()
        };

        return {
          content: [
            {
              type: "text",
              text: `NeonVideo.AI started generating your video (project ${projectId}). Use the widget to monitor progress.`
            }
          ],
          structuredContent: statusContent
        };
      } catch (error) {
        console.error(`[${APP_NAME}] generate_video encountered error`, error);
        const errorDetail: NeonVideoErrorDetail = {
          type: "network",
          message: error instanceof Error ? error.message : "NeonVideo API request failed."
        };
        return {
          content: [
            {
              type: "text",
              text: errorDetail.message
            }
          ],
          structuredContent: asErrorContent(errorDetail)
        };
      }
    }

    if (actionInput.action === "check_status") {
      if (!actionInput.projectId) {
        return {
          content: [
            {
              type: "text",
              text: "Provide a project ID so I can retrieve the latest status from NeonVideo.AI."
            }
          ],
          structuredContent: asErrorContent({
            type: "validation",
            message: "Project ID is required to check status."
          })
        };
      }

      if (!hasNeonVideoAuth) {
        const message = oauthEnabled
          ? "NeonVideo.AI requires a valid OAuth session before checking project status. Reconnect the app and try again."
          : "Set NEONVIDEO_AUTH_TOKEN or NEONVIDEO_AUTH_COOKIE to check NeonVideo.AI project status.";
        const meta = oauthEnabled
          ? buildChallengeMeta({
              error: "invalid_token",
              description: "Authenticate with NeonVideo.AI to view project status."
            })
          : undefined;
        return {
          content: [
            {
              type: "text",
              text: message
            }
          ],
          structuredContent: asErrorContent({
            type: "auth",
            message
          }),
          ...(meta ? { _meta: meta } : {})
        };
      }

      try {
        const pollStarted = Date.now();
        console.log(`[${APP_NAME}] check_status projectId=${actionInput.projectId}`);

        const response = await withTimeout(toAbsoluteUrl(`${STATUS_ENDPOINT}/${actionInput.projectId}`), {
          method: "GET",
          headers: buildHeaders(effectiveAuthToken)
        });
        const rawText = await response.text();

        let payload: Record<string, unknown> | null = null;
        try {
          payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : null;
        } catch (_error) {
          payload = null;
        }

        if (!response.ok || !payload) {
          console.warn(`[${APP_NAME}] check_status failed projectId=${actionInput.projectId} status=${response.status}`);
          const isUnauthorized = response.status === 401 || response.status === 403;
          const errorDetail: NeonVideoErrorDetail = {
            type: isUnauthorized ? "auth" : "api",
            message:
              (payload?.error as string) ??
              `Failed to fetch project ${actionInput.projectId} (${response.status})`.trim(),
            details: rawText || undefined,
            status: response.status
          };

          const challengeMeta = isUnauthorized
            ? buildChallengeMeta({
                error: response.status === 403 ? "insufficient_scope" : "invalid_token",
                description:
                  response.status === 403
                    ? "Access token lacks required NeonVideo scopes."
                    : "Access token was rejected by NeonVideo.AI."
              })
            : undefined;

          return {
            content: [
              {
                type: "text",
                text: errorDetail.message
              }
            ],
            structuredContent: asErrorContent(errorDetail),
            ...(challengeMeta ? { _meta: challengeMeta } : {})
          };
        }

        const rawStatusSource = payload.status ?? payload.state ?? payload.generationStatus ?? "pending";
        const statusFromApi = String(rawStatusSource).toLowerCase();
        let normalizedStatus: "queued" | "generating" | "complete" | "error";
        if (payload.isCompleted === true || ["completed", "complete", "done", "finished"].includes(statusFromApi)) {
          normalizedStatus = "complete";
        } else if (["failed", "error", "cancelled", "canceled"].includes(statusFromApi)) {
          normalizedStatus = "error";
        } else if (["queued", "pending", "waiting"].includes(statusFromApi)) {
          normalizedStatus = "queued";
        } else {
          normalizedStatus = "generating";
        }

        const finalVideoUrl =
          typeof payload.finalVideoUrl === "string"
            ? payload.finalVideoUrl
            : typeof payload.videoUrl === "string"
            ? payload.videoUrl
            : null;

        if (finalVideoUrl && normalizedStatus !== "error") {
          normalizedStatus = "complete";
        }

        const projectIdValue = String(payload.id ?? actionInput.projectId);
        const promptValue = String(payload.description ?? payload.prompt ?? payload.title ?? actionInput.projectId);
        const messageValue =
          typeof payload.message === "string" ? payload.message : `NeonVideo.AI status: ${statusFromApi || "pending"}`;

        const statusContent: NeonVideoStructuredContent = {
          view: "status",
          projectId: projectIdValue,
          prompt: promptValue,
          message: messageValue,
          status: normalizedStatus,
          pollUrl: toAbsoluteUrl(`${STATUS_ENDPOINT}/${actionInput.projectId}`),
          checkedAt: nowIso(),
          finalVideoUrl: finalVideoUrl ?? null,
          audioUrl:
            typeof payload.audioUrl === "string"
              ? payload.audioUrl
              : typeof payload.songUrl === "string"
              ? payload.songUrl
              : null,
          sceneImages: Array.isArray(payload.sceneImages)
            ? (payload.sceneImages as Array<string>).filter((value) => typeof value === "string")
            : Array.isArray(payload.frames as unknown[])
            ? (payload.frames as Array<string>).filter((value) => typeof value === "string")
            : undefined,
          scenePrompts: Array.isArray(payload.scenePrompts)
            ? (payload.scenePrompts as Array<string>).filter((value) => typeof value === "string")
            : undefined,
          creditsRemaining: typeof payload.creditsRemaining === "number" ? payload.creditsRemaining : undefined,
          creditsRequired: typeof payload.creditsRequired === "number" ? payload.creditsRequired : undefined,
          error:
            normalizedStatus === "error"
              ? {
                  type: "api",
                  message:
                    (payload.error as string) ??
                    (payload.details as string) ??
                    "NeonVideo.AI reported an error while generating the video."
                }
              : undefined
        };

        const pollElapsed = Date.now() - pollStarted;
        console.log(
          `[${APP_NAME}] check_status projectId=${statusContent.projectId} raw=${statusFromApi} normalized=${normalizedStatus} finalVideo=${Boolean(finalVideoUrl)} (${pollElapsed}ms)`
        );

        return {
          content: [
            {
              type: "text",
              text:
                normalizedStatus === "complete"
                  ? `Project ${statusContent.projectId} is complete. Enjoy your NeonVideo!`
                  : `Latest status from NeonVideo.AI: ${statusFromApi || "pending"}.`
            }
          ],
          structuredContent: statusContent
        };
      } catch (error) {
        console.error(`[${APP_NAME}] check_status encountered error`, error);
        const errorDetail: NeonVideoErrorDetail = {
          type: "network",
          message: error instanceof Error ? error.message : "Failed to contact NeonVideo.AI."
        };
        return {
          content: [
            {
              type: "text",
              text: errorDetail.message
            }
          ],
          structuredContent: asErrorContent(errorDetail)
        };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: "Unknown NeonVideo action."
        }
      ],
      structuredContent: asErrorContent({
        type: "unknown",
        message: `Unsupported action ${(input as NeonVideoActionInput)?.action}`
      })
    };
  }
);

const app = express();
app.use(express.json());

app.get(OAUTH_PROTECTED_RESOURCE_PATH, (_req: Request, res: Response) => {
  if (!oauthConfig || !oauthMetadata) {
    res.status(404).json({
      error: "OAuth metadata is not configured for this server."
    });
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  res.json(oauthMetadata);
});

const handleMcpRequest = async (req: Request, res: Response) => {
  if (oauthEnabled && !req.auth) {
    respondUnauthorized(res, {
      error: "invalid_token",
      description: "Access token verification failed."
    });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
};

app.all("/mcp", oauthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await handleMcpRequest(req, res);
  } catch (error) {
    next(error);
  }
});

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
app
  .listen(port, () => {
    console.log(`[${APP_NAME}] MCP server listening on http://localhost:${port}/mcp`);
    if (oauthConfig) {
      const localMetadataUrl = `http://localhost:${port}${OAUTH_PROTECTED_RESOURCE_PATH}`;
      console.log(`[${APP_NAME}] OAuth protected resource metadata available at ${localMetadataUrl}`);
      if (oauthMetadataUrl && oauthMetadataUrl !== localMetadataUrl) {
        console.log(`[${APP_NAME}] OAuth resource indicator: ${oauthConfig.resourceIndicator}`);
        console.log(`[${APP_NAME}] Published metadata URL: ${oauthMetadataUrl}`);
      }
    }
  })
  .on("error", (error: Error) => {
    console.error(`[${APP_NAME}] MCP server encountered an error`, error);
    process.exit(1);
  });






















