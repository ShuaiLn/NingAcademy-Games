import { getGamesConfig } from "@/server/config";
import { handleJoinRoom } from "@/server/http-handlers";
import { getGamesGateway } from "@/server/postgres-games-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request): Promise<Response> {
  const config = getGamesConfig();
  return handleJoinRoom(request, config, getGamesGateway(config));
}
