import type { MatchTicket, PeerId } from "@strangely/shared";

export interface MatchPair {
  first: MatchTicket;
  second: MatchTicket;
}

export class Matchmaker {
  private readonly queue: MatchTicket[] = [];

  enqueue(peerId: PeerId, retryCount = 0): MatchPair | null {
    const ticket: MatchTicket = { peerId, createdAtMs: Date.now(), retryCount };

    const waiting = this.queue.shift();
    if (!waiting) {
      this.queue.push(ticket);
      return null;
    }

    if (waiting.peerId === ticket.peerId) {
      this.queue.push(ticket);
      return null;
    }

    return { first: waiting, second: ticket };
  }

  drop(peerId: PeerId): void {
    const index = this.queue.findIndex((ticket) => ticket.peerId === peerId);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
  }
}
