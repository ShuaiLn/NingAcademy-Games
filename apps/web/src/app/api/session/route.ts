import { getGamesConfig } from "@/server/config";
import { handleSessionStatus } from "@/server/http-handlers";
import { getGamesGateway } from "@/server/postgres-games-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): Promise<Response> {
  const config = getGamesConfig();
  return handleSessionStatus(request, config, getGamesGateway(config));
}
