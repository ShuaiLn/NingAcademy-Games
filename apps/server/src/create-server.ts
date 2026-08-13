import { WebSocketTransport } from "@colyseus/ws-transport";
import { defineRoom, defineServer } from "@colyseus/core";

import { isAllowedOrigin, type ServerConfig } from "./config.js";
import {
  UnavailableGameSessionVerifier,
  type GameSessionVerifier,
} from "./auth/game-session.js";
import {
  UnavailableLaunchTicketRedeemer,
  type LaunchTicketRedeemer,
} from "./auth/launch-ticket.js";
import { createLaunchTicketExchangeHandler } from "./auth/launch-ticket-route.js";
import { createEmptyGameRoomClass } from "./rooms/empty-game-room.js";

const maximumMessageBytes = 16 * 1_024;

export function createGameServer(
  config: ServerConfig,
  sessionVerifier: GameSessionVerifier = new UnavailableGameSessionVerifier(),
  launchTicketRedeemer: LaunchTicketRedeemer = new UnavailableLaunchTicketRedeemer(),
) {
  const roomDefinition = {
    expectedOrigin: config.webOrigin,
    sessionCookieName: config.gameSessionCookieName,
    sessionVerifier,
  };

  return defineServer({
    devMode: config.nodeEnv === "development",
    rooms: {
      phase0_empty: defineRoom(
        createEmptyGameRoomClass(roomDefinition),
        roomDefinition,
      ),
    },
    transport: new WebSocketTransport({
      maxPayload: maximumMessageBytes,
      perMessageDeflate: false,
      pingInterval: 10_000,
      pingMaxRetries: 3,
      verifyClient: (info, next) => {
        if (!isAllowedOrigin(info.origin, config.webOrigin)) {
          next(false, 403, "Forbidden origin");
          return;
        }

        next(true);
      },
    }),
    express: (app) => {
      app.disable("x-powered-by");
      app.use((request, response, next) => {
        const origin = request.get("origin");
        const isLaunchExchange = request.path === "/v1/auth/exchange";
        const expectedOrigin = isLaunchExchange ? config.mainOrigin : config.webOrigin;

        if (origin !== undefined) {
          if (!isAllowedOrigin(origin, expectedOrigin)) {
            response.status(403).json({ error: "origin_not_allowed" });
            return;
          }

          if (!isLaunchExchange) {
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.setHeader("Access-Control-Allow-Origin", config.webOrigin);
            response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.vary("Origin");
          }
        }

        if (request.method === "OPTIONS") {
          response.sendStatus(204);
          return;
        }

        next();
      });

      app.post(
        "/v1/auth/exchange",
        ...createLaunchTicketExchangeHandler(config, launchTicketRedeemer),
      );

      app.get("/healthz", (request, response) => {
        response.setHeader("Cache-Control", "no-store");
        response.json({
          method: request.method,
          protocolVersion: config.protocolVersion,
          region: config.region,
          service: "ningacademy-game-server",
          status: "ok",
        });
      });
    },
  });
}
