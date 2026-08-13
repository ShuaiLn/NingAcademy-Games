import { PROTOCOL_VERSION } from "@ningacademy/protocol";

export type RuntimeEnvironment = "development" | "production" | "test";

export interface ServerConfig {
  gameSessionCookieName: string;
  mainOrigin: string;
  nodeEnv: RuntimeEnvironment;
  port: number;
  protocolVersion: typeof PROTOCOL_VERSION;
  region: string;
  webOrigin: string;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const regionPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const cookieNamePattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/;

function readRuntimeEnvironment(value: string | undefined): RuntimeEnvironment {
  const candidate = value ?? "development";

  if (candidate === "development" || candidate === "production" || candidate === "test") {
    return candidate;
  }

  throw new Error(`NODE_ENV must be development, test, or production; received ${candidate}`);
}

function readPort(value: string | undefined): number {
  const candidate = value ?? "2567";

  if (!/^\d{1,5}$/.test(candidate)) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const port = Number(candidate);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

function readPatternValue(
  name: string,
  value: string | undefined,
  fallback: string,
  pattern: RegExp,
): string {
  const candidate = value ?? fallback;

  if (!pattern.test(candidate)) {
    throw new Error(`${name} contains unsupported characters`);
  }

  return candidate;
}

export function normalizeWebOrigin(value: string, nodeEnv: RuntimeEnvironment): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("GAME_WEB_ORIGIN must be an absolute HTTP(S) origin");
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.pathname !== "/"
    || parsed.search !== ""
    || parsed.hash !== ""
  ) {
    throw new Error("GAME_WEB_ORIGIN must contain only an HTTP(S) scheme, host, and optional port");
  }

  if (nodeEnv === "production" && parsed.protocol !== "https:") {
    throw new Error("GAME_WEB_ORIGIN must use HTTPS in production");
  }

  return parsed.origin;
}

export function isAllowedOrigin(origin: string | null | undefined, expectedOrigin: string): boolean {
  return origin === expectedOrigin;
}

export function readServerConfig(env: EnvironmentSource): ServerConfig {
  const nodeEnv = readRuntimeEnvironment(env.NODE_ENV);
  const defaultOrigin = nodeEnv === "production" ? undefined : "http://localhost:3000";
  const defaultMainOrigin = nodeEnv === "production" ? undefined : "http://localhost:3001";
  const origin = env.GAME_WEB_ORIGIN ?? defaultOrigin;
  const mainOrigin = env.NINGACADEMY_MAIN_ORIGIN ?? defaultMainOrigin;

  if (origin === undefined) {
    throw new Error("GAME_WEB_ORIGIN is required in production");
  }
  if (mainOrigin === undefined) {
    throw new Error("NINGACADEMY_MAIN_ORIGIN is required in production");
  }

  return {
    gameSessionCookieName: readPatternValue(
      "GAME_SESSION_COOKIE_NAME",
      env.GAME_SESSION_COOKIE_NAME,
      "ningacademy_game_session",
      cookieNamePattern,
    ),
    mainOrigin: normalizeWebOrigin(mainOrigin, nodeEnv),
    nodeEnv,
    port: readPort(env.PORT),
    protocolVersion: PROTOCOL_VERSION,
    region: readPatternValue(
      "GAME_SERVER_REGION",
      env.GAME_SERVER_REGION,
      nodeEnv === "production" ? "us-west" : "local",
      regionPattern,
    ),
    webOrigin: normalizeWebOrigin(origin, nodeEnv),
  };
}
