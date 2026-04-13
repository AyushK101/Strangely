import assert from "node:assert/strict";
import test from "node:test";

import {
  advancePeerLifecycleState,
  createInitialPeerLifecycleState,
  describePeerLifecycleState,
  PEER_PHASE,
} from "../src/peerLifecycle.js";

test("client lifecycle reducer progresses through the main signaling phases", () => {
  const initialState = createInitialPeerLifecycleState();
  assert.equal(initialState.phase, PEER_PHASE.IDLE);

  const connectedState = advancePeerLifecycleState(initialState, {
    type: "connect_requested",
    peerId: "peer-a",
  });
  assert.equal(connectedState.phase, PEER_PHASE.CONNECTING);

  const matchedState = advancePeerLifecycleState(connectedState, {
    type: "match_found",
    sessionId: "session-a",
    localPeerId: "peer-a",
    remotePeerId: "peer-b",
  });
  assert.equal(matchedState.phase, PEER_PHASE.MATCHED);

  const offeringState = advancePeerLifecycleState(matchedState, {
    type: "offer_created",
    sdp: "offer-sdp",
  });
  assert.equal(offeringState.phase, PEER_PHASE.OFFERING);

  const answeringState = advancePeerLifecycleState(offeringState, {
    type: "answer_created",
    sdp: "answer-sdp",
  });
  assert.equal(answeringState.phase, PEER_PHASE.ANSWERING);

  const connectedAfterIce = advancePeerLifecycleState(answeringState, {
    type: "ice_candidate_sent",
    candidate: "candidate-a",
  });
  assert.equal(connectedAfterIce.phase, PEER_PHASE.CONNECTED);

  const skippedState = advancePeerLifecycleState(connectedAfterIce, {
    type: "skip_requested",
    previousSessionId: "session-a",
  });
  assert.equal(skippedState.phase, PEER_PHASE.RETRYING);

  const retryingState = advancePeerLifecycleState(skippedState, {
    type: "retry_requested",
    attempt: 2,
  });
  assert.equal(retryingState.phase, PEER_PHASE.RECONNECTING);

  const timedOutState = advancePeerLifecycleState(retryingState, {
    type: "timeout_received",
    sessionId: "session-b",
  });
  assert.equal(timedOutState.phase, PEER_PHASE.TIMED_OUT);

  const tearingDownState = advancePeerLifecycleState(timedOutState, {
    type: "teardown_requested",
    reason: "timeout",
  });
  assert.equal(tearingDownState.phase, PEER_PHASE.TEARING_DOWN);

  const finalState = advancePeerLifecycleState(tearingDownState, {
    type: "teardown_complete",
    reason: "timeout",
  });
  assert.equal(finalState.phase, PEER_PHASE.DISCONNECTED);
  assert.equal(
    describePeerLifecycleState(finalState).includes("disconnected"),
    true,
  );
});
