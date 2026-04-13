import { getServerConfig } from "./config.js";
import { createSocketServer } from "./signaling/socketServer.js";

const config = getServerConfig();
const socketServer = createSocketServer(config.port);

let isShuttingDown = false;

function registerShutdown(signal: NodeJS.Signals): void {
  process.on(signal, () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    void socketServer
      .close()
      .then(() => {
        process.exit(0);
      })
      .catch(() => {
        process.exit(1);
      });
  });
}

registerShutdown("SIGINT");
registerShutdown("SIGTERM");

console.log(
  `Signaling server listening on :${config.port}. WebSocket handles control plane only; clients own WebRTC media.`,
);
