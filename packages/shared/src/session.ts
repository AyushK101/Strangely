export type SessionId = string;
export type PeerId = string;

export type SessionLifecycleState =
  | "idle"
  | "queued"
  | "matched"
  | "connected"
  | "disconnected"
  | "timeout"
  | "skipped"
  | "retrying";

export interface MatchTicket {
  peerId: PeerId;
  createdAtMs: number;
  retryCount: number;
}
