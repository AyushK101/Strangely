import { z } from "zod";

import {
  MESSAGE_ENVELOPE_VERSION,
  makeMessageEnvelopeSchema,
} from "./envelope.js";
import type { MessageEnvelope } from "./envelope.js";
import type { PeerId, SessionId } from "./session.js";

export const CONTROL_EVENT = {
  CONNECT: "control.connect",
  DISCONNECT: "control.disconnect",
  TIMEOUT: "control.timeout",
  SKIP: "control.skip",
  RETRY: "control.retry",
  MATCH_FOUND: "control.matchFound",
} as const;

export const WEBRTC_SIGNAL_EVENT = {
  OFFER: "webrtc.offer",
  ANSWER: "webrtc.answer",
  ICE_CANDIDATE: "webrtc.iceCandidate",
} as const;

export const ALL_SIGNAL_EVENT = {
  ...CONTROL_EVENT,
  ...WEBRTC_SIGNAL_EVENT,
} as const;

export type ControlEventType =
  (typeof CONTROL_EVENT)[keyof typeof CONTROL_EVENT];
export type WebRtcSignalEventType =
  (typeof WEBRTC_SIGNAL_EVENT)[keyof typeof WEBRTC_SIGNAL_EVENT];
export type SignalEventType =
  (typeof ALL_SIGNAL_EVENT)[keyof typeof ALL_SIGNAL_EVENT];

export interface ConnectPayload {
  peerId: PeerId;
}

export interface DisconnectPayload {
  peerId: PeerId;
  reason: "client_left" | "network_lost" | "server_shutdown";
}

export interface TimeoutPayload {
  peerId: PeerId;
  sessionId?: SessionId;
}

export interface SkipPayload {
  peerId: PeerId;
  previousSessionId?: SessionId;
}

export interface RetryPayload {
  peerId: PeerId;
  attempt: number;
}

export interface MatchFoundPayload {
  sessionId: SessionId;
  localPeerId: PeerId;
  remotePeerId: PeerId;
}

export interface OfferPayload {
  sessionId: SessionId;
  fromPeerId: PeerId;
  sdp: string;
}

export interface AnswerPayload {
  sessionId: SessionId;
  fromPeerId: PeerId;
  sdp: string;
}

export interface IceCandidatePayload {
  sessionId: SessionId;
  fromPeerId: PeerId;
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
}

export type SignalPayloadByType = {
  [CONTROL_EVENT.CONNECT]: ConnectPayload;
  [CONTROL_EVENT.DISCONNECT]: DisconnectPayload;
  [CONTROL_EVENT.TIMEOUT]: TimeoutPayload;
  [CONTROL_EVENT.SKIP]: SkipPayload;
  [CONTROL_EVENT.RETRY]: RetryPayload;
  [CONTROL_EVENT.MATCH_FOUND]: MatchFoundPayload;
  [WEBRTC_SIGNAL_EVENT.OFFER]: OfferPayload;
  [WEBRTC_SIGNAL_EVENT.ANSWER]: AnswerPayload;
  [WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE]: IceCandidatePayload;
};

export type SignalEnvelope<TType extends SignalEventType = SignalEventType> =
  MessageEnvelope<TType, SignalPayloadByType[TType]>;

export const connectPayloadSchema = z.object({
  peerId: z.string().min(1),
});

export const disconnectPayloadSchema = z.object({
  peerId: z.string().min(1),
  reason: z.enum(["client_left", "network_lost", "server_shutdown"]),
});

export const timeoutPayloadSchema = z.object({
  peerId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
});

export const skipPayloadSchema = z.object({
  peerId: z.string().min(1),
  previousSessionId: z.string().min(1).optional(),
});

export const retryPayloadSchema = z.object({
  peerId: z.string().min(1),
  attempt: z.number().int().nonnegative(),
});

export const matchFoundPayloadSchema = z.object({
  sessionId: z.string().min(1),
  localPeerId: z.string().min(1),
  remotePeerId: z.string().min(1),
});

export const offerPayloadSchema = z.object({
  sessionId: z.string().min(1),
  fromPeerId: z.string().min(1),
  sdp: z.string().min(1),
});

export const answerPayloadSchema = z.object({
  sessionId: z.string().min(1),
  fromPeerId: z.string().min(1),
  sdp: z.string().min(1),
});

export const iceCandidatePayloadSchema = z.object({
  sessionId: z.string().min(1),
  fromPeerId: z.string().min(1),
  candidate: z.string().min(1),
  sdpMid: z.string().min(1).optional(),
  sdpMLineIndex: z.number().int().nonnegative().optional(),
});

const connectEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(CONTROL_EVENT.CONNECT),
  connectPayloadSchema,
);

const disconnectEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(CONTROL_EVENT.DISCONNECT),
  disconnectPayloadSchema,
);

const timeoutEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(CONTROL_EVENT.TIMEOUT),
  timeoutPayloadSchema,
);

const skipEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(CONTROL_EVENT.SKIP),
  skipPayloadSchema,
);

const retryEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(CONTROL_EVENT.RETRY),
  retryPayloadSchema,
);

const matchFoundEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(CONTROL_EVENT.MATCH_FOUND),
  matchFoundPayloadSchema,
);

const offerEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(WEBRTC_SIGNAL_EVENT.OFFER),
  offerPayloadSchema,
);

const answerEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(WEBRTC_SIGNAL_EVENT.ANSWER),
  answerPayloadSchema,
);

const iceCandidateEnvelopeSchema = makeMessageEnvelopeSchema(
  z.literal(WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE),
  iceCandidatePayloadSchema,
);

export const signalEnvelopeSchema = z.discriminatedUnion("type", [
  connectEnvelopeSchema,
  disconnectEnvelopeSchema,
  timeoutEnvelopeSchema,
  skipEnvelopeSchema,
  retryEnvelopeSchema,
  matchFoundEnvelopeSchema,
  offerEnvelopeSchema,
  answerEnvelopeSchema,
  iceCandidateEnvelopeSchema,
]);

export const signalEnvelopeVersionSchema = z.literal(MESSAGE_ENVELOPE_VERSION);

export type SignalEnvelopeInput = z.infer<typeof signalEnvelopeSchema>;
