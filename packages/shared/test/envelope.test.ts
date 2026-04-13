import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTROL_EVENT,
  MESSAGE_ENVELOPE_VERSION,
  WEBRTC_SIGNAL_EVENT,
  signalEnvelopeSchema,
} from "../src/index.js";

const validEnvelopes = [
  {
    type: CONTROL_EVENT.CONNECT,
    payload: { peerId: "peer-a" },
  },
  {
    type: CONTROL_EVENT.DISCONNECT,
    payload: { peerId: "peer-a", reason: "client_left" as const },
  },
  {
    type: CONTROL_EVENT.TIMEOUT,
    payload: { peerId: "peer-a", sessionId: "session-a" },
  },
  {
    type: CONTROL_EVENT.SKIP,
    payload: { peerId: "peer-a", previousSessionId: "session-a" },
  },
  {
    type: CONTROL_EVENT.RETRY,
    payload: { peerId: "peer-a", attempt: 1 },
  },
  {
    type: CONTROL_EVENT.MATCH_FOUND,
    payload: {
      sessionId: "session-a",
      localPeerId: "peer-a",
      remotePeerId: "peer-b",
    },
  },
  {
    type: WEBRTC_SIGNAL_EVENT.OFFER,
    payload: {
      sessionId: "session-a",
      fromPeerId: "peer-a",
      sdp: "offer-sdp",
    },
  },
  {
    type: WEBRTC_SIGNAL_EVENT.ANSWER,
    payload: {
      sessionId: "session-a",
      fromPeerId: "peer-b",
      sdp: "answer-sdp",
    },
  },
  {
    type: WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE,
    payload: {
      sessionId: "session-a",
      fromPeerId: "peer-a",
      candidate: "candidate",
      sdpMid: "0",
      sdpMLineIndex: 0,
    },
  },
] as const;

test("accepts all versioned discriminated envelopes", () => {
  for (const envelope of validEnvelopes) {
    const result = signalEnvelopeSchema.safeParse({
      version: MESSAGE_ENVELOPE_VERSION,
      type: envelope.type,
      payload: envelope.payload,
      timestampMs: 1_700_000_000_000,
    });

    assert.equal(result.success, true, envelope.type);
    if (result.success) {
      assert.equal(result.data.version, MESSAGE_ENVELOPE_VERSION);
      assert.equal(result.data.type, envelope.type);
    }
  }
});

test("rejects invalid version or mismatched payload members", () => {
  assert.equal(
    signalEnvelopeSchema.safeParse({
      version: "v2",
      type: CONTROL_EVENT.CONNECT,
      payload: { peerId: "peer-a" },
      timestampMs: 1_700_000_000_000,
    }).success,
    false,
  );

  assert.equal(
    signalEnvelopeSchema.safeParse({
      version: MESSAGE_ENVELOPE_VERSION,
      type: CONTROL_EVENT.CONNECT,
      payload: { peerId: "" },
      timestampMs: 1_700_000_000_000,
    }).success,
    false,
  );

  assert.equal(
    signalEnvelopeSchema.safeParse({
      version: MESSAGE_ENVELOPE_VERSION,
      type: WEBRTC_SIGNAL_EVENT.OFFER,
      payload: {
        sessionId: "session-a",
        fromPeerId: "peer-a",
        candidate: "candidate",
      },
      timestampMs: 1_700_000_000_000,
    }).success,
    false,
  );
});
