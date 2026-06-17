import { useEffect, useMemo, useRef, useState } from "react";

import {
  CONTROL_EVENT,
  WEBRTC_SIGNAL_EVENT,
  makeEnvelope,
  type IceCandidatePayload,
  type MatchFoundPayload,
  type OfferPayload,
  type PeerId,
  type SessionId,
  type SignalEnvelopeInput,
} from "@strangely/shared";

type AppStage = "idle" | "searching" | "matched" | "connected";

interface ChatMessage {
  id: string;
  text: string;
  from: "me" | "stranger" | "system";
}

interface WorkflowStep {
  title: string;
  label: string;
  description: string;
  tone: "blue" | "pink" | "red";
  active: boolean;
}

const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL ?? "ws://localhost:8080";

const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function App() {
  const [stage, setStage] = useState<AppStage>("idle");
  const [status, setStatus] = useState("Click Find to start");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canSendChat, setCanSendChat] = useState(false);

  const localPeerIdRef = useRef<PeerId>(createId("peer"));
  const remotePeerIdRef = useRef<PeerId | null>(null);
  const sessionIdRef = useRef<SessionId | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<IceCandidatePayload[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const connected = useMemo(() => stage === "connected", [stage]);
  const stageLabel = useMemo(() => {
    if (stage === "idle") {
      return "Idle";
    }
    if (stage === "searching") {
      return "Searching";
    }
    if (stage === "matched") {
      return "Matched";
    }
    return "Connected";
  }, [stage]);

  const stageTone = useMemo(() => {
    if (stage === "idle") {
      return "blue";
    }
    if (stage === "searching") {
      return "blue";
    }
    if (stage === "matched") {
      return "pink";
    }
    return "red";
  }, [stage]);

  const workflowSteps = useMemo<WorkflowStep[]>(
    () => [
      {
        title: "Discover",
        label: "Step 01",
        description: "Open the signaling socket and request a match.",
        tone: "blue",
        active: stage === "idle" || stage === "searching",
      },
      {
        title: "Negotiate",
        label: "Step 02",
        description: "Exchange offer, answer, and ICE candidates.",
        tone: "pink",
        active: stage === "matched",
      },
      {
        title: "Chat",
        label: "Step 03",
        description: "Use the data channel for fast, private messages.",
        tone: "red",
        active: stage === "connected",
      },
    ],
    [stage],
  );

  const messageCount = messages.length;

  const statusSummary = useMemo(() => {
    if (stage === "idle") {
      return "Ready when you are.";
    }
    if (stage === "searching") {
      return "Looking for the next available peer.";
    }
    if (stage === "matched") {
      return "Setting up the peer connection.";
    }
    return "Live over WebRTC data channel.";
  }, [stage]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
  }, []);

  useEffect(() => {
    return () => {
      shutdownSession(false);
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      wsRef.current?.close();
    };
  }, []);

  function pushMessage(text: string, from: ChatMessage["from"]): void {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), text, from }]);
  }

  async function ensureLocalMedia(): Promise<MediaStream> {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  }

  function sendEnvelope(envelope: SignalEnvelopeInput): void {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(envelope));
  }

  function setupDataChannel(channel: RTCDataChannel): void {
    dataChannelRef.current = channel;

    channel.onopen = () => {
      setCanSendChat(true);
      setStage("connected");
      setStatus("Connected. Say hi.");
    };

    channel.onclose = () => {
      setCanSendChat(false);
    };

    channel.onmessage = (event) => {
      pushMessage(String(event.data), "stranger");
    };
  }

  async function createPeerConnection(
    initiator: boolean,
  ): Promise<RTCPeerConnection> {
    if (pcRef.current) {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection(RTC_CONFIGURATION);
    pcRef.current = pc;

    const localStream = await ensureLocalMedia();
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }

      remoteStreamRef.current = stream;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    pc.onicecandidate = (event) => {
      const sessionId = sessionIdRef.current;
      if (!event.candidate || !sessionId) {
        return;
      }

      const icePayload: IceCandidatePayload = {
        sessionId,
        fromPeerId: localPeerIdRef.current,
        candidate: event.candidate.candidate,
        ...(event.candidate.sdpMid !== null
          ? { sdpMid: event.candidate.sdpMid }
          : {}),
        ...(event.candidate.sdpMLineIndex !== null
          ? { sdpMLineIndex: event.candidate.sdpMLineIndex }
          : {}),
      };

      sendEnvelope(makeEnvelope(WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE, icePayload));
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        setStage("connected");
        setStatus("Connected.");
      }
      if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        shutdownSession(false);
        setStatus("Connection closed.");
      }
    };

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    if (initiator) {
      setupDataChannel(pc.createDataChannel("chat"));
    }

    return pc;
  }

  async function flushPendingIce(): Promise<void> {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) {
      return;
    }

    while (pendingIceRef.current.length > 0) {
      const payload = pendingIceRef.current.shift();
      if (!payload) {
        continue;
      }

      await pc.addIceCandidate({
        candidate: payload.candidate,
        ...(payload.sdpMid ? { sdpMid: payload.sdpMid } : {}),
        ...(typeof payload.sdpMLineIndex === "number"
          ? { sdpMLineIndex: payload.sdpMLineIndex }
          : {}),
      });
    }
  }

  async function startOfferFlow(): Promise<void> {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      return;
    }

    const pc = await createPeerConnection(true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendEnvelope(
      makeEnvelope(WEBRTC_SIGNAL_EVENT.OFFER, {
        sessionId,
        fromPeerId: localPeerIdRef.current,
        sdp: offer.sdp ?? "",
      }),
    );
    setStatus("Matched. Establishing call...");
  }

  async function onOffer(payload: OfferPayload): Promise<void> {
    const pc = await createPeerConnection(false);
    await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
    await flushPendingIce();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendEnvelope(
      makeEnvelope(WEBRTC_SIGNAL_EVENT.ANSWER, {
        sessionId: payload.sessionId,
        fromPeerId: localPeerIdRef.current,
        sdp: answer.sdp ?? "",
      }),
    );
  }

  function shutdownSession(keepSocket: boolean): void {
    pendingIceRef.current = [];
    sessionIdRef.current = null;
    remotePeerIdRef.current = null;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    pcRef.current?.close();
    pcRef.current = null;

    remoteStreamRef.current = new MediaStream();
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }

    setCanSendChat(false);
    setStage("idle");

    if (!keepSocket) {
      wsRef.current?.close();
      wsRef.current = null;
    }
  }

  async function onSignalMessage(data: MessageEvent<string>): Promise<void> {
    let envelope: SignalEnvelopeInput;
    try {
      envelope = JSON.parse(data.data) as SignalEnvelopeInput;
    } catch {
      return;
    }

    if (envelope.type === CONTROL_EVENT.MATCH_FOUND) {
      const payload = envelope.payload as MatchFoundPayload;
      sessionIdRef.current = payload.sessionId;
      remotePeerIdRef.current = payload.remotePeerId;
      setStage("matched");
      setStatus("Matched. Setting up video and audio...");
      setMessages([]);

      const iAmOfferer = payload.localPeerId < payload.remotePeerId;
      if (iAmOfferer) {
        await startOfferFlow();
      }
      return;
    }

    if (envelope.type === WEBRTC_SIGNAL_EVENT.OFFER) {
      await onOffer(envelope.payload);
      return;
    }

    if (envelope.type === WEBRTC_SIGNAL_EVENT.ANSWER) {
      const pc = await createPeerConnection(true);
      await pc.setRemoteDescription({
        type: "answer",
        sdp: envelope.payload.sdp,
      });
      await flushPendingIce();
      return;
    }

    if (envelope.type === WEBRTC_SIGNAL_EVENT.ICE_CANDIDATE) {
      const pc = pcRef.current;
      const normalizedPayload: IceCandidatePayload = {
        sessionId: envelope.payload.sessionId,
        fromPeerId: envelope.payload.fromPeerId,
        candidate: envelope.payload.candidate,
        ...(envelope.payload.sdpMid ? { sdpMid: envelope.payload.sdpMid } : {}),
        ...(typeof envelope.payload.sdpMLineIndex === "number"
          ? { sdpMLineIndex: envelope.payload.sdpMLineIndex }
          : {}),
      };

      if (!pc || !pc.remoteDescription) {
        pendingIceRef.current.push(normalizedPayload);
        return;
      }

      await pc.addIceCandidate({
        candidate: normalizedPayload.candidate,
        ...(normalizedPayload.sdpMid
          ? { sdpMid: normalizedPayload.sdpMid }
          : {}),
        ...(typeof normalizedPayload.sdpMLineIndex === "number"
          ? { sdpMLineIndex: normalizedPayload.sdpMLineIndex }
          : {}),
      });
      return;
    }

    if (envelope.type === CONTROL_EVENT.SKIP) {
      shutdownSession(true);
      setStatus("Stranger skipped. Click Find for next.");
      return;
    }

    if (envelope.type === CONTROL_EVENT.DISCONNECT) {
      shutdownSession(true);
      setStatus("Stranger disconnected.");
      return;
    }

    if (envelope.type === CONTROL_EVENT.TIMEOUT) {
      shutdownSession(true);
      setStatus("Match timed out. Click Find again.");
    }
  }

  async function ensureSocket(): Promise<WebSocket> {
    const existing = wsRef.current;
    if (existing && existing.readyState === WebSocket.OPEN) {
      return existing;
    }

    const socket = new WebSocket(SIGNALING_URL);
    wsRef.current = socket;

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () =>
        reject(new Error("Unable to connect to signaling server"));
    });

    socket.onmessage = (event) => {
      void onSignalMessage(event);
    };

    socket.onclose = () => {
      shutdownSession(true);
      setStatus("Signaling connection closed.");
    };

    return socket;
  }

  async function findStranger(): Promise<void> {
    try {
      await ensureLocalMedia();
      await ensureSocket();
      sendEnvelope(
        makeEnvelope(CONTROL_EVENT.CONNECT, {
          peerId: localPeerIdRef.current,
        }),
      );
      setStage("searching");
      setStatus("Searching for someone...");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to start");
    }
  }

  function nextStranger(): void {
    sendEnvelope(
      makeEnvelope(CONTROL_EVENT.SKIP, {
        peerId: localPeerIdRef.current,
        ...(sessionIdRef.current
          ? { previousSessionId: sessionIdRef.current }
          : {}),
      }),
    );
    shutdownSession(true);
    setStage("searching");
    setStatus("Finding next stranger...");
  }

  function stopChat(): void {
    sendEnvelope(
      makeEnvelope(CONTROL_EVENT.DISCONNECT, {
        peerId: localPeerIdRef.current,
        reason: "client_left" as const,
      }),
    );
    shutdownSession(false);
    setStatus("Stopped.");
  }

  function sendChatMessage(): void {
    const text = chatInput.trim();
    if (!text) {
      return;
    }

    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      return;
    }

    channel.send(text);
    pushMessage(text, "me");
    setChatInput("");
  }

  return (
    <main className="app-shell">
      <header className="hero-card">
        <div className="hero-copy">
          <div className="hero-kicker-row">
            <span className="brand-lockup">Strangely</span>
            <span className={`status-pill status-pill-${stageTone}`}>
              {stageLabel}
            </span>
          </div>
          <h1>
            Anonymous chat with a disciplined, client-side connection flow.
          </h1>
          <p>
            Find a stranger, negotiate the peer connection over WebSocket
            signaling, and keep video, audio, and chat inside the browser.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void findStranger()}
            >
              Find Stranger
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={nextStranger}
              disabled={stage === "idle"}
            >
              Next
            </button>
            <button
              type="button"
              className="button button-danger"
              onClick={stopChat}
              disabled={stage === "idle"}
            >
              Stop
            </button>
          </div>

          <div className="hero-metrics">
            <article className="metric-card">
              <span className="metric-label">Status</span>
              <strong>{statusSummary}</strong>
              <p>{status}</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Messages</span>
              <strong>{messageCount}</strong>
              <p>Sent through the data channel.</p>
            </article>
            <article className="metric-card">
              <span className="metric-label">Local peer</span>
              <strong>{localPeerIdRef.current}</strong>
              <p>Generated on the client.</p>
            </article>
          </div>
        </div>

        <aside className="workflow-panel">
          <div className="panel-heading-row">
            <div>
              <span className="panel-kicker">Connection pipeline</span>
              <h2>Three steps from discovery to chat.</h2>
            </div>
            <span className="mini-pill">WebRTC</span>
          </div>

          <div className="workflow-list">
            {workflowSteps.map((step) => (
              <article
                key={step.title}
                className={`workflow-step workflow-step-${step.tone} ${
                  step.active ? "is-active" : ""
                }`}
              >
                <span className="workflow-label">{step.label}</span>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </article>
            ))}
          </div>

          <div className="workflow-footnote">
            <span>Signal URL</span>
            <strong>{SIGNALING_URL}</strong>
          </div>
        </aside>
      </header>

      <section className="content-grid">
        <article className="panel panel-video">
          <div className="panel-heading-row">
            <div>
              <span className="panel-kicker">Media plane</span>
              <h2>Local and remote video surfaces.</h2>
            </div>
            <span
              className={connected ? "mini-pill mini-pill-live" : "mini-pill"}
            >
              {connected ? "Live" : "Waiting"}
            </span>
          </div>

          <div className="video-grid">
            <article className="video-card">
              <div className="card-caption-row">
                <h3>You</h3>
                <span className="card-caption">Muted preview</span>
              </div>
              <video ref={localVideoRef} autoPlay muted playsInline />
            </article>
            <article className="video-card">
              <div className="card-caption-row">
                <h3>Stranger</h3>
                <span className="card-caption">Remote stream</span>
              </div>
              <video ref={remoteVideoRef} autoPlay playsInline />
            </article>
          </div>
        </article>

        <article className="panel panel-chat">
          <div className="panel-heading-row">
            <div>
              <span className="panel-kicker">Data channel</span>
              <h2>Minimal text chat with clear state.</h2>
            </div>
            <span className="mini-pill">{canSendChat ? "Open" : "Closed"}</span>
          </div>

          <div className="chat-feed">
            {messages.length === 0 ? (
              <p className="placeholder">
                Messages appear here once the data channel is open.
              </p>
            ) : (
              messages.map((message) => (
                <p key={message.id} className={`msg msg-${message.from}`}>
                  <span className="msg-label">
                    {message.from === "me"
                      ? "You"
                      : message.from === "stranger"
                        ? "Stranger"
                        : "System"}
                  </span>
                  <span className="msg-text">{message.text}</span>
                </p>
              ))
            )}
          </div>

          <div className="chat-input-row">
            <input
              type="text"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  sendChatMessage();
                }
              }}
              placeholder="Type a message"
              disabled={!connected || !canSendChat}
            />
            <button
              type="button"
              className="button button-primary button-send"
              onClick={sendChatMessage}
              disabled={!connected || !canSendChat}
            >
              Send
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}
