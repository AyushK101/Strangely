import { useReducer } from "react";

import {
  advancePeerLifecycleState,
  createInitialPeerLifecycleState,
  createLifecycleTelemetryEntry,
  type LifecycleTelemetryEntry,
  type PeerLifecycleEvent,
  type PeerLifecycleState,
} from "./peerLifecycle.js";

export interface PeerLifecycleController {
  state: PeerLifecycleState;
  telemetry: LifecycleTelemetryEntry[];
  dispatch: (event: PeerLifecycleEvent) => void;
  reset: () => void;
}

interface PeerLifecycleControllerState {
  state: PeerLifecycleState;
  telemetry: LifecycleTelemetryEntry[];
}

function createInitialControllerState(): PeerLifecycleControllerState {
  return {
    state: createInitialPeerLifecycleState(),
    telemetry: [],
  };
}

export function usePeerLifecycleController(): PeerLifecycleController {
  const [controllerState, dispatchControllerEvent] = useReducer(
    (
      previous: PeerLifecycleControllerState,
      event: PeerLifecycleEvent | { type: "reset_controller" },
    ): PeerLifecycleControllerState => {
      if (event.type === "reset_controller") {
        return createInitialControllerState();
      }

      const nextState = advancePeerLifecycleState(previous.state, event);
      return {
        state: nextState,
        telemetry: [
          ...previous.telemetry,
          createLifecycleTelemetryEntry(previous.state, event, nextState),
        ],
      };
    },
    undefined,
    createInitialControllerState,
  );

  const dispatch = (event: PeerLifecycleEvent): void => {
    dispatchControllerEvent(event);
  };

  const reset = (): void => {
    dispatchControllerEvent({ type: "reset_controller" });
  };

  return {
    state: controllerState.state,
    telemetry: controllerState.telemetry,
    dispatch,
    reset,
  };
}
