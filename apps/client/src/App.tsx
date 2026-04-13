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
    <main className="omegle-shell">
      <header className="topbar">
        <div className="topbar-row">
          <h1>Strangely</h1>
          <span className="stage-pill">{stageLabel}</span>
        </div>
        <p>Anonymous one-on-one video chat. Find, connect, and move on.</p>
      </header>

      <section className="controls">
        <button
          type="button"
          className="primary"
          onClick={() => void findStranger()}
        >
          Find Stranger
        </button>
        <button
          type="button"
          className="secondary"
          onClick={nextStranger}
          disabled={stage === "idle"}
        >
          Next
        </button>
        <button
          type="button"
          className="danger"
          onClick={stopChat}
          disabled={stage === "idle"}
        >
          Stop
        </button>
        <span className="status">{status}</span>
      </section>

      <section className="video-grid">
        <article className="video-card">
          <h2>You</h2>
          <video ref={localVideoRef} autoPlay muted playsInline />
        </article>
        <article className="video-card">
          <h2>Stranger</h2>
          <video ref={remoteVideoRef} autoPlay playsInline />
        </article>
      </section>

      <section className="chat-card">
        <h2>Chat</h2>
        <div className="chat-feed">
          {messages.length === 0 ? (
            <p className="placeholder">
              Messages appear here once the data channel is open.
            </p>
          ) : (
            messages.map((message) => (
              <p key={message.id} className={`msg msg-${message.from}`}>
                {message.from === "me"
                  ? "You"
                  : message.from === "stranger"
                    ? "Stranger"
                    : "System"}
                : {message.text}
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
            onClick={sendChatMessage}
            disabled={!connected || !canSendChat}
          >
            Send
          </button>
        </div>
      </section>
    </main>
  );
}
