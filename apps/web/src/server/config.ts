import { PROTOCOL_VERSION } from "@ningacademy/protocol";

export type RuntimeEnvironment = "development" | "production" | "test";

export interface IceServerConfig {
  readonly credential?: string;
  readonly urls: readonly string[];
  readonly username?: string;
}

export interface GamesConfig {
  readonly databaseRole: "games_api" | null;
  readonly databaseUrl: string | null;
  readonly databaseCa: string | null;
  readonly gameSessionCookieName: string;
  readonly iceServers: readonly IceServerConfig[];
  readonly mainOrigin: string;
  readonly nodeEnv: RuntimeEnvironment;
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly rulesetVersion: string;
  readonly webOrigin: string;
}

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const COOKIE_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/;
const RULESET_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function readDatabaseCa(
  value: string | undefined,
  production: boolean,
): string | null {
  const candidate = value?.trim();

  if (!candidate) {
    if (production) {
      throw new Error("GAME_DATABASE_CA is required in production");
    }
    return null;
  }

  if (
    !candidate.includes("-----BEGIN CERTIFICATE-----") ||
    !candidate.includes("-----END CERTIFICATE-----")
  ) {
    throw new Error("GAME_DATABASE_CA must contain a PEM certificate");
  }

  return candidate;
}

function readRuntimeEnvironment(value: string | undefined): RuntimeEnvironment {
  const candidate = value ?? "development";
  if (candidate === "development" || candidate === "production" || candidate === "test") {
    return candidate;
  }
  throw new Error("NODE_ENV must be development, production, or test");
}

function readOrigin(name: string, value: string | undefined, fallback: string | undefined, production: boolean): string {
  const candidate = value?.trim() || fallback;
  if (candidate === undefined) throw new Error(`${name} is required`);

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) origin`);
  }

  if (
    !["http:", "https:"].includes(parsed.protocol)
    || parsed.username !== ""
    || parsed.password !== ""
    || parsed.pathname !== "/"
    || parsed.search !== ""
    || parsed.hash !== ""
    || (production && parsed.protocol !== "https:")
  ) {
    throw new Error(`${name} must contain only an approved HTTP(S) origin`);
  }
  return parsed.origin;
}

function readDatabaseUrl(value: string | undefined, production: boolean): string | null {
  const candidate = value?.trim();
  if (!candidate) {
    if (production) throw new Error("GAME_DATABASE_URL is required in production");
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("GAME_DATABASE_URL must be an absolute PostgreSQL URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol)
    || parsed.username === ""
    || parsed.password === ""
    || parsed.hash !== ""
  ) {
    throw new Error("GAME_DATABASE_URL must include a PostgreSQL login and password");
  }

  const loginName = parsed.username.split(".", 1)[0]?.toLowerCase();
  if (production && ["postgres", "supabase_admin", "service_role"].includes(loginName ?? "")) {
    throw new Error("GAME_DATABASE_URL must not use an owner or broad service credential");
  }
  return candidate;
}

function readDatabaseRole(value: string | undefined, production: boolean): "games_api" | null {
  const candidate = value?.trim();
  if (!candidate) {
    if (production) throw new Error("GAME_DATABASE_ROLE=games_api is required in production");
    return null;
  }
  if (candidate !== "games_api") {
    throw new Error("GAME_DATABASE_ROLE may only be games_api");
  }
  return candidate;
}

function splitUrls(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateIceUrls(name: string, urls: readonly string[], allowed: readonly string[]): void {
  for (const value of urls) {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${name} contains an invalid ICE URL`);
    }
    if (!allowed.includes(parsed.protocol)) {
      throw new Error(`${name} contains an unsupported ICE protocol`);
    }
  }
}

function readIceServers(env: EnvironmentSource, production: boolean): readonly IceServerConfig[] {
  const stunUrls = splitUrls(env.GAME_STUN_URLS);
  const turnUrls = splitUrls(env.GAME_TURN_URLS);
  validateIceUrls("GAME_STUN_URLS", stunUrls, ["stun:", "stuns:"]);
  validateIceUrls("GAME_TURN_URLS", turnUrls, ["turn:", "turns:"]);

  if (production && stunUrls.length === 0) {
    throw new Error("GAME_STUN_URLS must configure at least one STUN endpoint");
  }
  if (turnUrls.length > 0 && (!env.GAME_TURN_USERNAME || !env.GAME_TURN_CREDENTIAL)) {
    throw new Error("TURN URLs require GAME_TURN_USERNAME and GAME_TURN_CREDENTIAL");
  }

  return [
    ...(stunUrls.length === 0 ? [] : [{ urls: stunUrls }]),
    ...(turnUrls.length === 0
      ? []
      : [{
          credential: env.GAME_TURN_CREDENTIAL!,
          urls: turnUrls,
          username: env.GAME_TURN_USERNAME!,
        }]),
  ];
}

export function readGamesConfig(env: EnvironmentSource): GamesConfig {
  const nodeEnv = readRuntimeEnvironment(env.NODE_ENV);
  const production = nodeEnv === "production";
  const gameSessionCookieName = env.GAME_SESSION_COOKIE_NAME?.trim()
    || (production ? "__Host-ning_game_session" : "ningacademy_game_session");
  if (!COOKIE_NAME_PATTERN.test(gameSessionCookieName)) {
    throw new Error("GAME_SESSION_COOKIE_NAME contains unsupported characters");
  }
  if (production && !gameSessionCookieName.startsWith("__Host-")) {
    throw new Error("GAME_SESSION_COOKIE_NAME must use the __Host- prefix in production");
  }

  const rulesetVersion = env.GAME_RULESET_VERSION?.trim() || "p0";
  if (!RULESET_PATTERN.test(rulesetVersion)) {
    throw new Error("GAME_RULESET_VERSION contains unsupported characters");
  }

return {
    databaseRole: readDatabaseRole(env.GAME_DATABASE_ROLE, production),
    databaseUrl: readDatabaseUrl(env.GAME_DATABASE_URL, production),
    databaseCa: readDatabaseCa(env.GAME_DATABASE_CA, production),
    gameSessionCookieName,
    iceServers: readIceServers(env, production),
    mainOrigin: readOrigin(
      "NINGACADEMY_MAIN_ORIGIN",
      env.NINGACADEMY_MAIN_ORIGIN,
      production ? "https://ningacademy.org" : "http://localhost:3001",
      production,
    ),
    nodeEnv,
    protocolVersion: PROTOCOL_VERSION,
    rulesetVersion,
    webOrigin: readOrigin(
      "GAME_WEB_ORIGIN",
      env.GAME_WEB_ORIGIN,
      production ? "https://game.ningacademy.org" : "http://localhost:3000",
      production,
    ),
  };
}

export function getGamesConfig(): GamesConfig {
  return readGamesConfig(process.env);
}
