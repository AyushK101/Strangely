import type { PeerId, SessionId } from "@strangely/shared";

export const PEER_PHASE = {
  IDLE: "idle",
  CONNECTING: "connecting",
  QUEUED: "queued",
  MATCHED: "matched",
  OFFERING: "offering",
  ANSWERING: "answering",
  CONNECTED: "connected",
  RETRYING: "retrying",
  RECONNECTING: "reconnecting",
  TEARING_DOWN: "tearingDown",
  TIMED_OUT: "timedOut",
  DISCONNECTED: "disconnected",
} as const;

export type PeerPhase = (typeof PEER_PHASE)[keyof typeof PEER_PHASE];

export interface PeerLifecycleState {
  phase: PeerPhase;
  localPeerId: PeerId | undefined;
  remotePeerId: PeerId | undefined;
  sessionId: SessionId | undefined;
  attempt: number;
  lastTransition: string;
}

export type PeerLifecycleEvent =
  | { type: "connect_requested"; peerId: PeerId }
  | {
      type: "match_found";
      sessionId: SessionId;
      localPeerId: PeerId;
      remotePeerId: PeerId;
    }
  | { type: "offer_created"; sdp: string }
  | { type: "answer_created"; sdp: string }
  | { type: "ice_candidate_sent"; candidate: string }
  | { type: "skip_requested"; previousSessionId: SessionId | undefined }
  | { type: "retry_requested"; attempt: number }
  | { type: "reconnect_requested" }
  | { type: "timeout_received"; sessionId: SessionId | undefined }
  | {
      type: "teardown_requested";
      reason:
        | "client_left"
        | "network_lost"
        | "server_shutdown"
        | "skip"
        | "retry"
        | "timeout";
    }
  | {
      type: "teardown_complete";
      reason:
        | "client_left"
        | "network_lost"
        | "server_shutdown"
        | "skip"
        | "retry"
        | "timeout";
    }
  | { type: "reset" };

export interface LifecycleTelemetryEntry {
  timestampMs: number;
  transition: string;
  phase: PeerPhase;
  eventType: PeerLifecycleEvent["type"];
}

export function createInitialPeerLifecycleState(): PeerLifecycleState {
  return {
    phase: PEER_PHASE.IDLE,
    localPeerId: undefined,
    remotePeerId: undefined,
    sessionId: undefined,
    attempt: 0,
    lastTransition: "idle",
  };
}

export function advancePeerLifecycleState(
  state: PeerLifecycleState,
  event: PeerLifecycleEvent,
): PeerLifecycleState {
  switch (event.type) {
    case "connect_requested":
      return {
        ...state,
        phase: PEER_PHASE.CONNECTING,
        localPeerId: event.peerId,
        lastTransition: `connect:${event.peerId}`,
      };
    case "match_found":
      return {
        ...state,
        phase: PEER_PHASE.MATCHED,
        localPeerId: event.localPeerId,
        remotePeerId: event.remotePeerId,
        sessionId: event.sessionId,
        lastTransition: `match:${event.sessionId}`,
      };
    case "offer_created":
      return {
        ...state,
        phase: PEER_PHASE.OFFERING,
        lastTransition: `offer:${event.sdp.length}`,
      };
    case "answer_created":
      return {
        ...state,
        phase: PEER_PHASE.ANSWERING,
        lastTransition: `answer:${event.sdp.length}`,
      };
    case "ice_candidate_sent":
      return {
        ...state,
        phase: PEER_PHASE.CONNECTED,
        lastTransition: `ice:${event.candidate.length}`,
      };
    case "skip_requested":
      return {
        ...state,
        phase: PEER_PHASE.RETRYING,
        sessionId: event.previousSessionId ?? state.sessionId,
        attempt: state.attempt + 1,
        lastTransition: "skip_requested",
      };
    case "retry_requested":
      return {
        ...state,
        phase: PEER_PHASE.RECONNECTING,
        attempt: event.attempt,
        lastTransition: `retry:${event.attempt}`,
      };
    case "reconnect_requested":
      return {
        ...state,
        phase: PEER_PHASE.RECONNECTING,
        attempt: state.attempt + 1,
        lastTransition: "reconnect_requested",
      };
    case "timeout_received":
      return {
        ...state,
        phase: PEER_PHASE.TIMED_OUT,
        sessionId: event.sessionId ?? state.sessionId,
        lastTransition: "timeout_received",
      };
    case "teardown_requested":
      return {
        ...state,
        phase: PEER_PHASE.TEARING_DOWN,
        lastTransition: `teardown:${event.reason}`,
      };
    case "teardown_complete":
      return {
        ...state,
        phase: PEER_PHASE.DISCONNECTED,
        sessionId: undefined,
        remotePeerId: undefined,
        lastTransition: `closed:${event.reason}`,
      };
    case "reset":
      return createInitialPeerLifecycleState();
    default: {
      const exhaustiveCheck: never = event;
      return exhaustiveCheck;
    }
  }
}

export function createLifecycleTelemetryEntry(
  previousState: PeerLifecycleState,
  event: PeerLifecycleEvent,
  nextState: PeerLifecycleState,
): LifecycleTelemetryEntry {
  return {
    timestampMs: Date.now(),
    transition: `${previousState.phase} -> ${nextState.phase}`,
    phase: nextState.phase,
    eventType: event.type,
  };
}

export function describePeerLifecycleState(state: PeerLifecycleState): string {
  const peerBits = [state.localPeerId, state.remotePeerId].filter(Boolean);
  const peerSummary = peerBits.length > 0 ? peerBits.join(" ↔ ") : "waiting";

  return `${state.phase} | attempt ${state.attempt} | ${peerSummary}`;
}
