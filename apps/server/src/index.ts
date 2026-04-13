import { getServerConfig } from "./config.js";
import { createSocketServer } from "./signaling/socketServer.js";

const config = getServerConfig();
createSocketServer(config.port);

console.log(
  `Signaling server listening on :${config.port}. WebSocket handles control plane only; clients own WebRTC media.`,
);
