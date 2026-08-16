import { getGamesConfig } from "@/server/config";
import { handlePollRoom, handleRoomAction } from "@/server/http-handlers";
import { getGamesGateway } from "@/server/postgres-games-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RoomRouteContext = { readonly params: Promise<{ readonly roomId: string }> };

export async function GET(request: Request, context: RoomRouteContext): Promise<Response> {
  const config = getGamesConfig();
  const { roomId } = await context.params;
  return handlePollRoom(request, roomId, config, getGamesGateway(config));
}

export async function POST(request: Request, context: RoomRouteContext): Promise<Response> {
  const config = getGamesConfig();
  const { roomId } = await context.params;
  return handleRoomAction(request, roomId, config, getGamesGateway(config));
}
