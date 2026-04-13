import { randomUUID } from "node:crypto";

import { WebSocketServer, type RawData, type WebSocket } from "ws";

import {
  CONTROL_EVENT,
  WEBRTC_SIGNAL_EVENT,
  makeEnvelope,
  signalEnvelopeSchema,
  type DisconnectPayload,
  type MatchFoundPayload,
  type PeerId,
  type RetryPayload,
  type SessionId,
  type SignalEnvelopeInput,
  type TimeoutPayload,
} from "@strangely/shared";

import { Matchmaker } from "../matchmaking/matchmaker.js";
import {
  SessionRegistry,
  type SessionRecord,
} from "../sessions/sessionRegistry.js";

interface PeerConnection {
  peerId: PeerId;
  socket: WebSocket;
}

type AnySignalEnvelope = SignalEnvelopeInput;
type TeardownCause =
  | "client_left"
  | "network_lost"
  | "server_shutdown"
  | "skip"
  | "retry"
  | "timeout";

export interface SocketServerOptions {
  queueTimeoutMs?: number;
  sessionTimeoutMs?: number;
  cleanupIntervalMs?: number;
}

export interface SocketServerApi {
  close: () => Promise<void>;
  sweep: () => void;
}

const DEFAULT_OPTIONS: Required<SocketServerOptions> = {
  queueTimeoutMs: 15_000,
  sessionTimeoutMs: 45_000,
  cleanupIntervalMs: 1_000,
};

export function createSocketServer(
  port: number,
  options: SocketServerOptions = {},
): SocketServerApi {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const wss = new WebSocketServer({ port });
  const matchmaker = new Matchmaker();
  const sessions = new SessionRegistry();
  const peers = new Map<PeerId, PeerConnection>();
  const peerIdBySocket = new WeakMap<WebSocket, PeerId>();
  const cleanupTimer = setInterval(() => {
    runMaintenance();
  }, settings.cleanupIntervalMs);

  cleanupTimer.unref?.();

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
      const existingConnection = peers.get(peerId);

      if (boundPeerId && boundPeerId !== peerId) {
        return;
      }

      if (existingConnection && existingConnection.socket !== socket) {
        return;
      }

      peerIdBySocket.set(socket, peerId);
      peers.set(peerId, { peerId, socket });

      if (sessions.getByPeerId(peerId) || matchmaker.has(peerId)) {
        return;
      }

      queuePeer(peerId, 0);
      return;
    }

    if (!boundPeerId) {
      return;
    }

    if (parsed.type === CONTROL_EVENT.DISCONNECT) {
      teardownPeer(boundPeerId, "client_left", socket);
      return;
    }

    if (parsed.type === CONTROL_EVENT.TIMEOUT) {
      return;
    }

    if (parsed.type === CONTROL_EVENT.SKIP) {
      handleSkip(boundPeerId, socket);
      return;
    }

    if (parsed.type === CONTROL_EVENT.RETRY) {
      handleRetry(boundPeerId, parsed.payload.attempt, socket);
      return;
    }

    if (
      parsed.type === WEBRTC_SIGNAL_EVENT.OFFER ||
      parsed.type === WEBRTC_SIGNAL_EVENT.ANSWER
    ) {
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

  function handleSkip(peerId: PeerId, socket: WebSocket): void {
    const removedSession = teardownPeer(peerId, "skip", socket);

    if (removedSession) {
      const nextRetryCount = getRetryCount(removedSession, peerId) + 1;
      notifyControl(
        removedSession.firstPeerId === peerId
          ? removedSession.secondPeerId
          : removedSession.firstPeerId,
        CONTROL_EVENT.SKIP,
        {
          peerId,
          previousSessionId: removedSession.sessionId,
        },
      );
      queuePeer(peerId, nextRetryCount, Date.now(), true);
      return;
    }

    queuePeer(peerId, 0, Date.now(), true);
  }

  function handleRetry(
    peerId: PeerId,
    attempt: number,
    socket: WebSocket,
  ): void {
    const removedSession = teardownPeer(peerId, "retry", socket);

    if (removedSession) {
      notifyControl(
        removedSession.firstPeerId === peerId
          ? removedSession.secondPeerId
          : removedSession.firstPeerId,
        CONTROL_EVENT.RETRY,
        {
          peerId,
          attempt,
        },
      );
    }

    queuePeer(peerId, attempt, Date.now(), true);
  }

  function queuePeer(
    peerId: PeerId,
    retryCount: number,
    createdAtMs = Date.now(),
    replaceExisting = false,
  ): void {
    if (sessions.getByPeerId(peerId)) {
      return;
    }

    if (!replaceExisting && matchmaker.has(peerId)) {
      return;
    }

    if (replaceExisting) {
      matchmaker.drop(peerId);
    }

    const pair = matchmaker.enqueue(peerId, retryCount, createdAtMs);
    if (!pair) {
      return;
    }

    createSessionFromPair(pair);
  }

  function createSessionFromPair(pair: {
    first: { peerId: PeerId; retryCount: number };
    second: { peerId: PeerId; retryCount: number };
  }): void {
    const sessionId = randomUUID() as SessionId;

    sessions.add({
      sessionId,
      firstPeerId: pair.first.peerId,
      secondPeerId: pair.second.peerId,
      createdAtMs: Date.now(),
      firstRetryCount: pair.first.retryCount,
      secondRetryCount: pair.second.retryCount,
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
  ): SessionRecord | undefined {
    const activeConnection = peers.get(peerId);
    if (
      sourceSocket &&
      activeConnection &&
      activeConnection.socket !== sourceSocket
    ) {
      return undefined;
    }

    const shouldReleaseConnection =
      cause === "client_left" ||
      cause === "network_lost" ||
      cause === "server_shutdown";

    if (shouldReleaseConnection) {
      peers.delete(peerId);
    }
    matchmaker.drop(peerId);

    if (activeConnection && shouldReleaseConnection) {
      peerIdBySocket.delete(activeConnection.socket);
    }

    const removedSession = sessions.removeByPeerId(peerId);
    if (!removedSession) {
      return undefined;
    }

    const counterpartPeerId =
      removedSession.firstPeerId === peerId
        ? removedSession.secondPeerId
        : removedSession.firstPeerId;

    if (cause === "client_left" || cause === "network_lost") {
      notifyCounterpart(counterpartPeerId, CONTROL_EVENT.DISCONNECT, {
        peerId,
        reason: cause,
      });
    }

    if (cause === "server_shutdown") {
      notifyCounterpart(counterpartPeerId, CONTROL_EVENT.DISCONNECT, {
        peerId,
        reason: "server_shutdown",
      });
    }

    if (cause === "timeout") {
      notifyCounterpart(counterpartPeerId, CONTROL_EVENT.TIMEOUT, {
        peerId,
        sessionId: removedSession.sessionId,
      });
    }

    return removedSession;
  }

  function notifyCounterpart(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.DISCONNECT,
    payload: DisconnectPayload,
  ): void;
  function notifyCounterpart(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.TIMEOUT,
    payload: TimeoutPayload,
  ): void;
  function notifyCounterpart(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.DISCONNECT | typeof CONTROL_EVENT.TIMEOUT,
    payload: DisconnectPayload | TimeoutPayload,
  ): void {
    const connection = peers.get(peerId);
    if (!connection) {
      return;
    }

    connection.socket.send(JSON.stringify(makeEnvelope(eventType, payload)));
  }

  function notifyControl(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.SKIP,
    payload: {
      peerId: PeerId;
      previousSessionId: SessionId;
    },
  ): void;
  function notifyControl(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.RETRY,
    payload: RetryPayload,
  ): void;
  function notifyControl(
    peerId: PeerId,
    eventType: typeof CONTROL_EVENT.TIMEOUT,
    payload: TimeoutPayload,
  ): void;
  function notifyControl(
    peerId: PeerId,
    eventType:
      | typeof CONTROL_EVENT.SKIP
      | typeof CONTROL_EVENT.RETRY
      | typeof CONTROL_EVENT.TIMEOUT,
    payload:
      | {
          peerId: PeerId;
          previousSessionId: SessionId;
        }
      | RetryPayload
      | TimeoutPayload,
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

  function runMaintenance(): void {
    const nowMs = Date.now();
    const staleTickets = matchmaker.purgeOlderThan(
      nowMs,
      settings.queueTimeoutMs,
    );
    for (const ticket of staleTickets) {
      notifyControl(ticket.peerId, CONTROL_EVENT.TIMEOUT, {
        peerId: ticket.peerId,
      });
    }

    const staleSessions = sessions.purgeOlderThan(
      nowMs,
      settings.sessionTimeoutMs,
    );
    for (const session of staleSessions) {
      notifyControl(session.firstPeerId, CONTROL_EVENT.TIMEOUT, {
        peerId: session.firstPeerId,
        sessionId: session.sessionId,
      });
      notifyControl(session.secondPeerId, CONTROL_EVENT.TIMEOUT, {
        peerId: session.secondPeerId,
        sessionId: session.sessionId,
      });
    }
  }

  return {
    sweep: runMaintenance,
    close: async () => {
      clearInterval(cleanupTimer);

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

function getRetryCount(session: SessionRecord, peerId: PeerId): number {
  return session.firstPeerId === peerId
    ? session.firstRetryCount
    : session.secondRetryCount;
}
