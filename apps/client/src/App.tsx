import { CONTROL_EVENT, WEBRTC_SIGNAL_EVENT } from "@strangely/shared";

import {
  PEER_PHASE,
  describePeerLifecycleState,
  type PeerPhase,
} from "./peerLifecycle.js";
import { usePeerLifecycleController } from "./usePeerLifecycleController.js";

const PHASE_LABELS: Record<PeerPhase, string> = {
  [PEER_PHASE.IDLE]: "Idle",
  [PEER_PHASE.CONNECTING]: "Connecting",
  [PEER_PHASE.QUEUED]: "Queued",
  [PEER_PHASE.MATCHED]: "Matched",
  [PEER_PHASE.OFFERING]: "Offering",
  [PEER_PHASE.ANSWERING]: "Answering",
  [PEER_PHASE.CONNECTED]: "Connected",
  [PEER_PHASE.RETRYING]: "Retrying",
  [PEER_PHASE.RECONNECTING]: "Reconnecting",
  [PEER_PHASE.TEARING_DOWN]: "Tearing down",
  [PEER_PHASE.TIMED_OUT]: "Timed out",
  [PEER_PHASE.DISCONNECTED]: "Disconnected",
};

function createPeerId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function App() {
  const { state, telemetry, dispatch, reset } = usePeerLifecycleController();

  const phaseLabel = PHASE_LABELS[state.phase];
  const summary = describePeerLifecycleState(state);

  function handleConnect(): void {
    dispatch({
      type: "connect_requested",
      peerId: state.localPeerId ?? createPeerId("peer"),
    });
  }

  function handleMatch(): void {
    const localPeerId = state.localPeerId ?? createPeerId("peer");
    dispatch({
      type: "match_found",
      sessionId: createPeerId("session"),
      localPeerId,
      remotePeerId: createPeerId("remote"),
    });
  }

  function handleOffer(): void {
    dispatch({
      type: "offer_created",
      sdp: `offer:${state.sessionId ?? "demo"}`,
    });
  }

  function handleAnswer(): void {
    dispatch({
      type: "answer_created",
      sdp: `answer:${state.sessionId ?? "demo"}`,
    });
  }

  function handleIce(): void {
    dispatch({
      type: "ice_candidate_sent",
      candidate: `candidate:${state.sessionId ?? "demo"}`,
    });
  }

  function handleSkip(): void {
    dispatch({
      type: "skip_requested",
      previousSessionId: state.sessionId,
    });
  }

  function handleRetry(): void {
    dispatch({
      type: "retry_requested",
      attempt: state.attempt + 1,
    });
  }

  function handleReconnect(): void {
    dispatch({
      type: "reconnect_requested",
    });
  }

  function handleTeardown(): void {
    dispatch({
      type: "teardown_requested",
      reason: state.phase === PEER_PHASE.TIMED_OUT ? "timeout" : "client_left",
    });
  }

  function handleTeardownComplete(): void {
    dispatch({
      type: "teardown_complete",
      reason: state.phase === PEER_PHASE.TIMED_OUT ? "timeout" : "client_left",
    });
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Anonymous chat lifecycle</p>
          <h1>Client state machine, signaling controls, and recovery paths.</h1>
          <p className="hero-text">
            The client owns peer lifecycle, WebRTC negotiation state, retry and
            reconnect UX, and lifecycle telemetry. The server remains signaling
            and matchmaking only.
          </p>
        </div>

        <div className="hero-panel">
          <div className="status-row">
            <span className="status-pill">{phaseLabel}</span>
            <span className="status-muted">attempt {state.attempt}</span>
          </div>
          <div className="status-summary">{summary}</div>
          <div className="signal-grid">
            <div>
              <span>WebSocket control</span>
              <strong>{CONTROL_EVENT.CONNECT}</strong>
            </div>
            <div>
              <span>Peer relay</span>
              <strong>{WEBRTC_SIGNAL_EVENT.OFFER}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard">
        <article className="card lifecycle-card">
          <div className="card-head">
            <h2>Peer lifecycle</h2>
            <button className="ghost-button" type="button" onClick={reset}>
              Reset state
            </button>
          </div>

          <div className="lifecycle-grid">
            <div>
              <span>Local peer</span>
              <strong>{state.localPeerId ?? "not connected"}</strong>
            </div>
            <div>
              <span>Remote peer</span>
              <strong>{state.remotePeerId ?? "waiting"}</strong>
            </div>
            <div>
              <span>Session</span>
              <strong>{state.sessionId ?? "unassigned"}</strong>
            </div>
            <div>
              <span>Last transition</span>
              <strong>{state.lastTransition}</strong>
            </div>
          </div>

          <div className="button-row">
            <button type="button" onClick={handleConnect}>
              Connect
            </button>
            <button type="button" onClick={handleMatch}>
              Match
            </button>
            <button type="button" onClick={handleOffer}>
              Offer
            </button>
            <button type="button" onClick={handleAnswer}>
              Answer
            </button>
            <button type="button" onClick={handleIce}>
              ICE
            </button>
            <button type="button" onClick={handleSkip}>
              Skip
            </button>
            <button type="button" onClick={handleRetry}>
              Retry
            </button>
            <button type="button" onClick={handleReconnect}>
              Reconnect
            </button>
            <button type="button" onClick={handleTeardown}>
              Teardown
            </button>
            <button type="button" onClick={handleTeardownComplete}>
              Complete teardown
            </button>
          </div>
        </article>

        <article className="card telemetry-card">
          <div className="card-head">
            <h2>Lifecycle telemetry</h2>
            <span className="status-muted">{telemetry.length} events</span>
          </div>

          <ul className="telemetry-list">
            {telemetry.length === 0 ? (
              <li className="telemetry-empty">
                Actions you trigger here will be recorded as lifecycle
                telemetry.
              </li>
            ) : (
              telemetry
                .slice()
                .reverse()
                .map((entry) => (
                  <li key={`${entry.timestampMs}-${entry.eventType}`}>
                    <strong>{entry.eventType}</strong>
                    <span>{entry.transition}</span>
                    <time>
                      {new Date(entry.timestampMs).toLocaleTimeString()}
                    </time>
                  </li>
                ))
            )}
          </ul>
        </article>
      </section>

      <section className="card protocol-card">
        <div className="card-head">
          <h2>Protocol surface</h2>
        </div>

        <div className="protocol-columns">
          <div>
            <h3>Control plane</h3>
            <ul>
              <li>{CONTROL_EVENT.CONNECT}</li>
              <li>{CONTROL_EVENT.DISCONNECT}</li>
              <li>{CONTROL_EVENT.TIMEOUT}</li>
              <li>{CONTROL_EVENT.SKIP}</li>
              <li>{CONTROL_EVENT.RETRY}</li>
              <li>{CONTROL_EVENT.MATCH_FOUND}</li>
            </ul>
          </div>
          <div>
            <h3>WebRTC relay</h3>
            <ul>
              <li>{WEBRTC_SIGNAL_EVENT.OFFER}</li>
              <li>{WEBRTC_SIGNAL_EVENT.ANSWER}</li>
              <li>{WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE}</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
