# Signaling API Baseline

## Envelope

All signaling/control messages use a versioned envelope from `@strangely/shared`:

- `version`: protocol version string (`v1`).
- `type`: deterministic event name.
- `payload`: typed event payload.
- `requestId` (optional): request correlation identifier.
- `timestampMs`: epoch milliseconds.

## Event Types

Control plane events (WebSocket):

- `control.connect`
- `control.disconnect`
- `control.timeout`
- `control.skip`
- `control.retry`
- `control.matchFound`

WebRTC signaling events carried by WebSocket:

- `webrtc.offer`
- `webrtc.answer`
- `webrtc.iceCandidate`

## Ownership Rules

- Server validates/routs control and signaling metadata messages.
- Client applies offer/answer/ICE to browser `RTCPeerConnection`.
- Media/data packets flow directly peer-to-peer over WebRTC, not through server.
- Server derives signaling sender identity from socket-bound context and does not trust client-supplied `peerId`/`fromPeerId` for relay decisions.
- Server drops malformed envelopes and invalid payloads before event handling.

## Initial Contract Notes

- `control.matchFound` includes `sessionId`, `localPeerId`, and `remotePeerId`.
- `webrtc.offer` and `webrtc.answer` include `sessionId`, `fromPeerId`, and `sdp`.
- `webrtc.iceCandidate` includes `sessionId`, `fromPeerId`, and candidate details.
- On `control.disconnect`, `control.skip`, or socket close, server removes session membership deterministically and notifies counterpart when connected.
