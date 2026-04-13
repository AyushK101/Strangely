import { CONTROL_EVENT, WEBRTC_SIGNAL_EVENT } from "@strangely/shared";

export function App() {
  return (
    <main className="app-shell">
      <h1>Strangely Client Scaffold</h1>
      <p>
        Client owns WebRTC peer/media lifecycle. Server is used only for
        signaling and matchmaking control events.
      </p>
      <section>
        <h2>Control Plane (WebSocket)</h2>
        <ul>
          <li>{CONTROL_EVENT.CONNECT}</li>
          <li>{CONTROL_EVENT.DISCONNECT}</li>
          <li>{CONTROL_EVENT.TIMEOUT}</li>
          <li>{CONTROL_EVENT.SKIP}</li>
          <li>{CONTROL_EVENT.RETRY}</li>
        </ul>
      </section>
      <section>
        <h2>Media Plane Signaling Inputs</h2>
        <ul>
          <li>{WEBRTC_SIGNAL_EVENT.OFFER}</li>
          <li>{WEBRTC_SIGNAL_EVENT.ANSWER}</li>
          <li>{WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE}</li>
        </ul>
      </section>
    </main>
  );
}
