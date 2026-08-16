import { getGamesConfig } from "@/server/config";
import { handleSendSignal } from "@/server/http-handlers";
import { getGamesGateway } from "@/server/postgres-games-gateway";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SignalRouteContext = { readonly params: Promise<{ readonly roomId: string }> };

export async function POST(request: Request, context: SignalRouteContext): Promise<Response> {
  const config = getGamesConfig();
  const { roomId } = await context.params;
  return handleSendSignal(request, roomId, config, getGamesGateway(config));
}
