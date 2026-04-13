import { WebSocketServer, type RawData, type WebSocket } from "ws";

import {
  CONTROL_EVENT,
  WEBRTC_SIGNAL_EVENT,
  makeEnvelope,
  type MatchFoundPayload,
  type PeerId,
  type SignalEnvelope,
  type SignalEventType,
  type SignalPayloadByType,
  type SessionId,
} from "@strangely/shared";

import { Matchmaker } from "../matchmaking/matchmaker.js";
import { SessionRegistry } from "../sessions/sessionRegistry.js";

interface PeerConnection {
  peerId: PeerId;
  socket: WebSocket;
}

type AnySignalEnvelope = {
  [TType in SignalEventType]: SignalEnvelope<TType>;
}[SignalEventType];

export interface SocketServerApi {
  close: () => Promise<void>;
}

export function createSocketServer(port: number): SocketServerApi {
  const wss = new WebSocketServer({ port });
  const matchmaker = new Matchmaker();
  const sessions = new SessionRegistry();
  const peers = new Map<PeerId, PeerConnection>();

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => onMessage(raw, socket));
    socket.on("close", () => onSocketClose(socket));
  });

  function onMessage(raw: RawData, socket: WebSocket): void {
    const parsed = safeParseEnvelope(raw);
    if (!parsed) {
      return;
    }

    if (parsed.type === CONTROL_EVENT.CONNECT) {
      const peerId = parsed.payload.peerId;
      peers.set(peerId, { peerId, socket });

      const pair = matchmaker.enqueue(peerId);
      if (!pair) {
        return;
      }

      const sessionId = crypto.randomUUID() as SessionId;
      sessions.add({
        sessionId,
        firstPeerId: pair.first.peerId,
        secondPeerId: pair.second.peerId,
        createdAtMs: Date.now(),
      });

      notifyMatch(pair.first.peerId, {
        sessionId,
        localPeerId: pair.first.peerId,
        remotePeerId: pair.second.peerId,
      });
      notifyMatch(pair.second.peerId, {
        sessionId,
        localPeerId: pair.second.peerId,
        remotePeerId: pair.first.peerId,
      });
      return;
    }

    if (
      parsed.type === CONTROL_EVENT.DISCONNECT ||
      parsed.type === CONTROL_EVENT.SKIP
    ) {
      matchmaker.drop(parsed.payload.peerId);
      peers.delete(parsed.payload.peerId);
      return;
    }

    if (
      parsed.type === WEBRTC_SIGNAL_EVENT.OFFER ||
      parsed.type === WEBRTC_SIGNAL_EVENT.ANSWER
    ) {
      // Offer/answer payloads are relayed as signaling metadata only.
      relayToPeer(parsed.payload.sessionId, parsed.payload.fromPeerId, parsed);
      return;
    }

    if (parsed.type === WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE) {
      relayToPeer(parsed.payload.sessionId, parsed.payload.fromPeerId, parsed);
    }
  }

  function onSocketClose(socket: WebSocket): void {
    for (const [peerId, value] of peers.entries()) {
      if (value.socket === socket) {
        peers.delete(peerId);
        matchmaker.drop(peerId);
      }
    }
  }

  function relayToPeer(
    sessionId: SessionId,
    fromPeerId: PeerId,
    envelope: AnySignalEnvelope,
  ): void {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }

    const targetPeerId =
      session.firstPeerId === fromPeerId
        ? session.secondPeerId
        : session.firstPeerId;
    const target = peers.get(targetPeerId);
    if (!target) {
      return;
    }

    target.socket.send(JSON.stringify(envelope));
  }

  function notifyMatch(peerId: PeerId, payload: MatchFoundPayload): void {
    const connection = peers.get(peerId);
    if (!connection) {
      return;
    }

    connection.socket.send(
      JSON.stringify(makeEnvelope(CONTROL_EVENT.MATCH_FOUND, payload)),
    );
  }

  return {
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        wss.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

function safeParseEnvelope(raw: RawData): AnySignalEnvelope | null {
  const text = typeof raw === "string" ? raw : raw.toString();

  try {
    const maybeEnvelope = JSON.parse(text) as AnySignalEnvelope;
    if (typeof maybeEnvelope?.type !== "string") {
      return null;
    }

    return maybeEnvelope;
  } catch {
    return null;
  }
}
