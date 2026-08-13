import server, { serverConfig } from "./app.config.js";

async function main(): Promise<void> {
  await server.listen(serverConfig.port);
  process.stdout.write(`${JSON.stringify({
    event: "server_started",
    port: serverConfig.port,
    protocolVersion: serverConfig.protocolVersion,
    region: serverConfig.region,
  })}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown startup error";
  process.stderr.write(`${JSON.stringify({ event: "server_start_failed", message })}\n`);
  process.exitCode = 1;
});
