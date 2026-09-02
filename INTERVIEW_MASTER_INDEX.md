# Strangely: Interview Preparation Index

Welcome! This document is your master guide to presenting Strangely in technical interviews.

---

## 📚 Documentation Structure

You now have **4 comprehensive documents** for interview preparation:

### 1. **INTERVIEW_QUICK_REFERENCE.md** ⭐ START HERE

**Purpose:** 2–3 minute quick reference  
**Best for:**

- Pre-interview refresher
- Quick answering of standard questions
- Q&A bullet points
- 30-second system pitch

**Key Sections:**

- 30-second pitch
- Five core concepts (visuals)
- State machine
- Server event loop (pseudocode)
- Critical design decisions
- Q&A bank (top 8 questions)
- Gotchas to avoid

**Time to read:** 5–10 minutes  
**Memorize:** The "Five Core Concepts" section

---

### 2. **INTERVIEW_DESIGN.md** ⭐ DEEP DIVE

**Purpose:** Comprehensive HLD, LLD, and architectural reference  
**Best for:**

- Technical deep-dive questions
- System design interview prep
- Explaining architecture to technical interviewers
- Understanding design decisions

**Key Sections:**

1. High-Level Design (HLD)
   - System architecture diagram
   - Component diagram
   - Layered architecture
2. Low-Level Design (LLD)
   - Message envelope structure
   - Control events (table)
   - WebRTC signaling events
   - Client state machine
   - Server session registry (pseudocode)
   - Matchmaker queue (pseudocode)
   - WebSocket server structure (full code)
3. End-to-End Flows
   - Match & connect flow
   - Chat message flow
   - Skip & rematch flow
   - Timeout & cleanup flow
   - Disconnect & cleanup flow
4. Data Structures
   - Shared type definitions
   - Payload schemas
5. Architectural Principles
   - Separation of concerns
   - Resilience patterns
   - Scalability considerations
   - Tradeoffs
6. Key Design Decisions (4 major ones)
7. Interview Talking Points
   - Strengths to emphasize
   - Anticipated questions
8. Testing Strategy
9. Future Enhancements
10. Conclusion

**Time to read:** 30–45 minutes  
**Practice:** Explain sections 1–2 aloud without notes

---

### 3. **INTERVIEW_VISUAL_FLOWS.md** ⭐ VISUAL REFERENCE

**Purpose:** ASCII diagrams and visual architecture  
**Best for:**

- Visual learners
- Whiteboard interview prep
- Explaining flows during video calls
- Tracing complex scenarios

**Key Sections:**

1. Complete system view (ASCII)
2. Control plane vs. media plane (visual)
3. Detailed flow diagrams
   - Discovery → Negotiation → Connection
   - Skip & rematch
   - Timeout & cleanup
   - Socket close handler
4. Extended state machine
5. Data structure diagrams
   - Envelope structure
   - Session registry entry
   - Matchmaker queue
6. Sequence diagrams
   - Full connection lifecycle
   - Error handling paths
7. Interview visual summary (one-pager)
8. Scalability roadmap
9. Comparison with alternatives

**Time to read:** 20–30 minutes  
**Practice:** Draw the control vs. media plane diagram on a whiteboard

---

### 4. **INTERVIEW_DESIGN.md** (already listed above, but see full details there)

---

## 🎯 Quick Study Plan

### Before Your Interview (1 Week)

**Day 1–2: Overview**

- Read INTERVIEW_QUICK_REFERENCE.md (5–10 min)
- Skim INTERVIEW_DESIGN.md sections 1–2 (10 min)
- Look at INTERVIEW_VISUAL_FLOWS.md diagrams (5 min)

**Day 3–4: Deep Dive**

- Read INTERVIEW_DESIGN.md fully (30–45 min)
- Trace through the "Match & Connect Flow" and "Chat Message Flow" with pen and paper
- Mentally walk through error scenarios (timeout, disconnect)

**Day 5: Whiteboard Practice**

- Draw system architecture on whiteboard
- Draw control plane vs. media plane
- Draw client state machine
- Draw session registry structure

**Day 6: Q&A Drill**

- Use Q&A bank from QUICK_REFERENCE.md
- Practice 30-second pitch 5 times
- Record yourself explaining the architecture (2 min)

**Day 7: Final Review**

- Re-read QUICK_REFERENCE.md (3 min)
- Review gotchas section
- Get good sleep! ✅

---

## 💬 30-Second Pitch (Memorize This)

> **Strangely is an anonymous peer-to-peer video chat system built on WebRTC with lightweight WebSocket signaling. The server only handles matchmaking and relaying signaling metadata (SDP, ICE candidates); all media—audio, video, and chat—flows directly between peers using WebRTC's encrypted channels. The architecture demonstrates strict separation of concerns, type-safe contracts with runtime validation, and scalable patterns.**

---

## 🏗️ System At a Glance (Memorize This)

```
┌──────────────────┐                    ┌──────────────────┐
│    CLIENT A      │                    │    CLIENT B      │
│  (React + Vite)  │◄──WebSocket(Control Plane)──►│  (React + Vite)  │
│   + WebRTC       │  vs. (Media Plane)             │   + WebRTC       │
│                  │◄────WebRTC P2P──────────────►│                  │
└──────────────────┘    (Audio, Video, Chat)      └──────────────────┘
           │                                               │
           └─────────→ SERVER ◄───────────────────────────┘
                    (Matchmaking,
                     Signaling Relay,
                     Session Mgmt)

KEY: Server ONLY controls. Media is 100% peer-to-peer.
```

---

## 📋 Five Core Concepts (Memorize These)

### 1. Message Envelope

Every message has: `version | type | payload | requestId? | timestampMs`

- Enables protocol evolution
- Type-safe dispatch
- Runtime validation with Zod

### 2. Control Plane (Server)

- `control.connect`: User enters queue
- `control.matchFound`: Server finds match
- `webrtc.*`: Server relays SDP + ICE candidates
- `control.timeout`: Session expired

### 3. Media Plane (P2P)

- Audio/video streams (encrypted)
- Chat data channel (encrypted)
- **Server never touches this**

### 4. Session Registry

- Map<SessionId, { clientA, clientB, metadata }>
- Enables deterministic relay routing
- Prevents peer spoofing

### 5. Matchmaker Queue

- FIFO queue of waiting peers
- Oldest two peers are matched
- Ensures fairness, deterministic for testing

---

## ❓ Most Common Interview Questions (Top 8)

**Q1: Explain the architecture in 2 minutes.**
→ Use the 30-second pitch, then describe control vs. media plane (30 sec), then key components (30 sec).

**Q2: How do you prevent a peer from claiming another peer's identity?**
→ Server binds peerId to WebSocket at `control.connect`. Uses that binding for relay decisions, never trusts client-supplied `fromPeerId`. (See INTERVIEW_DESIGN.md, Decision 2)

**Q3: How is data encrypted?**
→ Control messages: TLS (ws:// → wss://). Media: WebRTC's DTLS-SRTP (built-in). Server can't eavesdrop on media.

**Q4: What happens if a peer disconnects mid-session?**
→ WebSocket close event triggers session cleanup. Counterpart receives timeout notification. Peer can reconnect and rematch.

**Q5: How do you handle NAT/firewall issues?**
→ STUN discovers public IP:port. TURN relays if direct connection blocked. Configured in RTC_CONFIGURATION. (Industry standard)

**Q6: Can this scale to 1M users?**
→ Current version: ~1K–5K concurrent (single process). Scaling path: Redis for session registry, load balancer, regional sharding. See INTERVIEW_VISUAL_FLOWS.md, Scalability Roadmap.

**Q7: Why FIFO matching instead of random?**
→ Simple (O(1)), fair, deterministic. Random would make testing harder. FIFO works for 1-to-1. (See INTERVIEW_DESIGN.md, Decision 3)

**Q8: Can you add group chat?**
→ Yes. Extend `matchFound` to include N peers. Clients create N data channels. Or add SFU (Selective Forwarding Unit) for many-to-many media. (See INTERVIEW_DESIGN.md, Future Enhancements)

---

## 🎓 Understanding Each Layer

### Control Plane (Server)

**Responsibility:** Matchmaking, signaling relay, session lifecycle  
**Why here?** Deterministic coordination, prevent client collusion, rate-limiting  
**Example flow:**

1. Client A sends `control.connect`
2. Server enqueues A
3. Client B sends `control.connect`
4. Server enqueues B
5. Server matches A + B (FIFO)
6. Server sends `control.matchFound` to both
7. Server relays `webrtc.offer` from A to B
8. Server relays `webrtc.answer` from B to A
9. Server relays `webrtc.iceCandidate` messages

### Media Plane (P2P)

**Responsibility:** Audio, video, data channel transport  
**Why here?** Low latency, end-to-end encryption, reduced server bandwidth  
**Example flow:**

1. (After SDP negotiation completes)
2. Client A's microphone → encode → send via WebRTC
3. Encrypted DTLS tunnel between A and B (no server)
4. Client B receives → decode → play through speakers

---

## 🧪 Testing Approach

**Unit Tests** (INTERVIEW_DESIGN.md, section 8)

- Envelope validation (Zod schemas)
- Matchmaker FIFO logic
- SocketServer event dispatch

**Integration Tests**

- Full flow: A → Server → B → chat
- Timeout/disconnect handling
- Skip/retry queue re-entry

**Manual Testing**

- Real WebRTC browsers
- Network fault injection (packet loss, latency)
- Concurrent match attempts

---

## 🚀 Scalability Roadmap (One-Pager)

| Phase | Config                 | Capacity | Effort |
| ----- | ---------------------- | -------- | ------ |
| v1    | Single process         | 1K–5K    | —      |
| 1     | HA + Redis             | 50K–100K | Medium |
| 2     | Geo + latency matching | 500K–1M  | High   |
| 3     | SFU optional           | 1M+      | High   |

**First step:** Redis for session registry + load balancer with sticky sessions.

---

## ⚠️ Gotchas (Things to NOT Say)

❌ "The server streams media."  
✅ "The server only relays SDP and ICE; media goes direct peer-to-peer."

❌ "Messages are encrypted on the server."  
✅ "WebSocket connection uses TLS; WebRTC media is encrypted by DTLS-SRTP."

❌ "I use random peer matching."  
✅ "I use FIFO (oldest two peers) for deterministic, fair matching."

❌ "I store chat history for anonymity."  
✅ "Anonymous design: server stores only transient session state, no user data."

---

## 🎬 Practice Script (Whiteboard Version)

Use this script if you're doing a whiteboard interview. Practice drawing while explaining:

**Minute 0–0:30 - System Overview**

```
"Strangely is a P2P chat system. I split concerns into two planes:
[DRAW: Control plane box] Control plane (server) for matchmaking & signaling relay.
[DRAW: Media plane box] Media plane (P2P) for audio, video, chat data.
[DRAW: Arrow between them] They're connected but separate."
```

**Minute 0:30–1:00 - Control Flow**

```
"When a user clicks 'Find':
[DRAW: Client A box] Client sends control.connect.
[DRAW: Server box with queue] Server puts them in a FIFO queue.
[DRAW: Client B box] When another peer connects, server matches them (FIFO).
[DRAW: Arrow] Server sends control.matchFound to both."
```

**Minute 1:00–1:30 - Negotiation**

```
"Now they negotiate WebRTC connection:
[DRAW: Client A, Server, Client B]
Client A creates SDP offer, sends to server.
Server relays to Client B.
Client B creates answer, sends to server.
Server relays to Client A.
They exchange ICE candidates the same way."
```

**Minute 1:30–2:00 - Connected & Data Flow**

```
"Once connected:
[DRAW: Arrow between A and B, crossing over server]
Media flows DIRECT peer-to-peer.
Server is NOT in this path.
[DRAW: Chat bubble] Chat data goes through WebRTC DataChannel.
Everything is encrypted end-to-end."
```

**Minute 2:00–2:30 - Error Handling (if time)**

```
"For errors:
[DRAW: timeout arrow] If no match within X seconds, server sends timeout.
[DRAW: close symbol] If peer disconnects, session is closed.
Both clients get notifications and can retry."
```

---

## 📱 Elevator Pitches (Different Audiences)

### For Backend Engineer

"Event-driven architecture with deterministic FIFO queue, idempotent control messages, and a session registry for relay routing. Demonstrates how to scale WebSocket servers: add Redis for session state, shard by peer hash, load balance with sticky sessions. Error handling covers timeout, disconnect, and retry flows."

### For Frontend Engineer

"React + Vite WebRTC client with a robust state machine (idle → searching → matched → negotiating → connected). Implements offer/answer/ICE negotiation, data channel setup, and retry logic. Envelope-based messaging with Zod validation ensures type safety across the network boundary."

### For Full-Stack

"Production-ready monorepo demonstrating clean architecture: server owns control plane (matchmaking, signaling relay); clients own media plane (WebRTC negotiation, streams). Strict separation via shared TypeScript contracts. Message envelopes with versioning enable backward compatibility. Scalable pattern: add Redis, load balancer, then sharding."

---

## 🔗 Cross-References (Jump to Sections)

### "How does matching work?"

→ INTERVIEW_DESIGN.md, Section 2.6 (Matchmaker Queue)  
→ INTERVIEW_VISUAL_FLOWS.md, Section 2.2 (Skip & Rematch)

### "How does the client handle retries?"

→ INTERVIEW_DESIGN.md, Section 2.4 (Client State Machine)  
→ INTERVIEW_VISUAL_FLOWS.md, Section 4.1 (State Machine Diagram)

### "What happens when someone disconnects?"

→ INTERVIEW_DESIGN.md, Section 3.5 (Disconnect & Cleanup Flow)  
→ INTERVIEW_VISUAL_FLOWS.md, Section 5.2 (Error Handling Paths)

### "How does type safety work?"

→ INTERVIEW_DESIGN.md, Section 4 (Data Structures & Key Contracts)  
→ INTERVIEW_DESIGN.md, Section 5.2 (Nominal Types)

### "How do you scale this?"

→ INTERVIEW_DESIGN.md, Section 5.3 (Scalability Considerations)  
→ INTERVIEW_VISUAL_FLOWS.md, Section 7 (Scalability Roadmap)

### "What are the tradeoffs?"

→ INTERVIEW_DESIGN.md, Section 5.4 (Tradeoffs)  
→ INTERVIEW_VISUAL_FLOWS.md, Section 8 (Comparison with Alternatives)

---

## 📊 Quick Metrics to Know

- **Latency:** Signaling ~50–100ms. Media negotiation ~500–2000ms. Total: ~2–3s to connected.
- **Throughput:** Audio ~30–50 kbps. Video (720p) ~500–2000 kbps. Limited by network, not server.
- **Concurrency:** Single server: ~1000–5000 concurrent sessions.
- **Queue depth:** Typically 10–100 waiting peers (sub-second match time).

---

## 🎯 Pre-Interview Checklist

- [ ] Read INTERVIEW_QUICK_REFERENCE.md (memorize Five Core Concepts + 30-sec pitch)
- [ ] Read INTERVIEW_DESIGN.md sections 1–2 (HLD + LLD)
- [ ] Review INTERVIEW_VISUAL_FLOWS.md (draw diagrams mentally)
- [ ] Practice drawing control vs. media plane on whiteboard
- [ ] Practice drawing client state machine
- [ ] Walk through Q&A from QUICK_REFERENCE.md (answer each without notes)
- [ ] Record yourself explaining architecture (2–3 minutes)
- [ ] Review gotchas section
- [ ] Review key design decisions (4 of them)
- [ ] Be ready to discuss scalability path (Redis, sharding)
- [ ] Know the time estimates (HLD sketch: 2 min, full deep dive: 10 min)

---

## 🏆 Final Confidence Builders

**You know this system well if you can:**

1. ✅ Draw complete architecture on whiteboard in 3 minutes
2. ✅ Explain control vs. media plane without looking at notes
3. ✅ Trace a full flow (match → connect → chat → skip) on paper
4. ✅ Answer all 8 common questions in < 1 min each
5. ✅ Discuss scalability roadmap (phase 0 → 1 → 2)
6. ✅ Explain why FIFO matching, not random
7. ✅ Explain why server binds peerId to socket
8. ✅ Draw session registry and matchmaker queue structures

---

## 📞 Last-Minute Tips

**Before you go into the interview:**

1. Print out or bookmark INTERVIEW_QUICK_REFERENCE.md for last-minute review
2. Have the system architecture diagram in mind (the one-pager)
3. Practice your 30-second pitch one more time
4. Remember: You built this. You understand it better than anyone.
5. Speak slowly. Interviewers will ask clarifying questions—that's a good sign!

---

## 💡 After the Interview

**Remember to mention:**

- "I've documented this in INTERVIEW_DESIGN.md (HLD + LLD)"
- "Full flow diagrams in INTERVIEW_VISUAL_FLOWS.md"
- "Live code in apps/server/src/signaling/socketServer.ts"
- Offer to walk through test cases or implementation details

---

## 🚀 Your Elevator Pitch One More Time

> **"Strangely is a real-time P2P chat built with WebRTC and WebSocket signaling. The server handles matchmaking and relays signaling metadata only; all media flows directly peer-to-peer and is encrypted end-to-end. I designed it to demonstrate clean architecture with strict separation of concerns, type-safe contracts, and clear scaling patterns."**

---

## Good luck! You've got this. 🎉

Remember: **The best interview preparation is understanding your own system deeply and being able to explain it clearly.** You've built something solid. Trust your knowledge.

**Final Checklist Before Interview:**

- ✅ Sleep well
- ✅ Review QUICK_REFERENCE.md
- ✅ Practice sketching diagrams
- ✅ Have a pen and paper ready
- ✅ Remember: Questions are good, they mean they're interested!

---

**Questions? Review the appropriate document:**

- Quick facts → INTERVIEW_QUICK_REFERENCE.md
- Deep understanding → INTERVIEW_DESIGN.md
- Visual explanations → INTERVIEW_VISUAL_FLOWS.md
- This page → For navigation
