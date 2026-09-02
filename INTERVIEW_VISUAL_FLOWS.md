# Strangely: Visual Architecture & Flow Diagrams

This document contains comprehensive visual diagrams for interview presentations.

---

## 1. System Architecture Layers

### 1.1 Complete System View

```
┌────────────────────────────────────────────────────────────────────────┐
│                          STRANGELY SYSTEM                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                      ┌──────────────────┐        │
│  │    CLIENT A      │                      │    CLIENT B      │        │
│  │  ┌────────────┐  │                      │  ┌────────────┐  │        │
│  │  │ UI Layer  │  │                      │  │ UI Layer  │  │        │
│  │  └────────────┘  │                      │  └────────────┘  │        │
│  │  ┌────────────┐  │                      │  ┌────────────┐  │        │
│  │  │Peer Lifecycle  │                      │  │Peer Lifecycle  │        │
│  │  │State Machine   │                      │  │State Machine   │        │
│  │  └────────────┘  │                      │  └────────────┘  │        │
│  │  ┌────────────┐  │                      │  ┌────────────┐  │        │
│  │  │WebSocket   │  │                      │  │WebSocket   │  │        │
│  │  │Client      │  │                      │  │Client      │  │        │
│  │  └────────────┘  │                      │  └────────────┘  │        │
│  │  ┌────────────┐  │                      │  ┌────────────┐  │        │
│  │  │WebRTC      │  │                      │  │WebRTC      │  │        │
│  │  │Peer Conn   │  │                      │  │Peer Conn   │  │        │
│  │  └────────────┘  │                      │  └────────────┘  │        │
│  └──────────────────┘                      └──────────────────┘        │
│           │ WebSocket (Control Plane)              │                   │
│           │◄─────────────────────────────────────►│                   │
│           │           vs. (Media Plane)            │                   │
│           │         (Direct Peer-to-Peer)          │                   │
│           │◄──────────WebRTC Connection───────────►│                   │
│           │       (Audio, Video, Chat Data)        │                   │
│           │                                         │                   │
│           ▼                                         ▼                   │
│  ┌────────────────────────────────────────────────────┐                │
│  │      SIGNALING SERVER (Node.js)                    │                │
│  │  ┌────────────────────────────────────────────┐   │                │
│  │  │ WebSocket Server                           │   │                │
│  │  │ - Message parsing & validation             │   │                │
│  │  │ - Socket connection management             │   │                │
│  │  └────────────────────────────────────────────┘   │                │
│  │  ┌────────────────────────────────────────────┐   │                │
│  │  │ Matchmaker                                 │   │                │
│  │  │ - Queue of waiting peers                   │   │                │
│  │  │ - FIFO matching algorithm                  │   │                │
│  │  │ - Timeout detection                        │   │                │
│  │  └────────────────────────────────────────────┘   │                │
│  │  ┌────────────────────────────────────────────┐   │                │
│  │  │ Session Registry                           │   │                │
│  │  │ - Map<SessionId, {clientA, clientB, ...}> │   │                │
│  │  │ - Relay routing logic                      │   │                │
│  │  │ - Session lifecycle (create/delete)        │   │                │
│  │  └────────────────────────────────────────────┘   │                │
│  └────────────────────────────────────────────────────┘                │
│                                                                          │
│  ┌────────────────────────────────────────────────────┐                │
│  │  SHARED TYPES & CONTRACTS (TypeScript)             │                │
│  │  - MessageEnvelope<T, P>                           │                │
│  │  - Control event types (connect, match, etc.)      │                │
│  │  - WebRTC event types (offer, answer, ICE)        │                │
│  │  - Zod validation schemas                          │                │
│  │  - PeerId, SessionId (branded types)               │                │
│  └────────────────────────────────────────────────────┘                │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 1.2 Control Plane vs. Media Plane

```
CONTROL PLANE (WebSocket, Server)
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  control.connect                                              │
│  ↓ (User clicks "Find")                                       │
│  ├─→ Server enqueues peer                                     │
│  ├─→ Server attempts FIFO match                               │
│  └─→ [If match found]                                         │
│                                                                │
│  control.matchFound                                           │
│  ↓ (Server broadcasts to both peers)                          │
│  ├─→ Both peers learn of each other                           │
│  └─→ Signals start of WebRTC negotiation                      │
│                                                                │
│  webrtc.offer / webrtc.answer / webrtc.iceCandidate          │
│  ↓ (Relayed by server)                                        │
│  ├─→ SDP offer from offerer → server → answerer              │
│  ├─→ SDP answer from answerer → server → offerer             │
│  └─→ ICE candidates from both → server → each other          │
│                                                                │
│  control.timeout / control.disconnect                        │
│  ↓ (Session cleanup)                                          │
│  ├─→ Server closes session                                    │
│  └─→ Notifies counterpart (best-effort)                       │
│                                                                │
└──────────────────────────────────────────────────────────────┘

MEDIA PLANE (WebRTC, Peer-to-Peer)
┌──────────────────────────────────────────────────────────────┐
│                                                                │
│  [After SDP exchange & ICE completion]                        │
│                                                                │
│  Audio Stream                                                 │
│  ↓ (via WebRTC)                                               │
│  ├─→ Client A's microphone → encode → packetize → peer    │
│  └─→ Peer receives → decode → play through speakers          │
│                                                                │
│  Video Stream                                                 │
│  ↓ (via WebRTC)                                               │
│  ├─→ Client A's camera → encode → packetize → peer        │
│  └─→ Peer receives → decode → render on canvas               │
│                                                                │
│  Data Channel (Chat)                                          │
│  ↓ (via WebRTC DataChannel)                                   │
│  ├─→ Client A types message → send() → peer                │
│  └─→ Peer receives message via ondatachannelmessage          │
│                                                                │
│  ⚠️  SERVER IS NOT IN THIS PATH ⚠️                            │
│  All media is encrypted by WebRTC (DTLS-SRTP)                │
│  Server has no visibility into audio/video/chat             │
│                                                                │
└──────────────────────────────────────────────────────────────┘

KEY SEPARATION:
  Control ↔ Server    (necessary for coordination)
  Media   ↔ Peer-only (direct, no server)
```

---

## 2. Detailed Flow Diagrams

### 2.1 Discovery → Negotiation → Connection Flow

```
STEP 1: DISCOVERY PHASE
─────────────────────

  CLIENT A                              SERVER                       CLIENT B
     │                                    │                            │
     │──── control.connect ───────────────→                            │
     │                                    │                            │
     │                                    ├─→ Enqueue(A)               │
     │                                    │                            │
     │                                    │                ───────────→│
     │                                    │       control.connect      │
     │                                    │                            │
     │                                    ├─→ Enqueue(B)               │
     │                                    │                            │
     │                                    ├─→ Match(A, B)              │
     │                                    │                            │
     │←── control.matchFound ─────────────┤                            │
     │ (sessionId, localPeerId=A,        │                            │
     │  remotePeerId=B)                   │                            │
     │                                    ├────→ control.matchFound ─→│
     │                                    │   (sessionId, localPeerId=B,
     │                                    │    remotePeerId=A)

STEP 2: NEGOTIATION PHASE
──────────────────────────

  CLIENT A                              SERVER                       CLIENT B
     │                                    │                            │
     ├─→ Create RTCPeerConnection         │                            │
     │                                    │                            │
     ├─→ createOffer()                    │                            │
     │                                    │                            │
     ├─→ setLocalDescription(offer)       │                            │
     │                                    │                            │
     │──── webrtc.offer ──────────────────→                            │
     │ (sessionId, fromPeerId=A, sdp)     │──── webrtc.offer ────────→│
     │                                    │                            │
     │                                    │         ├─→ Create RTC...
     │                                    │         ├─→ setRemote..
     │                                    │         ├─→ createAnswer()
     │                                    │         ├─→ setLocalDes...
     │                                    │                            │
     │←─── webrtc.answer ─────────────────┤         │                 │
     │ (sessionId, fromPeerId=B, sdp)     │←─ send answer ────────────┤
     │                                    │                            │
     ├─→ setRemoteDescription(answer)     │                            │
     │                                    │                            │

STEP 3: ICE GATHERING & CONNECTION
──────────────────────────────────

  CLIENT A                              SERVER                       CLIENT B
     │                                    │                            │
     ├─→ onicecandidate event fires       │                            │
     │                                    │                            │
     │──── webrtc.iceCandidate ──────────→                            │
     │                 ┌─────────────────→│──→ webrtc.iceCandidate ──→│
     │                 │                  │                            │
     │                 │                  │     addIceCandidate()      │
     │                 │                  │                            │
     │    ←──────────────────────────────┤         onicecandidate     │
     │    webrtc.iceCandidate ←─────────────────────────┤            │
     │                                    │              │             │
     │    addIceCandidate()                │              │             │
     │                                    │              ├──→ send candidate
     │                                    │              │             │
     │ ← ← ← Multiple ICE candidates ← ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←│
     │                                    │                            │
     ├─→ onconnectionstatechange:         │                            │
     │   "connected"                      │    ├─→ onconnectionstate..
     │                                    │    │    "connected"
     │                                    │    │

STEP 4: CONNECTED & READY
─────────────────────────

  CLIENT A                              SERVER                       CLIENT B
     │                                    │                            │
     ├─→ Create DataChannel               │                            │
     │   for chat                         │                            │
     │                                    │                            │
     │      (Server has NO role here)     │                            │
     │                                    │                            │
     │─────── dataChannel.send() ─────────────────────→ ondatachannel │
     │        (Chat message)             (No relay!)                    │
     │                                    │   (Direct encrypted P2P)   │
     │                                    │                            │
     │←─────── dataChannel message ──────────────────────|             │
     │                                    │                            │
```

---

### 2.2 Skip & Rematch Flow

```
STEP 1: USER INITIATES SKIP
──────────────────────────

  CLIENT A                              SERVER                       CLIENT B
     │                                    │                            │
     │ (in connected state)               │     (in connected state)   │
     │ User clicks "Skip"                 │                            │
     │                                    │                            │
     │──── control.skip ──────────────────→                            │
     │      (sessionId)                   │                            │
     │                                    │                            │
     │                                    ├─→ SessionRegistry.close()  │
     │                                    │                            │
     │                                    ├─→ Close RTCPeerConnection  │
     │                                    │    (both sides)             │
     │                                    │                            │
     │←─── control.disconnected ──────────┤                            │
     │      (reason: "skip")              │───→ control.disconnected ─→│
     │                                    │        (reason: "skip")     │
     │                                    │                            │

STEP 2: RE-ENTER MATCHMAKING
───────────────────────────

  CLIENT A                              SERVER                       CLIENT B
     │                                    │                            │
     │ (auto or manual retry)             │                            │
     │                                    │                            │
     │──── control.retry ─────────────────→                            │
     │      (retryCount=1)                ├─→ Enqueue(A, retryCount=1) │
     │                                    │                            │
     │                                    │       ───────────────────→ │
     │                                    │    control.retry           │
     │                                    │    (retryCount=1)          │
     │                                    │                            │
     │                                    ├─→ Enqueue(B, retryCount=1) │
     │                                    │                            │
     │                                    ├─→ Match(A', B')            │
     │ [Wait for new match]               │                            │
     │                                    ├─→ Create new SessionId     │
     │                                    │                            │
     │←── control.matchFound ─────────────┤                            │
     │ (newSessionId, different peer!)    │───→ control.matchFound ───→│
     │                                    │                            │
     │ ✅ New chat with different peer    │  ✅ New chat with different
     │                                    │                            │

STEP 3: REPEAT CYCLE
───────────────────

  [Peers are now ready to negotiate again with new peer]
  [Offer/Answer/ICE exchange begins again]
```

---

### 2.3 Timeout & Cleanup Flow

```
SERVER-SIDE PERIODIC MAINTENANCE
─────────────────────────────────

setInterval(() => {
  every 60 seconds
  ↓
  sessionRegistry.cleanupStale(maxAgeMs = 300_000)
  ↓
  for each session in registry:
    if (now - lastActivity > 300_000):  // 5 minutes
      ├─→ closeSession(sessionId, "timeout")
      ├─→ Notify ClientA: control.timeout
      ├─→ Notify ClientB: control.timeout
      └─→ Delete from registry

}, 60_000)


CLIENT-SIDE TIMEOUT HANDLING
────────────────────────────

  CLIENT A                              SERVER                       CLIENT B
     │                                    │                            │
     │ (connected, idle)                  │     (connected, idle)      │
     │                                    │                            │
     │        ← ← [5 minutes pass] ← ← ←  │                            │
     │                                    │                            │
     │                                    │  Background cleanup fires   │
     │                                    │  (lastActivity > 5 min)     │
     │                                    │                            │
     │←─── control.timeout ───────────────┤                            │
     │      (reason: "stale")             │───→ control.timeout ──────→│
     │                                    │       (reason: "stale")     │
     │                                    │                            │
     ├─→ Close RTCPeerConnection          │     Close RTCPeerConnection│
     │                                    │                            │
     ├─→ setStage("idle")                 │     setStage("idle")       │
     │                                    │                            │
     ├─→ Show: "Connection timed out"     │     Show: "Connection     │
     │   "Click Find to restart"          │            timed out"      │
     │                                    │                            │


SOCKET CLOSE HANDLER
────────────────────

  If Client closes browser or loses network:

  CLIENT A                              SERVER
     │                                    │
     │         [Network lost]             │
     │                                    │
     │ [WebSocket closes]                 │
     │                                    │
     │                                    ├─→ socket.on("close")
     │                                    │
     │                                    ├─→ if sessionId exists:
     │                                    │     SessionRegistry.close
     │                                    │     (send timeout to B)
     │                                    │
     │                                    ├─→ else:
     │                                    │     Matchmaker.remove(socket)
     │                                    │
     │                                    ├─→ Cleanup complete
```

---

## 3. State Machine Diagram (Extended)

```
                          ┌─────────────────────┐
                          │       IDLE          │
                          │  (App loads or      │
                          │   reset after end)  │
                          └──────────┬──────────┘
                                     │
                       User clicks "Find" button
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │  CONNECTING/QUEUE   │
                          │  (Waiting for match)│
                          │  - WebSocket open   │
                          │  - Enqueued locally │
                          └──────────┬──────────┘
                                     │
                    Server finds match, sends matchFound
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │     MATCHED         │
                          │  (Peer found)       │
                          │  - Know remote peer │
                          │  - Session created  │
                          └──────────┬──────────┘
                          ╱          │          ╲
                         ╱           │           ╲
           Offerer role  │  Answerer │   Either   Timeout
           (creates      │  role     │   way      or Error
            offer)       │  (gets    │           (rare)
                         │   offer)  │
                         ▼           ▼
                      ┌─────────────────────┐
                      │    NEGOTIATING      │
                      │  - SDP exchange     │
                      │  - ICE gathering    │
                      │  - Adding candidates│
                      └──────────┬──────────┘
                                 │
                    ICE completes, connection ready
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │    CONNECTED        │
                      │  - Chat enabled     │
                      │  - Can send/receive │
                      │  - RTCDataChannel   │
                      │    ready            │
                      └────────┬────────────┘
                    ╱  ╱  ╱   │   ╲  ╲  ╲
         User Skip │  │  │    │    │  │  │ Server
         clicks    │  │  │    │    │  │  │ timeout
         Skip btn  │  │  │    │    │  │  │ (5 min
                   │  │  │    │    │  │  │  idle)
                   │  │  │    │    │  │  │
                   ▼  ▼  ▼    │    ▼  ▼  ▼
              ┌─────────────────────────────┐
              │  WAITING_TEARDOWN /         │
              │  TIMEOUT                    │
              │  - Closing connection       │
              │  - Sending control messages │
              └──────────┬──────────────────┘
                         │
         (Reconnect or reset)
                         │
                         ▼
              ┌─────────────────────┐
              │      IDLE           │
              │  (Cycle repeats)    │
              └─────────────────────┘

ERROR PATHS:
  - ICE Failed: NEGOTIATING → ERROR → IDLE
  - Network Lost: [Any] → socket close → IDLE
  - Malformed Message: Logged, ignored
```

---

## 4. Data Structure Diagrams

### 4.1 Message Envelope Structure

```
┌────────────────────────────────────────────────┐
│           MessageEnvelope<TType, TPayload>     │
├────────────────────────────────────────────────┤
│                                                 │
│  version: "v1"                                 │
│  ├─→ Enables protocol evolution                │
│  └─→ Server can reject old clients             │
│                                                 │
│  type: "control.connect" | "webrtc.offer" | ..│
│  ├─→ Discriminated union for type-safe payload│
│  └─→ Enables deterministic dispatch            │
│                                                 │
│  payload: TPayload                             │
│  ├─→ Type-dependent data                       │
│  ├─→ Validated by Zod schema                   │
│  └─→ Never parsed as JSON directly (unsafe)    │
│                                                 │
│  requestId?: string (optional)                 │
│  ├─→ Correlates requests with responses        │
│  └─→ For future RPC patterns                   │
│                                                 │
│  timestampMs: number                           │
│  ├─→ Epoch time in milliseconds                │
│  ├─→ Used for timeout calculation              │
│  └─→ Diagnostic ordering                       │
│                                                 │
└────────────────────────────────────────────────┘

Example Messages:

control.connect Envelope:
{
  version: "v1",
  type: "control.connect",
  payload: { peerId: "peer-a1b2c3d4" },
  timestampMs: 1695125400000
}

webrtc.offer Envelope:
{
  version: "v1",
  type: "webrtc.offer",
  payload: {
    sessionId: "session-xyz789",
    fromPeerId: "peer-a1b2c3d4",
    sdp: "v=0\r\no=- 1234 ..."
  },
  requestId: "req-123",
  timestampMs: 1695125401000
}

control.timeout Envelope:
{
  version: "v1",
  type: "control.timeout",
  payload: {
    sessionId: "session-xyz789",
    reason: "stale"
  },
  timestampMs: 1695125700000
}
```

---

### 4.2 Session Registry Entry

```
┌─────────────────────────────────────────────────────┐
│  Session {                                          │
│                                                      │
│    sessionId: "session-xyz789"                      │
│    ├─→ Unique per matched pair                      │
│    ├─→ Assigned by server                           │
│    └─→ Used as routing key in relay                 │
│                                                      │
│    clientASocket: WebSocket                         │
│    ├─→ Active connection to Client A                │
│    ├─→ Used to send messages to A                   │
│    └─→ Null if A disconnects                        │
│                                                      │
│    clientBSocket: WebSocket                         │
│    ├─→ Active connection to Client B                │
│    ├─→ Used to send messages to B                   │
│    └─→ Null if B disconnects                        │
│                                                      │
│    clientAPeerId: "peer-a1b2c3d4"                   │
│    ├─→ Peer identity (from control.connect)         │
│    ├─→ Used to validate relay fromPeerId            │
│    └─→ Prevents peer spoofing                       │
│                                                      │
│    clientBPeerId: "peer-b5e6f7g8"                   │
│    ├─→ Peer identity (from control.connect)         │
│    ├─→ Used to validate relay fromPeerId            │
│    └─→ Prevents peer spoofing                       │
│                                                      │
│    createdAt: 1695125400000                         │
│    ├─→ Session birth time (epoch ms)                │
│    └─→ Used to detect very old sessions             │
│                                                      │
│    lastActivity: 1695125401000                      │
│    ├─→ Time of last relay or message                │
│    ├─→ Updated on every message through session     │
│    └─→ Used for stale session cleanup               │
│                                                      │
│    state: "active" | "closed"                       │
│    ├─→ "active": peers can relay                    │
│    ├─→ "closed": no new relays, pending cleanup     │
│    └─→ Prevents double-close bugs                   │
│                                                      │
│  }                                                   │
│                                                      │
│  ✓ All data is transient (not persisted)           │
│  ✓ Enables anonymous operation                      │
│  ✓ Lightweight memory footprint (<<1KB per session)│
│                                                      │
└─────────────────────────────────────────────────────┘

Registry Usage:
┌────────────────────────────────────┐
│ SessionRegistry (Map-based)         │
│                                     │
│ sessions: Map<SessionId, Session>   │
│           │                         │
│           ├─→ "session-xyz789" ────┐
│           │   {A, B, peers, time}  │
│           │                         │
│           ├─→ "session-abc456" ────┐
│           │   {C, D, peers, time}  │
│           │                         │
│           └─→ "session-def789" ────┐
│               {E, F, peers, time}  │
│                                     │
│  Methods:                           │
│  - create(): Add new session        │
│  - getSession(): Lookup by ID       │
│  - closeSession(): Mark as closed   │
│  - cleanupStale(): GC old sessions  │
│                                     │
└────────────────────────────────────┘
```

---

### 4.3 Matchmaker Queue

```
┌──────────────────────────────────────────────────────────┐
│  Matchmaker {                                            │
│                                                           │
│    queue: QueueTicket[]                                  │
│    │                                                      │
│    ├─→ Index 0 (OLDEST):                                 │
│    │   {                                                 │
│    │     peerId: "peer-a1b2c3d4",                        │
│    │     socket: WebSocket (conn to peer),              │
│    │     enqueuedAt: 1695125400000 (5 min ago),          │
│    │     retryCount: 0                                   │
│    │   }                                                 │
│    │                                                      │
│    ├─→ Index 1:                                          │
│    │   {                                                 │
│    │     peerId: "peer-b5e6f7g8",                        │
│    │     socket: WebSocket,                              │
│    │     enqueuedAt: 1695125410000 (4 min ago),          │
│    │     retryCount: 0                                   │
│    │   }                                                 │
│    │                                                      │
│    ├─→ Index 2:                                          │
│    │   {                                                 │
│    │     peerId: "peer-c9i0j1k2",                        │
│    │     socket: WebSocket,                              │
│    │     enqueuedAt: 1695125405000 (3 min ago),          │
│    │     retryCount: 1 (re-entry after skip)             │
│    │   }                                                 │
│    │                                                      │
│    └─→ ... more tickets ...                              │
│                                                           │
│  Methods:                                                │
│  ├─→ enqueue(peerId, socket):                           │
│  │   Add ticket to end of queue                          │
│  │   Time: O(1)                                          │
│  │                                                        │
│  ├─→ tryMatch():                                         │
│  │   if queue.length >= 2:                               │
│  │     match = { clientA: queue[0], clientB: queue[1] }  │
│  │     queue.shift(); queue.shift();  // O(n) in JS      │
│  │     return match;                                     │
│  │   Time: O(n) worst case, but typically O(1)           │
│  │                                                        │
│  ├─→ removeFromQueue(socket):                            │
│  │   Remove ticket from queue (if peer disconnects)      │
│  │   Time: O(n)                                          │
│  │                                                        │
│  └─→ size(): Return queue length                         │
│      Time: O(1)                                          │
│                                                           │
│  ✓ FIFO ordering ensures fairness                       │
│  ✓ No randomness (deterministic for testing)             │
│  ✓ Simple and understandable logic                       │
│  ⚠ O(n) removals if peer list is large                  │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Sequence Diagrams (Alternative Views)

### 5.1 Full Connection Lifecycle

```
TIME   CLIENT A              SERVER               CLIENT B
 │
 0   Click Find
 │   ├─→ Create PeerConn
 │   └─→ Send connect        ───────────────────────→
 │                           ├─ Enqueue A
 │                           │
 5                           │        ←──────────── Click Find
 │                           │        Create PeerConn
 │                           │
 │                           ├─ Recv connect
10                           ├─ Enqueue B
 │                           ├─ Match(A, B)
 │   ←─────────────────────── matchFound
 │   ├─ Know remote peer B   │                  ← ─matchFound
 │   ├─ Create offer         │                  ├─ Know remote peer A
 │   └─ Send offer           ───────────────────→ ├─ recv offer
15                           │                  ├─ setRemote(offer)
 │                           │                  ├─ Create answer
 │                           │                  └─ Send answer
 │   ←─────────────────────── answer
 │   ├─ setRemote(answer)    │
20                           │
 │   ├─ Start ICE            ├─ Relay ICE cands ──→
 │   └─ Send ICE cands  ─────→
 │                           │
 │   ←───────────────────────┼─── ICE cands
25                           │
 │   ├─ addIceCandidate()    │
 │                           │
 30 ✓ Connection Ready!
 │   ├─ onconnectionstatechange: connected
 │   ├─ Create data channel  │
 │                           │  ← ← Connection Ready!
35                           │  ← ← onconnectionchange: connected
 │                           │  ← ← ondatachannel
 │
 │   ╔════════════════════════════════════════════════╗
 │   ║        CONNECTED & COMMUNICATING               ║
 │   ╚════════════════════════════════════════════════╝
40  │
 │   User types "Hi!"
 │   ├─ dataChannel.send("Hi!")
 │   │  [Direct peer-to-peer, NO SERVER]
 │   └─→ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ → ├─ ondatachannelmessage
45                           │       ├─ Display "Hi!" in chat
 │
 │   ←─ ─ ─ ─ dataChannel message ─ ─ ─ ←
 │   ├─ "Hey there!"
 │   └─ Display in chat
50
 │   ... more messages ...
 │
 │   User clicks Skip
55  ├─ Send control.skip   ───────────────────────→
 │                         ├─ Close session
 │   ←─ ─ disconnected ─ ─ ─ ─ ─ disconnected ─ → ├─ Close RTC
 │   ├─ Close RTC Peer     │
 │   └─ Send retry        ───→ Enqueue A (again)
 │                           │
60                           │       ←─────────── Send retry
 │   ├─ Waiting in queue     ├─ Enqueue B (again)
 │                           ├─ Match(A', B')
65  ←─ ─ matchFound (new peer) ─ ─ ─ matchFound ─ →
 │   ├─ Create new PeerConn   │
 │   └─ Start negotiation     │
 │       with different peer
```

---

### 5.2 Error Handling Paths

```
SCENARIO: ICE Connection Fails

NORMAL PATH:
  negotiate → add ICE candidates → connection succeeds → connected

ERROR PATH:
  negotiate → add ICE candidates → ICE fails (no connectivity)
     ↓
  onconnectionstatechange: "failed"
     ↓
  Client: Show "Connection failed"
     ↓
  Client: User clicks retry
     ↓
  Send control.disconnect
     ↓
  Server: Close session, notify peer
     ↓
  Send control.retry
     ↓
  Server: Re-queue peer
     ↓
  Wait for new match
     ↓
  (Try again with different peer)


SCENARIO: Network Timeout

NORMAL PATH:
  connected → idle for 5 minutes → background cleanup

ERROR PATH:
  session: active, lastActivity = T
     ↓
  (5 minutes pass)
     ↓
  Server cleanup timer fires
     ↓
  now - lastActivity > 300_000 (ms)
     ↓
  Server: Close session
     ↓
  Send control.timeout to both clients
     ↓
  Client A: Close RTC, show "Connection timed out"
  Client B: Close RTC, show "Connection timed out"
     ↓
  Both can click "Find" to restart


SCENARIO: Client Crashes / Browser Closes

ERROR PATH:
  (Client browser closes abruptly)
     ↓
  WebSocket disconnect (immediate)
     ↓
  Server: socket.on("close")
     ↓
  if sessionId exists:
    closeSession(sessionId, "socket_closed")
    Send timeout to counterpart (best-effort)
  else:
    removeFromQueue(socket)
     ↓
  Counterpart receives timeout notification
     ↓
  Counterpart: Shows "Peer disconnected"
  Counterpart: Can click to find new peer
```

---

## 6. Interview Visual Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                   STRANGELY ARCHITECTURE SUMMARY                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  LAYERS:                                                           │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ CONTROL PLANE (WebSocket Server)                         │    │
│  │ ├─ Message envelope validation (Zod)                    │    │
│  │ ├─ Matchmaker: FIFO queue, fair pairing               │    │
│  │ ├─ Session Registry: Bidirectional peer mapping         │    │
│  │ ├─ Event dispatch & relay (deterministic)              │    │
│  │ └─ Periodic cleanup (timeout handling)                 │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ SIGNALING CHANNEL (WebSocket & WebRTC)                  │    │
│  │ ├─ control.* events (matchmaking lifecycle)            │    │
│  │ ├─ webrtc.* events (SDP + ICE relay)                   │    │
│  │ └─ All validated by shared envelope + schema           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ MEDIA PLANE (WebRTC P2P)                                │    │
│  │ ├─ Audio stream (encrypted DTLS-SRTP)                  │    │
│  │ ├─ Video stream (encrypted DTLS-SRTP)                  │    │
│  │ ├─ Data channel (encrypted DTLS)                       │    │
│  │ └─ ⚠️  NO SERVER INVOLVEMENT ⚠️                         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
│  KEY PROPERTIES:                                                   │
│  ✓ Type-Safe: Nominal types, Zod validation, TS strict mode     │
│  ✓ Deterministic: FIFO matching, no randomness                  │
│  ✓ Anonymous: No user data stored, transient sessions           │
│  ✓ Resilient: Timeout cleanup, disconnect handling              │
│  ✓ Scalable Path: Redis (sessions), sharding (peers)            │
│  ✓ End-to-End Encrypted: Server blind to media                  │
│                                                                    │
│  TESTING:                                                          │
│  ✓ Unit: Envelope, Matchmaker, SocketServer logic              │
│  ✓ Integration: Full connect → match → chat flow                │
│  ✓ Manual: Real browsers, network faults                        │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Scalability Roadmap

```
CURRENT (Single Node)
┌──────────────────────────────────────────┐
│   Strangely v1: In-Memory Monolith        │
│   - All state in process                  │
│   - WebSocket on :8080                    │
│   - ~1000 concurrent sessions max        │
│   - No persistence, no replication        │
│   - Simple, easy to develop               │
└──────────────────────────────────────────┘

PHASE 1: High Availability
┌──────────────────────────────────────────┐
│   Load Balancer (sticky sessions)         │
│   ├─→ Server A                            │
│   ├─→ Server B                            │
│   └─→ Server C                            │
│                                            │
│   Redis:                                   │
│   ├─→ SessionRegistry (distributed)       │
│   └─→ Queue (shared, notifications)       │
└──────────────────────────────────────────┘

PHASE 2: Geo-Distributed
┌──────────────────────────────────────────┐
│   US Region:                              │
│   ├─→ Server cluster + Redis              │
│                                            │
│   EU Region:                              │
│   ├─→ Server cluster + Redis              │
│                                            │
│   Asia Region:                            │
│   └─→ Server cluster + Redis              │
│                                            │
│   Latency-aware matching:                 │
│   └─→ Prefer same-region peers            │
└──────────────────────────────────────────┘

PHASE 3: Media Resilience (Optional)
┌──────────────────────────────────────────┐
│   SFU (Selective Forwarding Unit)         │
│   ├─→ Fallback if P2P fails               │
│   ├─→ Relay audio/video through SFU       │
│   └─→ Enables many-to-many scenarios      │
│                                            │
│   Advantages:                             │
│   ├─→ Works behind restrictive firewalls  │
│   ├─→ Enables group chat                  │
│   └─→ Better bandwidth utilization        │
│                                            │
│   Disadvantages:                          │
│   ├─→ Higher latency than P2P             │
│   ├─→ Server CPU cost increases           │
│   └─→ Complex operational overhead        │
└──────────────────────────────────────────┘

ESTIMATED CAPACITY:
┌─────────────────────────────────────────────┐
│ Config                  │ Concurrent Sessions │
├─────────────────────────┼────────────────────┤
│ v1 (single server)      │ 1K - 5K             │
│ Phase 1 (HA, Redis)     │ 50K - 100K          │
│ Phase 2 (geo + matching)│ 500K - 1M           │
│ Phase 3 (SFU optional)  │ 1M+                 │
└─────────────────────────────────────────────┘
```

---

## 8. Comparison: Strangely vs. Alternatives

```
FEATURE                    | Strangely      | Omegle Clone | Discord
─────────────────────────────────────────────────────────────────
Anonymous                  | ✓ Yes           | ✓ Yes         | ✗ No
P2P Media                   | ✓ Yes           | ✗ Server relay| ✓ Yes
Signaling Open Source       | ✓ Yes           | ✗ Proprietary | ✗ Proprietary
Type-Safe Protocol          | ✓ (Zod+TS)      | ✗ JSON only  | ✗ JSON only
FIFO Fair Queue             | ✓ Yes           | ✗ Random      | N/A
Deterministic for Testing   | ✓ Yes           | ✗ Random      | N/A
─────────────────────────────────────────────────────────────────

COMPLEXITY:
  Strangely: ~500 lines server + ~300 lines client logic
  Omegle: Likely 10K+ lines (not open source)
  Discord: 100K+ lines (distributed system)

WHEN TO USE:
  ✓ Strangely: Learning WebRTC, small P2P chat, anonymous connections
  ✗ Strangely: Production at scale, user profiles, message history
```

---

## Final Takeaway

> **Strangely is a clean, type-safe, deterministic blueprint for real-time P2P applications. It demonstrates production-ready separation of concerns, resilient error handling, and a clear path to scaling from a single node to a distributed system.**
