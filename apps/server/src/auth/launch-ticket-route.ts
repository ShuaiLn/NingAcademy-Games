import express, { type Request, type RequestHandler, type Response } from "express";

import type { ServerConfig } from "../config.js";
import {
  buildSessionCookie,
  validateLaunchRequest,
  type LaunchTicketRedeemer,
} from "./launch-ticket.js";

const formParser = express.urlencoded({
  extended: false,
  limit: 1_024,
  parameterLimit: 2,
  type: "application/x-www-form-urlencoded",
});

function readSingleFormField(request: Request, name: string): unknown {
  if (typeof request.body !== "object" || request.body === null || Array.isArray(request.body)) {
    return undefined;
  }

  return (request.body as Readonly<Record<string, unknown>>)[name];
}

function setPrivateNavigationHeaders(response: Response): void {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

export function createLaunchTicketExchangeHandler(
  config: ServerConfig,
  redeemer: LaunchTicketRedeemer,
  now: () => Date = () => new Date(),
): RequestHandler[] {
  const exchange: RequestHandler = async (request, response) => {
    setPrivateNavigationHeaders(response);

    const validation = validateLaunchRequest(
      readSingleFormField(request, "ticket"),
      {
        origin: request.get("origin"),
        secFetchDest: request.get("sec-fetch-dest"),
        secFetchMode: request.get("sec-fetch-mode"),
        secFetchSite: request.get("sec-fetch-site"),
      },
      config.mainOrigin,
    );

    if (validation.kind === "rejected") {
      response.status(400).type("text/plain").send("Invalid game launch request.");
      return;
    }

    const redemption = await redeemer.redeem(validation.rawLaunchTicket);
    if (redemption.kind === "rejected") {
      const status = redemption.reason === "service_unavailable" ? 503 : 401;
      response.status(status).type("text/plain").send(
        status === 503
          ? "Game identity service is temporarily unavailable."
          : "This game launch has expired or was already used.",
      );
      return;
    }

    response.setHeader(
      "Set-Cookie",
      buildSessionCookie({
        cookieName: config.gameSessionCookieName,
        expiresAt: redemption.value.expiresAt,
        now: now(),
        rawSessionToken: redemption.value.rawSessionToken,
        secure: config.nodeEnv === "production",
      }),
    );
    response.redirect(303, config.webOrigin);
  };

  return [formParser, exchange];
}
