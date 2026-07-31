import { useCallback, useEffect, useRef, useState } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function useWebRTC({ socket, sessionId, role, isInitiator }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);

  const getPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && sessionId) {
        socket.emit("webrtc-ice-candidate", {
          sessionId,
          candidate: event.candidate,
        });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };
    pcRef.current = pc;
    return pc;
  }, [socket, sessionId]);

  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      const pc = getPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      setMediaError(null);
      return stream;
    } catch (err) {
      setMediaError(err.message);
      throw err;
    }
  }, [getPeerConnection]);

  const createOffer = useCallback(async () => {
    const pc = getPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer", { sessionId, offer });
  }, [getPeerConnection, socket, sessionId]);

  const handleOffer = useCallback(
    async (offer) => {
      const pc = getPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { sessionId, answer });
    },
    [getPeerConnection, socket, sessionId]
  );

  const handleAnswer = useCallback(
    async (answer) => {
      const pc = getPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    },
    [getPeerConnection]
  );

  const handleIceCandidate = useCallback(
    async (candidate) => {
      const pc = getPeerConnection();
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    },
    [getPeerConnection]
  );

  useEffect(() => {
    if (!socket || !sessionId) return;

    const onOffer = ({ offer }) => handleOffer(offer);
    const onAnswer = ({ answer }) => handleAnswer(answer);
    const onIce = ({ candidate }) => handleIceCandidate(candidate);

    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-answer", onAnswer);
    socket.on("webrtc-ice-candidate", onIce);

    return () => {
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-answer", onAnswer);
      socket.off("webrtc-ice-candidate", onIce);
    };
  }, [socket, sessionId, handleOffer, handleAnswer, handleIceCandidate]);

  useEffect(() => {
    if (!socket || !sessionId || !isInitiator) return;

    let cancelled = false;
    (async () => {
      try {
        await startLocalMedia();
        if (!cancelled) await createOffer();
      } catch {
        /* mediaError already set */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [socket, sessionId, isInitiator, startLocalMedia, createOffer]);

  useEffect(() => {
    if (!socket || !sessionId || isInitiator) return;

    startLocalMedia().catch(() => {});
  }, [socket, sessionId, isInitiator, startLocalMedia]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
  }, []);

  return {
    localVideoRef,
    remoteVideoRef,
    localStream,
    remoteStream,
    mediaError,
    startLocalMedia,
    createOffer,
  };
}
