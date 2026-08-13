import { readServerConfig } from "./config.js";
import { createGameServer } from "./create-server.js";

export const serverConfig = readServerConfig(process.env);

const server = createGameServer(serverConfig);

export default server;
