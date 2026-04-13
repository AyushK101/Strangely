import assert from "node:assert/strict";
import test from "node:test";

import WebSocket, { WebSocketServer, type RawData } from "ws";

import {
  CONTROL_EVENT,
  WEBRTC_SIGNAL_EVENT,
  makeEnvelope,
  type SignalEnvelopeInput,
} from "@strangely/shared";

import { SessionRegistry } from "../src/sessions/sessionRegistry.js";
import { createSocketServer } from "../src/signaling/socketServer.js";

type SignalEventType = SignalEnvelopeInput["type"];
type SignalEnvelopeByType<TType extends SignalEventType> = Extract<
  SignalEnvelopeInput,
  { type: TType }
>;

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
}

function waitForEnvelope<TType extends SignalEventType>(
  socket: WebSocket,
  eventType: TType,
  timeoutMs = 1_000,
): Promise<SignalEnvelopeByType<TType>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("timed out waiting for envelope"));
    }, timeoutMs);

    function onMessage(data: RawData) {
      try {
        const text =
          typeof data === "string"
            ? data
            : Buffer.isBuffer(data)
              ? data.toString("utf8")
              : Array.isArray(data)
                ? Buffer.concat(data).toString("utf8")
                : data instanceof ArrayBuffer
                  ? Buffer.from(data).toString("utf8")
                  : String(data);
        const envelope = JSON.parse(text) as SignalEnvelopeInput;
        if (envelope.type !== eventType) {
          return;
        }

        clearTimeout(timeout);
        socket.off("message", onMessage);
        resolve(envelope as SignalEnvelopeByType<TType>);
      } catch (error) {
        clearTimeout(timeout);
        socket.off("message", onMessage);
        reject(error);
      }
    }

    socket.on("message", onMessage);
  });
}

async function allocatePort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const probe = new WebSocketServer({ port: 0 });

    probe.once("listening", () => {
      const info = probe.address();
      if (typeof info === "object" && info && "port" in info) {
        resolve(info.port);
      } else {
        reject(new Error("failed to resolve port"));
      }

      probe.close();
    });

    probe.once("error", reject);
  });
}

function connectPeer(port: number, peerId: string): WebSocket {
  return new WebSocket(`ws://127.0.0.1:${port}`);
}

function sendConnect(socket: WebSocket, peerId: string): void {
  socket.send(JSON.stringify(makeEnvelope(CONTROL_EVENT.CONNECT, { peerId })));
}

async function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) {
    return;
  }

  await new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
  });
}

test("connect, match, signal relay, and teardown smoke path", async () => {
  const port = await allocatePort();
  const smokeServer = createSocketServer(port);
  const peerA = connectPeer(port, "peer-a");
  const peerB = connectPeer(port, "peer-b");

  try {
    await Promise.all([waitForOpen(peerA), waitForOpen(peerB)]);

    const matchA = waitForEnvelope(peerA, CONTROL_EVENT.MATCH_FOUND);
    const matchB = waitForEnvelope(peerB, CONTROL_EVENT.MATCH_FOUND);

    sendConnect(peerA, "peer-a");
    sendConnect(peerB, "peer-b");

    const [matchedA, matchedB] = await Promise.all([matchA, matchB]);
    assert.equal(matchedA.version, matchedB.version);
    assert.equal(matchedA.type, CONTROL_EVENT.MATCH_FOUND);
    assert.equal(matchedB.type, CONTROL_EVENT.MATCH_FOUND);

    const sessionId = matchedA.payload.sessionId;
    assert.equal(matchedB.payload.sessionId, sessionId);

    peerA.send(
      JSON.stringify(
        makeEnvelope(WEBRTC_SIGNAL_EVENT.OFFER, {
          sessionId,
          fromPeerId: "peer-a",
          sdp: "offer-sdp",
        }),
      ),
    );

    const relayedOffer = await waitForEnvelope(
      peerB,
      WEBRTC_SIGNAL_EVENT.OFFER,
    );
    assert.equal(relayedOffer.payload.fromPeerId, "peer-a");

    peerB.send(
      JSON.stringify(
        makeEnvelope(WEBRTC_SIGNAL_EVENT.ANSWER, {
          sessionId,
          fromPeerId: "peer-b",
          sdp: "answer-sdp",
        }),
      ),
    );

    const relayedAnswer = await waitForEnvelope(
      peerA,
      WEBRTC_SIGNAL_EVENT.ANSWER,
    );
    assert.equal(relayedAnswer.payload.fromPeerId, "peer-b");

    peerA.send(
      JSON.stringify(
        makeEnvelope(CONTROL_EVENT.DISCONNECT, {
          peerId: "peer-a",
          reason: "client_left",
        }),
      ),
    );

    const disconnectNotice = await waitForEnvelope(
      peerB,
      CONTROL_EVENT.DISCONNECT,
    );
    assert.equal(disconnectNotice.payload.peerId, "peer-a");
    assert.equal(disconnectNotice.payload.reason, "client_left");
  } finally {
    await Promise.all([closeSocket(peerA), closeSocket(peerB)]);
    await smokeServer.close();
  }
});

test("skip requeues the skipping peer and notifies the counterpart", async () => {
  const port = await allocatePort();
  const server = createSocketServer(port, { cleanupIntervalMs: 60_000 });
  const peerA = connectPeer(port, "skip-a");
  const peerB = connectPeer(port, "skip-b");
  const peerC = connectPeer(port, "skip-c");

  try {
    await Promise.all([
      waitForOpen(peerA),
      waitForOpen(peerB),
      waitForOpen(peerC),
    ]);

    const initialMatchA = waitForEnvelope(peerA, CONTROL_EVENT.MATCH_FOUND);
    const initialMatchB = waitForEnvelope(peerB, CONTROL_EVENT.MATCH_FOUND);

    sendConnect(peerA, "skip-a");
    sendConnect(peerB, "skip-b");

    const [matchedA, matchedB] = await Promise.all([
      initialMatchA,
      initialMatchB,
    ]);
    assert.equal(matchedA.payload.sessionId, matchedB.payload.sessionId);

    const skipNotice = waitForEnvelope(peerB, CONTROL_EVENT.SKIP);
    const rematchA = waitForEnvelope(peerA, CONTROL_EVENT.MATCH_FOUND);
    const rematchC = waitForEnvelope(peerC, CONTROL_EVENT.MATCH_FOUND);

    peerA.send(
      JSON.stringify(
        makeEnvelope(CONTROL_EVENT.SKIP, {
          peerId: "skip-a",
          previousSessionId: matchedA.payload.sessionId,
        }),
      ),
    );

    await skipNotice;

    sendConnect(peerC, "skip-c");

    const [rematchedA, rematchedC] = await Promise.all([rematchA, rematchC]);

    assert.equal(rematchedA.payload.sessionId, rematchedC.payload.sessionId);
    assert.equal(rematchedA.payload.localPeerId, "skip-a");
    assert.equal(rematchedC.payload.remotePeerId, "skip-a");
  } finally {
    await Promise.all([
      closeSocket(peerA),
      closeSocket(peerB),
      closeSocket(peerC),
    ]);
    await server.close();
  }
});

test("retry preserves the attempt counter and requeues the peer", async () => {
  const port = await allocatePort();
  const server = createSocketServer(port, { cleanupIntervalMs: 60_000 });
  const peerA = connectPeer(port, "retry-a");
  const peerB = connectPeer(port, "retry-b");
  const peerC = connectPeer(port, "retry-c");

  try {
    await Promise.all([
      waitForOpen(peerA),
      waitForOpen(peerB),
      waitForOpen(peerC),
    ]);

    const initialMatchA = waitForEnvelope(peerA, CONTROL_EVENT.MATCH_FOUND);
    const initialMatchB = waitForEnvelope(peerB, CONTROL_EVENT.MATCH_FOUND);

    sendConnect(peerA, "retry-a");
    sendConnect(peerB, "retry-b");

    const [matchedA, matchedB] = await Promise.all([
      initialMatchA,
      initialMatchB,
    ]);
    assert.equal(matchedA.payload.sessionId, matchedB.payload.sessionId);

    const retryNotice = waitForEnvelope(peerB, CONTROL_EVENT.RETRY);
    const rematchA = waitForEnvelope(peerA, CONTROL_EVENT.MATCH_FOUND);
    const rematchC = waitForEnvelope(peerC, CONTROL_EVENT.MATCH_FOUND);

    peerA.send(
      JSON.stringify(
        makeEnvelope(CONTROL_EVENT.RETRY, {
          peerId: "retry-a",
          attempt: 2,
        }),
      ),
    );

    await retryNotice;

    sendConnect(peerC, "retry-c");

    const [rematchedA, rematchedC] = await Promise.all([rematchA, rematchC]);

    assert.equal(rematchedA.payload.sessionId, rematchedC.payload.sessionId);
    assert.equal(rematchedA.payload.localPeerId, "retry-a");
    assert.equal(rematchedC.payload.remotePeerId, "retry-a");
  } finally {
    await Promise.all([
      closeSocket(peerA),
      closeSocket(peerB),
      closeSocket(peerC),
    ]);
    await server.close();
  }
});

test("session registry purges stale sessions and clears peer indexes", () => {
  const registry = new SessionRegistry();

  registry.add({
    sessionId: "session-a",
    firstPeerId: "peer-a",
    secondPeerId: "peer-b",
    createdAtMs: 100,
    firstRetryCount: 0,
    secondRetryCount: 1,
  });

  assert.equal(registry.getByPeerId("peer-a")?.sessionId, "session-a");
  assert.equal(registry.getByPeerId("peer-b")?.sessionId, "session-a");

  const staleSessions = registry.purgeOlderThan(150, 25);

  assert.equal(staleSessions.length, 1);
  assert.equal(staleSessions[0]?.sessionId, "session-a");
  assert.equal(registry.getByPeerId("peer-a"), undefined);
  assert.equal(registry.getByPeerId("peer-b"), undefined);
  assert.equal(registry.get("session-a"), undefined);
});
