import type { PeerId, SessionId } from "@strangely/shared";

export interface SessionRecord {
  sessionId: SessionId;
  firstPeerId: PeerId;
  secondPeerId: PeerId;
  createdAtMs: number;
  firstRetryCount: number;
  secondRetryCount: number;
}

export class SessionRegistry {
  private readonly byId = new Map<SessionId, SessionRecord>();
  private readonly byPeerId = new Map<PeerId, SessionId>();

  add(record: SessionRecord): void {
    this.byId.set(record.sessionId, record);
    this.byPeerId.set(record.firstPeerId, record.sessionId);
    this.byPeerId.set(record.secondPeerId, record.sessionId);
  }

  remove(sessionId: SessionId): SessionRecord | undefined {
    const removed = this.byId.get(sessionId);
    if (!removed) {
      return undefined;
    }

    this.byId.delete(sessionId);
    this.byPeerId.delete(removed.firstPeerId);
    this.byPeerId.delete(removed.secondPeerId);
    return removed;
  }

  get(sessionId: SessionId): SessionRecord | undefined {
    return this.byId.get(sessionId);
  }

  getByPeerId(peerId: PeerId): SessionRecord | undefined {
    const sessionId = this.byPeerId.get(peerId);
    if (!sessionId) {
      return undefined;
    }

    return this.byId.get(sessionId);
  }

  removeByPeerId(peerId: PeerId): SessionRecord | undefined {
    const sessionId = this.byPeerId.get(peerId);
    if (!sessionId) {
      return undefined;
    }

    return this.remove(sessionId);
  }

  purgeOlderThan(nowMs: number, maxAgeMs: number): SessionRecord[] {
    const staleSessions: SessionRecord[] = [];

    for (const [sessionId, record] of this.byId.entries()) {
      if (nowMs - record.createdAtMs < maxAgeMs) {
        continue;
      }

      staleSessions.push(record);
      this.remove(sessionId);
    }

    return staleSessions;
  }
}
