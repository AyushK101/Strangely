import type { PeerId, SessionId } from "@strangely/shared";

export interface SessionRecord {
  sessionId: SessionId;
  firstPeerId: PeerId;
  secondPeerId: PeerId;
  createdAtMs: number;
}

export class SessionRegistry {
  private readonly byId = new Map<SessionId, SessionRecord>();

  add(record: SessionRecord): void {
    this.byId.set(record.sessionId, record);
  }

  remove(sessionId: SessionId): void {
    this.byId.delete(sessionId);
  }

  get(sessionId: SessionId): SessionRecord | undefined {
    return this.byId.get(sessionId);
  }
}
