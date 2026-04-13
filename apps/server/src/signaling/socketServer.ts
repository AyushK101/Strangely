import { WebSocketServer, type RawData, type WebSocket } from "ws";

import {
  CONTROL_EVENT,
  WEBRTC_SIGNAL_EVENT,
  makeEnvelope,
  signalEnvelopeSchema,
  type DisconnectPayload,
  type MatchFoundPayload,
  type PeerId,
  type SignalEnvelopeInput,
  type SessionId,
} from "@strangely/shared";

import { Matchmaker } from "../matchmaking/matchmaker.js";
import { SessionRegistry } from "../sessions/sessionRegistry.js";

interface PeerConnection {
  peerId: PeerId;
  socket: WebSocket;
}

type AnySignalEnvelope = SignalEnvelopeInput;
type TeardownCause =
  | "client_left"
  | "network_lost"
  | "server_shutdown"
  | "skip";

export interface SocketServerApi {
  close: () => Promise<void>;
}

export function createSocketServer(port: number): SocketServerApi {
  const wss = new WebSocketServer({ port });
  const matchmaker = new Matchmaker();
  const sessions = new SessionRegistry();
  const peers = new Map<PeerId, PeerConnection>();
  const peerIdBySocket = new WeakMap<WebSocket, PeerId>();

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => onMessage(raw, socket));
    socket.on("close", () => onSocketClose(socket));
  });

  function onMessage(raw: RawData, socket: WebSocket): void {
    const parsed = safeParseEnvelope(raw);
    if (!parsed) {
      return;
    }

    const boundPeerId = peerIdBySocket.get(socket);

    if (parsed.type === CONTROL_EVENT.CONNECT) {
      const peerId = parsed.payload.peerId;
      if (boundPeerId && boundPeerId !== peerId) {
        return;
      }

      const existingConnection = peers.get(peerId);
      if (existingConnection && existingConnection.socket !== socket) {
        return;
      }

      peerIdBySocket.set(socket, peerId);
      peers.set(peerId, { peerId, socket });

      if (sessions.getByPeerId(peerId)) {
        return;
      }

      // Keep queue transitions idempotent for duplicate connect frames.
      matchmaker.drop(peerId);

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

    if (!boundPeerId) {
      return;
    }

    if (parsed.type === CONTROL_EVENT.DISCONNECT) {
      teardownPeer(boundPeerId, "client_left", socket);
      return;
    }

    if (parsed.type === CONTROL_EVENT.SKIP) {
      teardownPeer(boundPeerId, "skip", socket);
      return;
    }

    if (
      parsed.type === WEBRTC_SIGNAL_EVENT.OFFER ||
      parsed.type === WEBRTC_SIGNAL_EVENT.ANSWER
    ) {
      // Offer/answer payloads are relayed as signaling metadata only.
      relayToPeer(parsed.payload.sessionId, boundPeerId, parsed.type, {
        ...parsed.payload,
        fromPeerId: boundPeerId,
      });
      return;
    }

    if (parsed.type === WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE) {
      relayToPeer(parsed.payload.sessionId, boundPeerId, parsed.type, {
        ...parsed.payload,
        fromPeerId: boundPeerId,
      });
    }
  }

  function onSocketClose(socket: WebSocket): void {
    const peerId = peerIdBySocket.get(socket);
    if (!peerId) {
      return;
    }

    teardownPeer(peerId, "network_lost", socket);
  }

  function relayToPeer(
    sessionId: SessionId,
    fromPeerId: PeerId,
    eventType:
      | typeof WEBRTC_SIGNAL_EVENT.OFFER
      | typeof WEBRTC_SIGNAL_EVENT.ANSWER
      | typeof WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE,
    payload: AnySignalEnvelope["payload"],
  ): void {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (
      session.firstPeerId !== fromPeerId &&
      session.secondPeerId !== fromPeerId
    ) {
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

    target.socket.send(JSON.stringify(makeEnvelope(eventType, payload)));
  }

  function teardownPeer(
    peerId: PeerId,
    cause: TeardownCause,
    sourceSocket?: WebSocket,
  ): void {
    const activeConnection = peers.get(peerId);
    if (
      sourceSocket &&
      activeConnection &&
      activeConnection.socket !== sourceSocket
    ) {
      return;
    }

    const hadPeerConnection = peers.delete(peerId);
    matchmaker.drop(peerId);

    if (activeConnection) {
      peerIdBySocket.delete(activeConnection.socket);
    }

    const removedSession = sessions.removeByPeerId(peerId);
    if (!removedSession) {
      return;
    }

    const counterpartPeerId =
      removedSession.firstPeerId === peerId
        ? removedSession.secondPeerId
        : removedSession.firstPeerId;

    if (!hadPeerConnection && cause !== "skip") {
      return;
    }

    if (cause === "skip") {
      notifyCounterpart(counterpartPeerId, CONTROL_EVENT.SKIP, {
        peerId,
        previousSessionId: removedSession.sessionId,
      });
      return;
    }

    notifyCounterpart(counterpartPeerId, CONTROL_EVENT.DISCONNECT, {
      peerId,
      reason: cause,
    });
  }

  function notifyCounterpart(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.SKIP,
    payload: {
      peerId: PeerId;
      previousSessionId: SessionId;
    },
  ): void;
  function notifyCounterpart(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.DISCONNECT,
    payload: DisconnectPayload,
  ): void;
  function notifyCounterpart(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.SKIP | typeof CONTROL_EVENT.DISCONNECT,
    payload:
      | {
          peerId: PeerId;
          previousSessionId: SessionId;
        }
      | DisconnectPayload,
  ): void {
    const connection = peers.get(peerId);
    if (!connection) {
      return;
    }

    connection.socket.send(JSON.stringify(makeEnvelope(eventType, payload)));
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
      // Ensure deterministic teardown notifications before shutting down.
      const activePeerIds = Array.from(peers.keys());
      for (const peerId of activePeerIds) {
        teardownPeer(peerId, "server_shutdown");
      }

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
  const text = toText(raw);
  if (!text) {
    return null;
  }

  try {
    const maybeEnvelope = JSON.parse(text) as unknown;
    const validated = signalEnvelopeSchema.safeParse(maybeEnvelope);
    if (!validated.success) {
      return null;
    }

    return validated.data;
  } catch {
    return null;
  }
}

function toText(raw: RawData): string | null {
  if (typeof raw === "string") {
    return raw;
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }

  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString("utf8");
  }

  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }

  return null;
}
