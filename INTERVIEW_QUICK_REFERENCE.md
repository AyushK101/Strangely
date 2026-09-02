# Strangely: Interview Quick Reference

## 30-Second Pitch

**Strangely** is an anonymous peer-to-peer video chat built on WebRTC with WebSocket signaling. The server only handles matchmaking and SDP relay; all media flows directly between browsers. It's a production-ready blueprint for real-time P2P applications demonstrating clean architecture, type safety, and scalability.

---

## System At a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                     STRANGELY ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  CLIENT A          WebSocket (Control Plane)          CLIENT B   │
│  ┌────────┐       ◄─────────────────────────►        ┌────────┐ │
│  │React   │                                          │React   │ │
│  │Vite    │─────────────────────────────────────────│Vite    │ │
│  │WebRTC  │    WebRTC Connection (Media Plane)     │WebRTC  │ │
│  └────────┘                                          └────────┘ │
│                                                                   │
│                      ▼ (Control Only)                            │
│                  ┌──────────────┐                                │
│                  │   SERVER     │                                │
│                  │              │                                │
│                  │ Matchmaking  │                                │
│                  │ SessionMgmt  │                                │
│                  │ Relay        │                                │
│                  └──────────────┘                                │
│                                                                   │
│  KEY: Server never touches media. Only relays SDP & ICE.        │
│       Media (audio/video/chat) flows 100% peer-to-peer.         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Five Core Concepts

### 1. **Message Envelope** (Shared Contract)

Every message has:

```
{
  version: "v1",                    // Protocol versioning
  type: "control.connect" | ...,   // Discriminated type
  payload: { ... },                 // Typed data
  requestId?: "...",                // Optional correlation
  timestampMs: 1234567890          // Epoch time
}
```

**Why?** Protocol evolution without breaking clients. Type discrimination enables safe dispatch.

---

### 2. **Control Plane** (Server owns)

| Event                | Direction | Purpose                         |
| -------------------- | --------- | ------------------------------- |
| `control.connect`    | C→S       | Enter matchmaking queue         |
| `control.matchFound` | S→C       | Peer matched, start negotiation |
| `control.disconnect` | C→S       | Leave session                   |
| `control.skip`       | C→S       | Request next match              |
| `control.timeout`    | S→C       | Session expired                 |

---

### 3. **Media Plane** (P2P only)

| Event                 | Direction      | Purpose                         |
| --------------------- | -------------- | ------------------------------- |
| `webrtc.offer`        | C→S→C          | SDP offer (connection proposal) |
| `webrtc.answer`       | C→S→C          | SDP answer (connection accept)  |
| `webrtc.iceCandidate` | C→S→C          | Network path candidate          |
| Chat data             | **C↔C direct** | Text messages (NOT via server)  |

**Key:** Server only relays signaling. All data flows peer-to-peer.

---

### 4. **Session Registry** (Server state)

```
Map<SessionId, {
  sessionId: SessionId,
  clientASocket: WebSocket,
  clientBSocket: WebSocket,
  clientAPeerId: PeerId,
  clientBPeerId: PeerId,
  state: "active" | "closed"
}>
```

**Why?** Authoritative mapping for relay decisions. Prevents peer spoofing.

---

### 5. **Matchmaker Queue** (Server state)

```
Queue of {
  peerId: PeerId,
  socket: WebSocket,
  enqueuedAt: timestamp,
  retryCount: number
}
```

**Why?** FIFO ensures fairness. Socket binding enables deterministic dequeue.

---

## Client State Machine (7 States)

```
idle
  ↓ [User clicks "Find"]
searching/queue
  ↓ [Server sends matchFound]
matched
  ↓ [Create offer or receive offer]
negotiating
  ↓ [Answer received, ICE settled]
connected
  ↓ [User clicks skip]
searching/queue (retry)
  ↑ [Timeout or error] ← → idle
```

---

## Server Event Loop (Pseudocode)

```typescript
on("control.connect", (msg) => {
  const ticket = matchmaker.enqueue(msg.payload.peerId);
  const match = matchmaker.tryMatch();
  if (match) {
    sessionRegistry.create(...);
    send(matchFound to both clients);
  }
});

on("webrtc.offer", (msg) => {
  const session = sessionRegistry.getSession(msg.payload.sessionId);
  relay(msg to counterpart socket);
});

on("socket.close", () => {
  if (socket in active session)
    sessionRegistry.closeSession(...);
  else
    matchmaker.removeFromQueue(socket);
});
```

---

## Critical Design Decisions

### ✅ Server Identity Binding

**Problem:** Client can lie about peerId.
**Solution:** Server binds peerId to socket at `control.connect`. Uses that binding for relay (ignores client-supplied peerId).
**Benefit:** Prevents peer spoofing.

---

### ✅ FIFO Matching

**Problem:** How to pair fairly?
**Solution:** Dequeue oldest two peers.
**Benefit:** Simple, fair, deterministic, testable.
**Caveat:** Not latency-aware.

---

### ✅ Best-Effort Relay

**Problem:** What if counterpart socket is closed?
**Solution:** Log and ignore. Client timeout handlers catch failures.
**Benefit:** Avoid blocking. Simplifies error recovery.

---

### ✅ Nominal Types

**Problem:** Easy to mix SessionId and PeerId.
**Solution:** Use TypeScript branded types.

```typescript
export type SessionId = string & { readonly __brand: "SessionId" };
export type PeerId = string & { readonly __brand: "PeerId" };
```

**Benefit:** Compiler prevents accidental swaps.

---

## Interview Q&A

**Q: Where is the data encrypted?**
A: By WebRTC itself. Browser → Server is TLS (ws:// → wss://). Browser ↔ Browser is DTLS-SRTP (WebRTC builtin). Server never sees media.

**Q: How do you handle NAT/firewall?**
A: STUN discovers public IP:port. TURN relays if direct connection fails. Configured in `RTC_CONFIGURATION`.

**Q: What if offer/answer are lost?**
A: Retransmit at application layer (client handles timeout). Or accept best-effort SDP exchange (most WebRTC apps do).

**Q: Can this scale to 1M users?**
A: No (single process). Add:

- Redis for session registry (horizontal sharding by sessionId)
- Peer hashing for queue segments (latency awareness)
- Load balancer with sticky sessions
- Optional SFU for media relay if P2P fails

**Q: What if someone DCAs (Distributed Denial of Attack)?**
A: Rate-limit by IP. Drop malformed envelopes. Validate before processing.

**Q: Can you add group chat?**
A: Yes. Extend `matchFound` to include N peers. Clients create N data channels. Or add SFU for many-to-many media.

**Q: How do you handle disconnections?**
A: WebSocket close → remove session/queue entry. Counterpart gets timeout notification. Client retry loop reconnects.

**Q: Is the server stateless?**
A: No. Holds session registry + matchmaker queue in memory. Not HA by design (current version). Add Redis for persistence.

---

## File Map

| File                                            | Responsibility                          |
| ----------------------------------------------- | --------------------------------------- |
| `packages/shared/src/envelope.ts`               | Message versioning, runtime validation  |
| `packages/shared/src/signaling.ts`              | Control + WebRTC event type definitions |
| `apps/server/src/signaling/socketServer.ts`     | WebSocket event ingestion and dispatch  |
| `apps/server/src/matchmaking/matchmaker.ts`     | Queue, FIFO pairing, dequeue            |
| `apps/server/src/sessions/sessionRegistry.ts`   | Active session tracking, relay routing  |
| `apps/client/src/App.tsx`                       | UI orchestration, stage transitions     |
| `apps/client/src/peerLifecycle.ts`              | State machine, event sequencing, retry  |
| `apps/client/src/usePeerLifecycleController.ts` | Custom hook wrapping lifecycle          |

---

## Tradeoffs

### Pros

✅ Clean separation: server controls only; media peer-only
✅ Type-safe: Zod validation + nominal types
✅ Low-latency: No server in media path
✅ Scalable media: O(1) per connection (peer-to-peer)
✅ End-to-end encrypted: Server can't eavesdrop
✅ Simple to operate: Single Node.js process

### Cons

❌ Single point of failure (no HA)
❌ In-memory state (no persistence)
❌ NAT/firewall complexity (mitigated by STUN/TURN)
❌ Not latency-aware (FIFO matching)
❌ No session history (anonymous design)

---

## Scalability Path

| Bottleneck            | Fix                                        | Effort |
| --------------------- | ------------------------------------------ | ------ |
| Single server crash   | Use Redis session registry, load balancer  | Medium |
| Queue fairness        | Segment by latency/region, priority queues | Medium |
| Stale session cleanup | Event-driven TTL (Redis)                   | Low    |
| Media relay failures  | Add SFU (Selective Forwarding Unit)        | High   |
| Server CPU            | Shard matchmaker by peer hash              | High   |

---

## Testing Checklist

- [ ] Envelope validation (Zod schema)
- [ ] FIFO pairing (matchmaker logic)
- [ ] Session relay (correct socket routing)
- [ ] Timeout cleanup (stale session detection)
- [ ] Disconnect handling (socket close)
- [ ] Skip/retry flow (queue re-entry)
- [ ] Client state transitions (stage machine)
- [ ] WebRTC negotiation (offer/answer/ICE)
- [ ] Chat messaging (data channel)
- [ ] Network fault injection (packet loss, latency)

---

## Elevator Pitch Variations

### For Backend Engineer

"Strangely is a real-time P2P system with strict plane separation: server owns matchmaking and signaling relay using deterministic FIFO matching and session registry; clients own WebRTC negotiation and direct media/data transport. Demonstrates idempotent control flow, resilient error handling, and clear scalability patterns."

### For Frontend Engineer

"Built a React + Vite WebRTC client with a robust state machine covering discovery, negotiation, connection, retry, and timeout flows. Implements envelope-based messaging with Zod validation, manages RTCPeerConnection lifecycle including offer/answer/ICE exchange, and coordinates with server for matchmaking."

### For Full-Stack

"Designed and implemented a production-ready monorepo (client, server, shared contracts) demonstrating clean architecture, type safety, and P2P resilience. Server uses WebSocket for deterministic control plane (matchmaking, session registry, signaling relay). Clients own WebRTC for media plane. Includes backward-compatible envelope versioning and comprehensive error recovery."

---

## Key Metrics to Know

- **Latency**: Signaling ~50–100ms. Media negotiation ~500–2000ms (ICE). Total connection: ~2–3s.
- **Throughput**: Audio bitrate ~30–50 kbps. Video (720p) ~500–2000 kbps. Limited by network, not server.
- **Concurrency**: Single server: ~1000–5000 concurrent sessions (depends on CPU/memory).
- **Queue depth**: Typical 10–100 waiting peers (sub-second match time).

---

## Gotchas to Avoid in Interview

❌ "The server streams media."  
✅ "The server only relays SDP and ICE; media goes direct peer-to-peer."

❌ "Messages are encrypted on the server."  
✅ "TLS encrypts control messages to the server. Media is encrypted by WebRTC (DTLS-SRTP)."

❌ "Matchmaker uses random pairing."  
✅ "Matchmaker uses FIFO (oldest two peers). Deterministic and fair."

❌ "Storing user data for chat history."  
✅ "Anonymous design: server stores only transient session state, not user data."

---

## Resources to Review Before Interview

1. Reread `INTERVIEW_DESIGN.md` (this repo)
2. Skim `docs/architecture.md` and `docs/api.md`
3. Walk through `apps/server/src/signaling/socketServer.ts` (main event loop)
4. Walk through `apps/client/src/App.tsx` (stage transitions)
5. Trace one full flow: "User A clicks Find → Match → Connect → Chat → Skip"

---

## Closing Argument

> "Strangely demonstrates production-ready P2P architecture: strict separation of concerns (control vs. media planes), type-safe contracts with runtime validation, deterministic matching for fairness, and clear scaling patterns. It's a blueprint for real-time applications that can evolve from a single node to a distributed system as load grows."

---

## Visual Summary (One Pager)

```
DISCOVERY          NEGOTIATION           CONNECTION
   ↓                    ↓                      ↓
Alice: Find ─────────────────────────────── Bob: Find
                       ↓
                  Server matches
                    (FIFO queue)
                       ↓
    Alice ←──── matchFound ──→ Bob
                       ↓
    Alice creates RTCPeerConnection
                       ↓
    Alice sends SDP offer via server
                       ↓
    Bob creates RTCPeerConnection
                       ↓
    Bob sends SDP answer via server
                       ↓
    Both exchange ICE candidates
                       ↓
    ICE completes, connection ready
                       ↓
    Alice & Bob: Chat peer-to-peer
    (server is NOT in this path)
                       ↓
    Alice clicks Skip
                       ↓
    Session closed, both re-queue
                       ↓
    (cycle repeats)
```
