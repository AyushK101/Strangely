import type { MatchTicket, PeerId } from "@strangely/shared";

export interface MatchPair {
  first: MatchTicket;
  second: MatchTicket;
}

export class Matchmaker {
  private readonly queue: MatchTicket[] = [];
  private readonly queuedPeerIds = new Set<PeerId>();

  enqueue(
    peerId: PeerId,
    retryCount = 0,
    createdAtMs = Date.now(),
  ): MatchPair | null {
    if (this.queuedPeerIds.has(peerId)) {
      return null;
    }

    const ticket: MatchTicket = { peerId, createdAtMs, retryCount };

    while (this.queue.length > 0) {
      const waiting = this.queue.shift();
      if (!waiting) {
        break;
      }

      this.queuedPeerIds.delete(waiting.peerId);

      if (waiting.peerId === peerId) {
        continue;
      }

      return { first: waiting, second: ticket };
    }

    this.queue.push(ticket);
    this.queuedPeerIds.add(peerId);
    return null;
  }

  drop(peerId: PeerId): void {
    let removed = false;

    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const ticket = this.queue[index];
      if (!ticket || ticket.peerId !== peerId) {
        continue;
      }

      this.queue.splice(index, 1);
      removed = true;
    }

    if (removed) {
      this.queuedPeerIds.delete(peerId);
    }
  }

  has(peerId: PeerId): boolean {
    return this.queuedPeerIds.has(peerId);
  }

  purgeOlderThan(nowMs: number, maxAgeMs: number): MatchTicket[] {
    const staleTickets: MatchTicket[] = [];

    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const ticket = this.queue[index];
      if (!ticket || nowMs - ticket.createdAtMs < maxAgeMs) {
        continue;
      }

      this.queue.splice(index, 1);
      this.queuedPeerIds.delete(ticket.peerId);
      staleTickets.push(ticket);
    }

    return staleTickets.reverse();
  }
}
